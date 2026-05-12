import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── Soft ping sound (generated via Web Audio API — no file needed) ──────────
function playPing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch (_) {}
}

// ── Request browser notification permission ───────────────────────────────────
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

function showBrowserNotif(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/favicon.ico', tag: 'uncut-chat' })
    } catch (_) {}
  }
}

function Avatar({ url, name, size = 28 }) {
  const initials = (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: url ? 'transparent' : 'var(--bronze)',
      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, color: '#fff', fontWeight: 600, fontFamily: 'var(--font)',
      border: '1px solid var(--border)',
    }}>
      {url
        ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </div>
  )
}

function fmtTime(ts) {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// null = group chat, userId = DM with that user
const GROUP = null

export default function ChatBox() {
  const { profile } = useAuth()
  const [open, setOpen]             = useState(false)
  const notifReady = useRef(false)
  const [messages, setMessages]     = useState([])   // all messages loaded
  const [users, setUsers]           = useState({})   // id → { full_name, avatar_url (signed) }
  const [onlineIds, setOnlineIds]   = useState(new Set())
  const [activeConvo, setActiveConvo] = useState(GROUP) // null = team, userId = DM
  const [input, setInput]           = useState('')
  const [sending, setSending]       = useState(false)
  const [editingId, setEditingId]   = useState(null)
  const [editDraft, setEditDraft]   = useState('')
  const [unread, setUnread]         = useState({})   // { GROUP: n, userId: n }
  const bottomRef  = useRef(null)
  const channelRef = useRef(null)

  // ── Load users + signed avatar URLs ──────────────────────────────────────
  useEffect(() => {
    supabase.from('users').select('id, full_name, avatar_url').then(async ({ data }) => {
      if (!data) return
      const map = {}
      await Promise.all(data.map(async u => {
        let signedUrl = null
        if (u.avatar_url) {
          const { data: sd } = await supabase.storage.from('tracks').createSignedUrl(u.avatar_url, 3600)
          signedUrl = sd?.signedUrl ?? null
        }
        map[u.id] = { ...u, avatar_url: signedUrl }
      }))
      setUsers(map)
    })
  }, [])

  // ── Load message history ──────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return
    supabase.from('chat_messages')
      .select('*')
      .or(`recipient_id.is.null,user_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data }) => { if (data) setMessages(data) })
  }, [profile?.id])

  // ── Realtime: messages + presence ────────────────────────────────────────
  useEffect(() => {
    if (!profile) return

    const ch = supabase.channel('chat-room', {
      config: { presence: { key: profile.id } },
    })

    ch.on('presence', { event: 'sync' }, () => {
      setOnlineIds(new Set(Object.keys(ch.presenceState())))
    })

    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, ({ new: msg }) => {
      // Only show messages relevant to me
      const isGroupMsg = msg.recipient_id === null
      const isDMToMe   = msg.recipient_id === profile.id
      const isDMFromMe = msg.user_id === profile.id
      if (!isGroupMsg && !isDMToMe && !isDMFromMe) return

      setMessages(prev => [...prev, msg])

      // Sound + browser notification for messages from others
      if (!isDMFromMe) {
        playPing()
        setUsers(currentUsers => {
          const senderName = currentUsers[msg.user_id]?.full_name ?? 'Someone'
          const convoLabel = isGroupMsg ? 'All Team' : 'Direct message'
          showBrowserNotif(`${senderName} — ${convoLabel}`, msg.content)
          return currentUsers
        })
      }

      if (!open) {
        const key = isGroupMsg ? 'group' : (isDMToMe ? msg.user_id : msg.recipient_id)
        setUnread(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }))
      } else {
        const msgConvoKey = isGroupMsg ? 'group' : (isDMToMe ? msg.user_id : null)
        const activeKey   = activeConvo === GROUP ? 'group' : activeConvo
        if (msgConvoKey && msgConvoKey !== activeKey) {
          setUnread(prev => ({ ...prev, [msgConvoKey]: (prev[msgConvoKey] ?? 0) + 1 }))
        }
      }
    })

    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, ({ new: msg }) => {
      setMessages(prev => prev.map(m => m.id === msg.id ? msg : m))
    })

    ch.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ user_id: profile.id, name: profile.full_name })
      }
    })

    channelRef.current = ch
    return () => { supabase.removeChannel(ch) }
  }, [profile?.id, open, activeConvo])

  // ── Scroll to bottom on open / new messages in active convo ──────────────
  useEffect(() => {
    if (open) {
      const activeKey = activeConvo === GROUP ? 'group' : activeConvo
      setUnread(prev => ({ ...prev, [activeKey]: 0 }))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [open, messages.length, activeConvo])

  // ── Filter messages for active conversation ───────────────────────────────
  const visibleMessages = messages.filter(m => {
    if (activeConvo === GROUP) return m.recipient_id === null
    // DM: messages between me and the other person
    return (m.user_id === profile?.id && m.recipient_id === activeConvo) ||
           (m.user_id === activeConvo && m.recipient_id === profile?.id)
  })

  // ── Send message ──────────────────────────────────────────────────────────
  async function sendMessage(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending || !profile) return
    setSending(true)
    setInput('')
    await supabase.from('chat_messages').insert({
      user_id: profile.id,
      content: text,
      recipient_id: activeConvo, // null = group, uuid = DM
    })
    setSending(false)
  }

  // ── Edit message ──────────────────────────────────────────────────────────
  async function saveEdit(id) {
    const text = editDraft.trim()
    if (!text) return
    await supabase.from('chat_messages')
      .update({ content: text, is_edited: true, edited_at: new Date().toISOString() })
      .eq('id', id)
    setEditingId(null)
    setEditDraft('')
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const otherUsers    = Object.values(users).filter(u => u.id !== profile?.id)
  const totalUnread   = Object.values(unread).reduce((a, b) => a + b, 0)
  const activeLabel   = activeConvo === GROUP
    ? 'All Team'
    : (users[activeConvo]?.full_name ?? '…')

  return (
    <div style={s.wrapper}>

      {/* ── Toggle button ── */}
      <button style={s.toggleBtn} onClick={() => { setOpen(o => !o); requestNotifPermission(); notifReady.current = true }}>
        <span style={{ fontSize: '16px' }}>💬</span>
        {!open && totalUnread > 0 && <span style={s.badge}>{totalUnread}</span>}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div style={s.panel}>

          {/* Header */}
          <div style={s.panelHeader}>
            <span style={s.panelTitle}>
              {activeConvo !== GROUP && (
                <button style={s.backBtn} onClick={() => setActiveConvo(GROUP)}>←</button>
              )}
              {activeLabel}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={s.greenDot} />{onlineIds.size} online
              </span>
              <button style={s.closeBtn} onClick={() => setOpen(false)}>✕</button>
            </div>
          </div>

          {/* Conversation list */}
          {activeConvo === GROUP && (
            <div style={s.convoList}>
              {/* All Team */}
              <button
                style={{ ...s.convoBtn, background: activeConvo === GROUP ? 'var(--surface-2)' : 'transparent' }}
                onClick={() => { setActiveConvo(GROUP); setUnread(p => ({ ...p, group: 0 })) }}
              >
                <div style={s.convoAvatar}>
                  <span style={{ fontSize: '14px' }}>👥</span>
                </div>
                <div style={s.convoInfo}>
                  <span style={s.convoName}>All Team</span>
                  <span style={s.convoSub}>Everyone sees this</span>
                </div>
                {(unread['group'] ?? 0) > 0 && <span style={s.unreadDot}>{unread['group']}</span>}
              </button>

              <div style={s.convoDivider}>direct messages</div>

              {/* DM per person */}
              {otherUsers.map(u => {
                const isOnline = onlineIds.has(u.id)
                const uUnread  = unread[u.id] ?? 0
                return (
                  <button
                    key={u.id}
                    style={{ ...s.convoBtn, background: activeConvo === u.id ? 'var(--surface-2)' : 'transparent' }}
                    onClick={() => { setActiveConvo(u.id); setUnread(p => ({ ...p, [u.id]: 0 })) }}
                  >
                    <div style={{ position: 'relative' }}>
                      <Avatar url={u.avatar_url} name={u.full_name} size={32} />
                      {isOnline && <span style={s.onlinePip} />}
                    </div>
                    <div style={s.convoInfo}>
                      <span style={s.convoName}>{u.full_name ?? u.id}</span>
                      <span style={s.convoSub}>{isOnline ? 'online' : 'offline'}</span>
                    </div>
                    {uUnread > 0 && <span style={s.unreadDot}>{uUnread}</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* Messages (only when in a conversation) */}
          {activeConvo !== GROUP || true ? (
            activeConvo !== GROUP ? (
              <>
                <div style={s.messages}>
                  {visibleMessages.length === 0 && (
                    <div style={s.empty}>no messages yet with {users[activeConvo]?.full_name?.split(' ')[0] ?? '…'}</div>
                  )}
                  {visibleMessages.map(msg => {
                    const sender  = users[msg.user_id]
                    const isMe    = msg.user_id === profile?.id
                    const isEditing = editingId === msg.id
                    return (
                      <MessageRow key={msg.id} msg={msg} sender={sender} isMe={isMe}
                        isEditing={isEditing} editDraft={editDraft} setEditDraft={setEditDraft}
                        onEdit={() => { setEditingId(msg.id); setEditDraft(msg.content) }}
                        onSaveEdit={() => saveEdit(msg.id)}
                        onCancelEdit={() => setEditingId(null)} />
                    )
                  })}
                  <div ref={bottomRef} />
                </div>
                <InputRow input={input} setInput={setInput} onSend={sendMessage} sending={sending} />
              </>
            ) : (
              <>
                <div style={s.messages}>
                  {visibleMessages.length === 0 && (
                    <div style={s.empty}>no team messages yet — say hello 👋</div>
                  )}
                  {visibleMessages.map(msg => {
                    const sender  = users[msg.user_id]
                    const isMe    = msg.user_id === profile?.id
                    const isEditing = editingId === msg.id
                    return (
                      <MessageRow key={msg.id} msg={msg} sender={sender} isMe={isMe}
                        isEditing={isEditing} editDraft={editDraft} setEditDraft={setEditDraft}
                        onEdit={() => { setEditingId(msg.id); setEditDraft(msg.content) }}
                        onSaveEdit={() => saveEdit(msg.id)}
                        onCancelEdit={() => setEditingId(null)} />
                    )
                  })}
                  <div ref={bottomRef} />
                </div>
                <InputRow input={input} setInput={setInput} onSend={sendMessage} sending={sending} />
              </>
            )
          ) : null}

        </div>
      )}
    </div>
  )
}

function MessageRow({ msg, sender, isMe, isEditing, editDraft, setEditDraft, onEdit, onSaveEdit, onCancelEdit }) {
  return (
    <div style={{ ...s.msgRow, flexDirection: isMe ? 'row-reverse' : 'row' }}>
      <Avatar url={sender?.avatar_url} name={sender?.full_name} size={28} />
      <div style={{ ...s.bubble, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
        <div style={s.msgMeta}>
          {!isMe && <span style={s.msgName}>{sender?.full_name ?? 'Unknown'}</span>}
          <span style={s.msgTime}>{fmtTime(msg.created_at)}</span>
          {msg.is_edited && <span style={s.editedTag}>edited</span>}
        </div>
        {isEditing ? (
          <div style={s.editWrap}>
            <textarea style={s.editInput} value={editDraft} onChange={e => setEditDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSaveEdit() } if (e.key === 'Escape') onCancelEdit() }}
              autoFocus />
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <button style={s.editSaveBtn} onClick={onSaveEdit}>save</button>
              <button style={s.editCancelBtn} onClick={onCancelEdit}>cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
            <div style={{ ...s.msgContent, background: isMe ? 'var(--bronze)' : 'var(--surface-2)', color: isMe ? '#fff' : 'var(--text)' }}>
              {msg.content}
            </div>
            {isMe && <button style={s.editBtn} onClick={onEdit} title="Edit">✎</button>}
          </div>
        )}
      </div>
    </div>
  )
}

function InputRow({ input, setInput, onSend, sending }) {
  return (
    <form style={s.inputRow} onSubmit={onSend}>
      <input style={s.textInput} placeholder="message…" value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }} />
      <button type="submit" style={s.sendBtn} disabled={!input.trim() || sending}>↑</button>
    </form>
  )
}

const s = {
  wrapper:      { position: 'fixed', bottom: '24px', right: '24px', zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' },
  toggleBtn:    { width: '48px', height: '48px', background: 'var(--bronze)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' },
  badge:        { position: 'absolute', top: '6px', right: '6px', background: '#b84040', color: '#fff', fontSize: '10px', fontWeight: 700, width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font)' },
  panel:        { width: '340px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', maxHeight: '540px' },
  panelHeader:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 },
  panelTitle:   { fontSize: '11px', letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' },
  backBtn:      { background: 'none', border: 'none', color: 'var(--bronze)', cursor: 'pointer', fontSize: '14px', padding: 0, fontFamily: 'var(--font)' },
  greenDot:     { width: '7px', height: '7px', background: '#4a9a4a', borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  onlinePip:    { position: 'absolute', bottom: '1px', right: '1px', width: '8px', height: '8px', background: '#4a9a4a', borderRadius: '50%', border: '1px solid var(--surface)' },
  closeBtn:     { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', padding: 0 },
  convoList:    { display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: '420px', flexShrink: 0 },
  convoBtn:     { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font)' },
  convoAvatar:  { width: '32px', height: '32px', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 },
  convoInfo:    { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 },
  convoName:    { fontSize: '12px', fontWeight: 500, color: 'var(--text)', letterSpacing: '0.02em' },
  convoSub:     { fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.04em' },
  convoDivider: { fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 16px 4px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' },
  unreadDot:    { background: 'var(--bronze)', color: '#fff', fontSize: '10px', fontWeight: 700, minWidth: '18px', height: '18px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', fontFamily: 'var(--font)' },
  messages:     { flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '160px', maxHeight: '340px' },
  empty:        { fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' },
  msgRow:       { display: 'flex', gap: '8px', alignItems: 'flex-start' },
  bubble:       { display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '220px' },
  msgMeta:      { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  msgName:      { fontSize: '11px', fontWeight: 600, color: 'var(--text)' },
  msgTime:      { fontSize: '10px', color: 'var(--text-muted)' },
  editedTag:    { fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' },
  msgContent:   { fontSize: '12px', padding: '7px 10px', lineHeight: 1.5, wordBreak: 'break-word' },
  editBtn:      { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', padding: '2px 4px', opacity: 0.6, fontFamily: 'var(--font)', marginTop: '4px' },
  editWrap:     { display: 'flex', flexDirection: 'column' },
  editInput:    { background: 'var(--bg)', border: '1px solid var(--bronze)', padding: '6px 8px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', resize: 'none', outline: 'none', width: '200px', lineHeight: 1.5 },
  editSaveBtn:  { background: 'var(--bronze)', color: '#fff', border: 'none', padding: '3px 10px', fontSize: '10px', cursor: 'pointer', fontFamily: 'var(--font)' },
  editCancelBtn:{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '3px 10px', fontSize: '10px', cursor: 'pointer', fontFamily: 'var(--font)' },
  inputRow:     { display: 'flex', borderTop: '1px solid var(--border)', padding: '10px 12px', gap: '8px', alignItems: 'center', flexShrink: 0 },
  textInput:    { flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none' },
  sendBtn:      { background: 'var(--bronze)', color: '#fff', border: 'none', width: '32px', height: '32px', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
}
