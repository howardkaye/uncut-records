import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import WaveSurfer from 'wavesurfer.js'
import MusicTempo from 'music-tempo'
import { seedChecklistForRelease } from '../lib/seedChecklist'

// ─── BPM detection ───────────────────────────────────────────────────────────
async function detectBPM(file) {
  return new Promise((resolve) => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) { resolve(null); return }
    const ctx = new AudioCtx()
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const buffer = await ctx.decodeAudioData(e.target.result)
        const audioData = []
        if (buffer.numberOfChannels >= 2) {
          const ch1 = buffer.getChannelData(0)
          const ch2 = buffer.getChannelData(1)
          for (let i = 0; i < ch1.length; i++) audioData.push((ch1[i] + ch2[i]) / 2)
        } else {
          const ch = buffer.getChannelData(0)
          for (let i = 0; i < ch.length; i++) audioData.push(ch[i])
        }
        const mt = new MusicTempo(audioData)
        resolve(Math.round(mt.tempo))
      } catch (_) { resolve(null) }
      finally { ctx.close() }
    }
    reader.onerror = () => resolve(null)
    reader.readAsArrayBuffer(file)
  })
}

const KEYS = [
  'C major','C# major','D major','D# major','E major','F major',
  'F# major','G major','G# major','A major','A# major','B major',
  'C minor','C# minor','D minor','D# minor','E minor','F minor',
  'F# minor','G minor','G# minor','A minor','A# minor','B minor',
]
const GENRES = [
  'Electronic','Hip-Hop','R&B','Pop','Dance','House','Techno',
  'Drum & Bass','Afrobeats','Reggaeton','Latin','Rock','Indie','Other',
]

function fmtTime(s) {
  if (!s && s !== 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return '1d ago'
  if (diff < 7) return `${diff}d ago`
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`
  return `${Math.floor(diff / 30)}mo ago`
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  new:       { label: 'New',       bg: 'var(--pink)',  color: 'var(--green)' },
  listening: { label: 'Listening', bg: 'var(--green)', color: '#fff'         },
  hold:      { label: 'Hold',      bg: '#e8e0dc',      color: 'var(--green)' },
  pass:      { label: 'Pass',      bg: '#f0f0f0',      color: '#888'         },
  selected:  { label: 'Selected',  bg: 'var(--green)', color: '#fff'         },
}

// ─── Bottom audio player ──────────────────────────────────────────────────────
function BottomPlayer({ track, onClose, onSelect, onHold, onPass, sending }) {
  const waveRef   = useRef(null)
  const wsRef     = useRef(null)
  const [playing,  setPlaying]  = useState(false)
  const [ready,    setReady]    = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const isInPipeline = track?.cleared || (Array.isArray(track?.releases) && track?.releases?.length > 0)

  useEffect(() => {
    if (!track?.file_url) return
    let destroyed = false
    setPlaying(false); setReady(false); setLoading(true); setCurrentTime(0); setDuration(0)
    if (wsRef.current) { wsRef.current.destroy(); wsRef.current = null }

    supabase.storage.from('tracks').createSignedUrl(track.file_url, 3600).then(({ data }) => {
      if (destroyed || !data?.signedUrl || !waveRef.current) return
      const ws = WaveSurfer.create({
        container: waveRef.current,
        waveColor: 'rgba(245,197,184,0.5)',
        progressColor: '#F5C5B8',
        cursorColor: '#F5C5B8',
        height: 40,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
      })
      ws.load(data.signedUrl)
      ws.on('ready',      () => { if (!destroyed) { setReady(true); setLoading(false); setDuration(ws.getDuration()) } })
      ws.on('timeupdate', t  => { if (!destroyed) setCurrentTime(t) })
      ws.on('finish',     ()  => { if (!destroyed) setPlaying(false) })
      wsRef.current = ws
    })
    return () => {
      destroyed = true
      if (wsRef.current) { wsRef.current.destroy(); wsRef.current = null }
    }
  }, [track?.id, track?.file_url])

  function togglePlay() {
    if (!wsRef.current || !ready) return
    wsRef.current.playPause()
    setPlaying(p => !p)
  }

  if (!track) return null

  return (
    <div style={s.player}>
      {/* Play button */}
      <button onClick={togglePlay} disabled={!ready} style={s.playerPlayBtn}>
        {loading ? '·' : playing ? '⏸' : '▶'}
      </button>

      {/* Track info */}
      <div style={s.playerInfo}>
        <div style={s.playerTitle}>{track.artist} — {track.title}</div>
        <div style={s.playerMeta}>
          {[track.bpm && `${track.bpm} BPM`, track.track_key, track.track_length].filter(Boolean).join(' · ')}
        </div>
      </div>

      {/* Waveform */}
      <div style={s.playerWave}>
        <div ref={waveRef} style={{ flex: 1 }} />
        <span style={s.playerTime}>{fmtTime(currentTime)} / {fmtTime(duration)}</span>
      </div>

      {/* Actions */}
      <div style={s.playerActions}>
        {!isInPipeline && (
          <button style={s.btnSelect} onClick={onSelect} disabled={sending}>
            {sending ? '…' : 'Select'}
          </button>
        )}
        {isInPipeline && (
          <span style={{ ...s.btnSelect, opacity: 0.5, cursor: 'default' }}>In Pipeline</span>
        )}
        <button style={s.btnHold} onClick={onHold}>Hold</button>
        <button style={s.btnPass} onClick={onPass}>Pass</button>
      </div>

      {/* Close */}
      <button onClick={onClose} style={s.playerClose}>✕</button>
    </div>
  )
}

// ─── Upload modal ─────────────────────────────────────────────────────────────
function TrackFormModal({ onClose, onSaved, initialTrack }) {
  const { profile } = useAuth()
  const isEdit = !!initialTrack

  const [form, setForm] = useState({
    title:           initialTrack?.title           ?? '',
    artist:          initialTrack?.artist          ?? '',
    featured_artist: initialTrack?.featured_artist ?? '',
    writers:         initialTrack?.writers         ?? '',
    splits:          initialTrack?.splits          ?? '',
    producers:       initialTrack?.producers       ?? '',
    ownership:       initialTrack?.ownership       ?? 'needs_permission',
    bpm:             initialTrack?.bpm             != null ? String(initialTrack.bpm) : '',
    track_key:       initialTrack?.track_key       ?? '',
    track_length:    initialTrack?.track_length    ?? '',
    genre:           initialTrack?.genre           ?? '',
    is_explicit:     initialTrack?.is_explicit     ?? false,
    notes:           initialTrack?.notes           ?? '',
    contact_info:    initialTrack?.contact_info    ?? profile?.full_name ?? '',
  })

  const [file, setFile]                     = useState(null)
  const [instrumental, setInstrumental]     = useState(null)
  const [tiktokAudio, setTiktokAudio]       = useState(null)
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState(null)

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function uploadFile(fileObj, folder) {
    const ext = fileObj.name.split('.').pop()
    const path = `${folder}/${crypto.randomUUID()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('tracks').upload(path, fileObj, { contentType: fileObj.type })
    if (uploadErr) throw new Error(uploadErr.message || 'Upload failed')
    return path
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true); setError(null)
    try {
      let file_url         = initialTrack?.file_url         ?? null
      let instrumental_url = initialTrack?.instrumental_url ?? null
      let tiktok_audio_url = initialTrack?.tiktok_audio_url ?? null
      if (file)         file_url         = await uploadFile(file, 'uncleared')
      if (instrumental) instrumental_url = await uploadFile(instrumental, 'uncleared/instrumental')
      if (tiktokAudio)  tiktok_audio_url = await uploadFile(tiktokAudio, 'uncleared/tiktok')

      const payload = {
        title: form.title.trim(), artist: form.artist.trim() || 'TBC',
        featured_artist: form.featured_artist.trim() || null,
        writers: form.writers.trim(), splits: form.splits.trim() || null,
        producers: form.producers.trim() || null, ownership: form.ownership,
        bpm: form.bpm ? parseInt(form.bpm) : null, track_key: form.track_key || null,
        track_length: form.track_length.trim() || null, genre: form.genre || null,
        is_explicit: form.is_explicit, notes: form.notes.trim() || null,
        contact_info: form.contact_info.trim() || null,
        file_url, instrumental_url, tiktok_audio_url,
      }

      if (isEdit) {
        const { data, error: updateErr } = await supabase.from('tracks').update(payload).eq('id', initialTrack.id).select().single()
        if (updateErr) throw new Error(updateErr.message)
        onSaved(data)
      } else {
        payload.submitted_by = profile?.id
        const { data, error: insertErr } = await supabase.from('tracks').insert(payload).select().single()
        if (insertErr) throw new Error(insertErr.message)
        onSaved(data)
      }
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div style={m.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={m.modal}>
        <div style={m.header}>
          <span style={m.title}>{isEdit ? 'Edit Track' : 'Upload Track'}</span>
          <button style={m.close} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={m.form}>

          {['Track file', 'Instrumental', 'TikTok audio'].map((label, i) => {
            const fileState   = [file, instrumental, tiktokAudio][i]
            const setFileState = [setFile, setInstrumental, setTiktokAudio][i]
            const hasExisting = i === 0 ? initialTrack?.file_url : i === 1 ? initialTrack?.instrumental_url : initialTrack?.tiktok_audio_url
            const optional = i > 0

            return (
              <div key={label} style={{ marginBottom: '10px' }}>
                <div style={m.label}>{label}{optional && <span style={{ color: 'var(--text-muted)' }}> (optional)</span>}{hasExisting && <span style={{ color: 'var(--green)', marginLeft: '6px', fontSize: '11px' }}>✓ uploaded</span>}</div>
                <label style={m.fileBtn}>
                  <input type="file" accept=".wav,.mp3,.aiff,.flac,.m4a,.aac" style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files[0]
                      if (!f) return
                      setFileState(f)
                      if (i === 0) {
                        if (!form.title.trim()) {
                          set('title', f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim())
                        }
                        const audio = new Audio()
                        const url = URL.createObjectURL(f)
                        audio.onloadedmetadata = () => {
                          URL.revokeObjectURL(url)
                          const total = Math.round(audio.duration)
                          set('track_length', `${Math.floor(total/60)}:${(total%60).toString().padStart(2,'0')}`)
                        }
                        audio.onerror = () => URL.revokeObjectURL(url)
                        audio.src = url
                        set('bpm', '')
                        detectBPM(f).then(bpm => { if (bpm) set('bpm', String(bpm)) })
                      }
                    }}
                  />
                  {fileState ? fileState.name : '+ Choose file'}
                </label>
              </div>
            )
          })}

          <div style={m.divider} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={m.label}>Track Title *</div>
              <input style={m.input} value={form.title} onChange={e => set('title', e.target.value)} required />
            </div>
            <div>
              <div style={m.label}>Artist</div>
              <input style={m.input} placeholder="TBC if unknown" value={form.artist} onChange={e => set('artist', e.target.value)} />
            </div>
            <div>
              <div style={m.label}>Featured Artist</div>
              <input style={m.input} placeholder="Optional" value={form.featured_artist} onChange={e => set('featured_artist', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={m.label}>Writers (full legal names)</div>
              <input style={m.input} placeholder="e.g. John Smith, Jane Doe" value={form.writers} onChange={e => set('writers', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={m.label}>Splits</div>
              <input style={m.input} placeholder="e.g. 50/50" value={form.splits} onChange={e => set('splits', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={m.label}>Producers</div>
              <input style={m.input} value={form.producers} onChange={e => set('producers', e.target.value)} />
            </div>
            <div>
              <div style={m.label}>BPM {file && !form.bpm && <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>detecting…</span>}</div>
              <input style={m.input} type="number" value={form.bpm} onChange={e => set('bpm', e.target.value)} placeholder="auto-detected" />
            </div>
            <div>
              <div style={m.label}>Key</div>
              <select style={m.input} value={form.track_key} onChange={e => set('track_key', e.target.value)}>
                <option value="">—</option>
                {KEYS.map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <div style={m.label}>Length</div>
              <input style={m.input} placeholder="3:24" value={form.track_length} onChange={e => set('track_length', e.target.value)} />
            </div>
            <div>
              <div style={m.label}>Genre</div>
              <select style={m.input} value={form.genre} onChange={e => set('genre', e.target.value)}>
                <option value="">—</option>
                {GENRES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div style={m.divider} />

          <div style={m.label}>Ownership</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {['needs_permission', '100_owned'].map(o => (
              <button key={o} type="button" style={{ ...m.toggle, ...(form.ownership === o ? m.toggleActive : {}) }} onClick={() => set('ownership', o)}>
                {o === '100_owned' ? '100% owned' : 'Needs permission'}
              </button>
            ))}
          </div>

          <div style={m.label}>Explicit?</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {[['Yes', true], ['No', false]].map(([lbl, val]) => (
              <button key={lbl} type="button" style={{ ...m.toggle, ...(form.is_explicit === val ? m.toggleActive : {}) }} onClick={() => set('is_explicit', val)}>
                {lbl}
              </button>
            ))}
          </div>

          <div style={m.label}>Contact info</div>
          <input style={{ ...m.input, marginBottom: '10px' }} placeholder="Who submitted this?" value={form.contact_info} onChange={e => set('contact_info', e.target.value)} />

          <div style={m.label}>Notes</div>
          <textarea style={{ ...m.input, minHeight: '60px', resize: 'vertical', marginBottom: '16px' }} value={form.notes} onChange={e => set('notes', e.target.value)} />

          {error && <p style={{ fontSize: '11px', color: '#b84040', marginBottom: '10px' }}>{error}</p>}
          <button type="submit" disabled={saving} style={m.submit}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Track'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Main TrackPool ───────────────────────────────────────────────────────────
export default function TrackPool() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [tracks, setTracks]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal]       = useState(false)
  const [editTrack, setEditTrack]       = useState(null)
  const [sending, setSending]           = useState(null)
  const [pipelineConfirm, setPipelineConfirm] = useState(null)
  const [activeTrack, setActiveTrack]   = useState(null)
  const [deleting, setDeleting]         = useState(null)
  const isCoordinator = !profile || profile.role === 'coordinator'

  useEffect(() => { fetchTracks() }, [])

  async function fetchTracks() {
    const { data } = await supabase
      .from('tracks')
      .select('*, releases(id, artwork_url)')
      .order('created_at', { ascending: false })
    setTracks(data ?? [])
    setLoading(false)
  }

  const isInPipeline = t => t.cleared || (Array.isArray(t.releases) && t.releases.length > 0)

  function getStatus(t) {
    if (isInPipeline(t)) return 'selected'
    return t.track_status ?? 'new'
  }

  async function updateStatus(track, status) {
    const { error } = await supabase.from('tracks').update({ track_status: status }).eq('id', track.id)
    if (!error) setTracks(prev => prev.map(t => t.id === track.id ? { ...t, track_status: status } : t))
  }

  async function sendToPipeline(track) {
    setSending(track.id)
    setPipelineConfirm(null)
    const { error: trackErr } = await supabase.from('tracks').update({ cleared: true }).eq('id', track.id)
    if (trackErr) { setSending(null); return }
    const { data: release } = await supabase.from('releases')
      .insert({ track_id: track.id, stage: 'intake', coordinator_id: profile?.id })
      .select('id').single()
    if (release) await seedChecklistForRelease(release.id)
    setSending(null)
    setTracks(prev => prev.map(t => t.id === track.id ? { ...t, cleared: true } : t))
    if (activeTrack?.id === track.id) setActiveTrack(prev => ({ ...prev, cleared: true }))
    navigate('/pipeline')
  }

  async function deleteTrack(track) {
    setDeleting(track.id)
    const { data: releases } = await supabase.from('releases').select('id').eq('track_id', track.id)
    const ids = releases?.map(r => r.id) ?? []
    if (ids.length > 0) {
      await supabase.from('performance_data').delete().in('release_id', ids)
      await supabase.from('tease_window_logs').delete().in('release_id', ids)
      await supabase.from('checklist_items').delete().in('release_id', ids)
      await supabase.from('releases').delete().in('id', ids)
    }
    if (track.file_url)         await supabase.storage.from('tracks').remove([track.file_url])
    if (track.instrumental_url) await supabase.storage.from('tracks').remove([track.instrumental_url])
    if (track.tiktok_audio_url) await supabase.storage.from('tracks').remove([track.tiktok_audio_url])
    await supabase.from('tracks').delete().eq('id', track.id)
    setTracks(prev => prev.filter(t => t.id !== track.id))
    if (activeTrack?.id === track.id) setActiveTrack(null)
    setDeleting(null)
  }

  // Count per status
  const counts = {
    all:       tracks.length,
    new:       tracks.filter(t => getStatus(t) === 'new').length,
    listening: tracks.filter(t => getStatus(t) === 'listening').length,
    hold:      tracks.filter(t => getStatus(t) === 'hold').length,
    pass:      tracks.filter(t => getStatus(t) === 'pass').length,
  }

  const filtered = tracks.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !q || [t.title, t.artist, t.genre, t.bpm?.toString(), t.track_key]
      .some(v => v?.toLowerCase().includes(q))
    const matchStatus = statusFilter === 'all' || getStatus(t) === statusFilter
    return matchSearch && matchStatus
  })

  const FILTER_TABS = [
    { key: 'all',       label: 'All' },
    { key: 'new',       label: 'New' },
    { key: 'listening', label: 'Listening' },
    { key: 'hold',      label: 'Hold' },
    { key: 'pass',      label: 'Pass' },
  ]

  if (loading) return <div style={s.loading}>Loading tracks…</div>

  return (
    <div style={{ ...s.page, paddingBottom: activeTrack ? '80px' : '0' }}>

      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.pageTitle}>TRACK POOL</div>
          {counts.new > 0 && (
            <span style={s.pageSuper}>INCOMING · {counts.new} UNHEARD</span>
          )}
        </div>
        <div style={s.headerRight}>
          <input
            style={s.search}
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {isCoordinator && (
            <button style={s.btnUpload} onClick={() => setShowModal(true)}>+ Upload</button>
          )}
        </div>
      </div>

      {/* ── Filter pills ── */}
      <div style={s.filters}>
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            style={{ ...s.filterPill, ...(statusFilter === key ? s.filterPillActive : {}) }}
            onClick={() => setStatusFilter(key)}
          >
            {label}{counts[key] > 0 && key !== 'all' ? ` ${counts[key]}` : key === 'all' ? '' : ''}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={s.sortLabel}>Sort: Newest</span>
      </div>

      {/* ── Table ── */}
      <div style={s.tableWrap}>
        {/* Header */}
        <div style={s.thead}>
          <div style={{ ...s.th, width: 52 }} />
          <div style={{ ...s.th, flex: '1 1 130px' }}>ARTIST</div>
          <div style={{ ...s.th, flex: '1.5 1 160px' }}>TITLE</div>
          <div style={{ ...s.th, width: 70, textAlign: 'center' }}>BPM</div>
          <div style={{ ...s.th, width: 90 }}>KEY</div>
          <div style={{ ...s.th, width: 60, textAlign: 'center' }}>LEN</div>
          <div style={{ ...s.th, flex: '1 1 100px' }}>TAGS</div>
          <div style={{ ...s.th, width: 90 }}>SUBMITTED</div>
          <div style={{ ...s.th, width: 100, textAlign: 'center' }}>STATUS</div>
          {isCoordinator && <div style={{ ...s.th, width: 60 }} />}
        </div>

        {/* Rows */}
        <div style={s.tbody}>
          {filtered.length === 0 && (
            <div style={s.empty}>No tracks found</div>
          )}
          {filtered.map(track => {
            const status = getStatus(track)
            const cfg    = STATUS[status] ?? STATUS.new
            const isActive = activeTrack?.id === track.id

            return (
              <div key={track.id}
                style={{ ...s.row, ...(isActive ? s.rowActive : {}), opacity: deleting === track.id ? 0.4 : 1 }}
                onClick={() => track.file_url && setActiveTrack(isActive ? null : track)}>

                {/* Play button */}
                <div style={{ ...s.td, width: 52, justifyContent: 'center' }}>
                  {track.file_url ? (
                    <div style={{ ...s.playBtn, ...(isActive ? s.playBtnActive : {}) }}>
                      {isActive ? '⏸' : '▶'}
                    </div>
                  ) : (
                    <div style={{ ...s.playBtn, opacity: 0.2, cursor: 'default' }}>▶</div>
                  )}
                </div>

                <div style={{ ...s.td, flex: '1 1 130px', fontWeight: 600 }}>{track.artist ?? '—'}</div>
                <div style={{ ...s.td, flex: '1.5 1 160px', fontWeight: 500 }}>{track.title}</div>
                <div style={{ ...s.td, width: 70, textAlign: 'center', color: 'var(--text-muted)' }}>{track.bpm ?? '—'}</div>
                <div style={{ ...s.td, width: 90, color: 'var(--text-muted)', fontSize: '12px' }}>{track.track_key ?? '—'}</div>
                <div style={{ ...s.td, width: 60, textAlign: 'center', color: 'var(--text-muted)' }}>{track.track_length ?? '—'}</div>
                <div style={{ ...s.td, flex: '1 1 100px', gap: '4px', flexWrap: 'wrap' }}>
                  {track.genre && (
                    <span style={s.tag}>{track.genre}</span>
                  )}
                  {track.is_explicit && <span style={s.explicitTag}>E</span>}
                </div>
                <div style={{ ...s.td, width: 90, fontSize: '12px', color: 'var(--text-muted)' }}>{timeAgo(track.created_at)}</div>

                {/* Status pill */}
                <div style={{ ...s.td, width: 100, justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                  <span style={{ ...s.statusPill, background: cfg.bg, color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>

                {/* Actions */}
                {isCoordinator && (
                  <div style={{ ...s.td, width: 60, gap: '4px', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                    <button style={s.iconBtn} onClick={() => setEditTrack(track)} title="Edit">✎</button>
                    <button style={s.iconBtn} onClick={() => deleteTrack(track)} disabled={deleting === track.id} title="Delete">×</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Bottom player ── */}
      {activeTrack && (
        <BottomPlayer
          track={activeTrack}
          sending={sending === activeTrack?.id}
          onClose={() => setActiveTrack(null)}
          onSelect={() => isCoordinator && setPipelineConfirm(activeTrack)}
          onHold={() => { updateStatus(activeTrack, 'hold'); setActiveTrack(prev => ({ ...prev, track_status: 'hold' })) }}
          onPass={() => { updateStatus(activeTrack, 'pass'); setActiveTrack(null) }}
        />
      )}

      {/* ── Upload modal ── */}
      {showModal && (
        <TrackFormModal onClose={() => setShowModal(false)} onSaved={t => setTracks(prev => [t, ...prev])} />
      )}
      {editTrack && (
        <TrackFormModal
          initialTrack={editTrack}
          onClose={() => setEditTrack(null)}
          onSaved={updated => { setTracks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t)); setEditTrack(null) }}
        />
      )}

      {/* ── Pipeline confirm ── */}
      {pipelineConfirm && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setPipelineConfirm(null)}>
          <div style={s.confirmBox}>
            <div style={s.confirmTitle}>Send to pipeline?</div>
            <div style={s.confirmBody}>
              <strong>{pipelineConfirm.title}</strong>
              {pipelineConfirm.artist && pipelineConfirm.artist !== 'TBC' ? ` by ${pipelineConfirm.artist}` : ''} will be marked as selected and added to the pipeline.
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={s.btnConfirm} onClick={() => sendToPipeline(pipelineConfirm)}>
                {sending ? '…' : 'Yes, select it'}
              </button>
              <button style={s.btnCancel} onClick={() => setPipelineConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  page:    { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden', background: '#fff' },
  loading: { padding: '48px 32px', color: 'var(--text-muted)', fontFamily: 'var(--font)' },

  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px 12px', gap: '16px' },
  headerLeft:  { display: 'flex', alignItems: 'baseline', gap: '20px' },
  headerRight: { display: 'flex', gap: '10px', alignItems: 'center' },
  pageTitle:   { fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, color: 'var(--green)', letterSpacing: '-0.01em', lineHeight: 1 },
  pageSuper:   { fontFamily: 'var(--font)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.06em' },

  search:    { background: '#fff', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '8px 18px', fontSize: '13px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none', width: '220px' },
  btnUpload: { background: '#fff', color: 'var(--green)', border: '1.5px solid var(--green)', borderRadius: 'var(--radius-pill)', padding: '8px 20px', fontSize: '13px', fontFamily: 'var(--font)', cursor: 'pointer', fontWeight: 500 },

  filters:        { display: 'flex', alignItems: 'center', gap: '8px', padding: '0 32px 16px', flexWrap: 'wrap' },
  filterPill:     { background: '#fff', color: 'var(--green)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '7px 18px', fontSize: '13px', fontFamily: 'var(--font)', cursor: 'pointer', transition: 'all 0.15s', fontWeight: 400 },
  filterPillActive: { background: 'var(--pink)', border: '1.5px solid var(--pink)', color: 'var(--green)', fontWeight: 600 },
  sortLabel:      { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font)' },

  tableWrap: { flex: 1, overflow: 'auto' },
  thead:     { display: 'flex', alignItems: 'center', padding: '0 32px', background: '#fff', borderBottom: '1.5px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 },
  th:        { fontFamily: 'var(--font)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '10px 8px', display: 'flex', alignItems: 'center', flexShrink: 0 },
  tbody:     { padding: '0 32px' },

  row:       { display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', minHeight: '52px', cursor: 'pointer', transition: 'background 0.1s' },
  rowActive: { background: 'rgba(245,197,184,0.15)' },
  td:        { fontFamily: 'var(--font)', fontSize: '13px', color: 'var(--text)', padding: '10px 8px', display: 'flex', alignItems: 'center', overflow: 'hidden', flexShrink: 0 },

  playBtn:       { width: 32, height: 32, borderRadius: '50%', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--green)', background: '#fff', cursor: 'pointer', flexShrink: 0 },
  playBtnActive: { background: 'var(--pink)', border: '1.5px solid var(--pink)', color: 'var(--green)' },

  tag:         { fontSize: '11px', padding: '2px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-2)', color: 'var(--green)', border: '1px solid var(--border)', whiteSpace: 'nowrap' },
  explicitTag: { fontSize: '10px', padding: '1px 6px', background: 'var(--green)', color: '#fff', borderRadius: '3px', fontWeight: 600 },
  statusPill:  { fontSize: '11px', padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font)', fontWeight: 500, whiteSpace: 'nowrap', cursor: 'default' },

  iconBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-muted)', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '13px', flexShrink: 0, fontFamily: 'var(--font)', padding: 0 },

  empty: { padding: '40px 8px', color: 'var(--text-muted)', fontFamily: 'var(--font)', fontSize: '14px' },

  // Bottom player
  player:       { position: 'fixed', bottom: 0, left: 0, right: 0, height: '72px', background: 'var(--green)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: '16px', zIndex: 200 },
  playerPlayBtn: { width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'var(--pink)', color: 'var(--green)', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontFamily: 'var(--font)', fontWeight: 700 },
  playerInfo:   { flexShrink: 0, minWidth: 0, maxWidth: 200 },
  playerTitle:  { fontFamily: 'var(--font)', fontSize: '13px', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  playerMeta:   { fontFamily: 'var(--font)', fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '1px' },
  playerWave:   { flex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 },
  playerTime:   { fontFamily: 'var(--font)', fontSize: '12px', color: 'rgba(255,255,255,0.7)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  playerActions: { display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 },
  playerClose:   { background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '16px', cursor: 'pointer', padding: '4px', flexShrink: 0 },

  btnSelect: { background: 'var(--pink)', color: 'var(--green)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '8px 20px', fontSize: '13px', fontFamily: 'var(--font)', cursor: 'pointer', fontWeight: 600 },
  btnHold:   { background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 'var(--radius-pill)', padding: '8px 16px', fontSize: '13px', fontFamily: 'var(--font)', cursor: 'pointer' },
  btnPass:   { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius-pill)', padding: '8px 16px', fontSize: '13px', fontFamily: 'var(--font)', cursor: 'pointer' },

  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
  confirmBox:  { background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '380px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  confirmTitle: { fontFamily: 'var(--font)', fontSize: '16px', fontWeight: 600, color: 'var(--green)', marginBottom: '10px' },
  confirmBody:  { fontFamily: 'var(--font)', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 },
  btnConfirm:  { flex: 1, background: 'var(--pink)', color: 'var(--green)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '12px 20px', fontSize: '13px', fontFamily: 'var(--font)', cursor: 'pointer', fontWeight: 600 },
  btnCancel:   { background: '#fff', color: 'var(--text-muted)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '12px 20px', fontSize: '13px', fontFamily: 'var(--font)', cursor: 'pointer' },
}

// Modal styles
const m = {
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 400, overflowY: 'auto', padding: '40px 24px' },
  modal:    { background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '32px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  header:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' },
  title:    { fontFamily: 'var(--font)', fontSize: '16px', fontWeight: 600, color: 'var(--green)' },
  close:    { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '16px', cursor: 'pointer', padding: 0 },
  form:     { display: 'flex', flexDirection: 'column' },
  label:    { fontFamily: 'var(--font)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', marginTop: '4px', display: 'block' },
  input:    { background: '#fff', border: '1.5px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text)', outline: 'none', width: '100%', fontFamily: 'var(--font)', fontSize: '13px' },
  divider:  { height: '1px', background: 'var(--border)', margin: '16px 0' },
  fileBtn:  { background: 'var(--surface-2)', border: '1.5px dashed var(--border)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', display: 'block', textAlign: 'center', fontFamily: 'var(--font)' },
  toggle:       { background: '#fff', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '7px 16px', fontSize: '12px', fontFamily: 'var(--font)', cursor: 'pointer', color: 'var(--text-muted)' },
  toggleActive: { background: 'var(--pink)', border: '1.5px solid var(--pink)', color: 'var(--green)', fontWeight: 600 },
  submit:   { background: 'var(--pink)', color: 'var(--green)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '14px', fontSize: '14px', fontFamily: 'var(--font)', cursor: 'pointer', fontWeight: 600, marginTop: '4px' },
}
