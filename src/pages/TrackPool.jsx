import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function AddTrackModal({ onClose, onCreated }) {
  const { profile } = useAuth()
  const [title, setTitle]   = useState('')
  const [artist, setArtist] = useState('')
  const [notes, setNotes]   = useState('')
  const [error, setError]   = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !artist.trim()) return
    setSaving(true)
    setError(null)

    const { data, error } = await supabase
      .from('tracks')
      .insert({ title: title.trim(), artist: artist.trim(), notes: notes.trim() || null, submitted_by: profile?.id })
      .select()
      .single()

    if (error) { setError(error.message); setSaving(false); return }
    onCreated(data)
    onClose()
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>add track</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>track title</label>
          <input style={s.input} value={title} onChange={e => setTitle(e.target.value)} required autoFocus />

          <label style={s.label}>artist</label>
          <input style={s.input} value={artist} onChange={e => setArtist(e.target.value)} required />

          <label style={s.label}>notes <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
          <textarea style={{ ...s.input, resize: 'vertical', minHeight: '72px' }} value={notes} onChange={e => setNotes(e.target.value)} />

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={saving} style={s.submitBtn}>
            {saving ? 'adding...' : 'add track'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function TrackPool() {
  const { profile } = useAuth()
  const [tracks, setTracks]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const isCoordinator = !profile || profile.role === 'coordinator'
  const canEdit = isCoordinator || profile?.role === 'selector'

  useEffect(() => { fetchTracks() }, [])

  async function fetchTracks() {
    const { data, error } = await supabase
      .from('tracks')
      .select('*, submitter:submitted_by(full_name, email)')
      .order('created_at', { ascending: false })
    if (!error) setTracks(data)
    setLoading(false)
  }

  async function toggleCleared(track) {
    const { error } = await supabase
      .from('tracks')
      .update({ cleared: !track.cleared })
      .eq('id', track.id)
    if (!error) {
      setTracks(prev => prev.map(t => t.id === track.id ? { ...t, cleared: !t.cleared } : t))
    }
  }

  function handleCreated(track) {
    setTracks(prev => [track, ...prev])
  }

  const visible = tracks.filter(t => {
    if (filter === 'cleared' && !t.cleared) return false
    if (filter === 'uncleared' && t.cleared) return false
    if (search) {
      const q = search.toLowerCase()
      return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.pageTitle}>TRACK POOL</span>
        <div style={s.headerRight}>
          <input
            style={s.search}
            placeholder="search title or artist..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={s.filters}>
            {['all', 'cleared', 'uncleared'].map(f => (
              <button
                key={f}
                style={{ ...s.filterBtn, ...(filter === f ? s.filterActive : {}) }}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          {canEdit && (
            <button style={s.addBtn} onClick={() => setShowModal(true)}>+ add track</button>
          )}
        </div>
      </div>

      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.empty}>loading...</div>
        ) : visible.length === 0 ? (
          <div style={s.empty}>no tracks{filter !== 'all' ? ` matching "${filter}"` : ''}</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>title</th>
                <th style={s.th}>artist</th>
                <th style={s.th}>added</th>
                <th style={s.th}>notes</th>
                <th style={{ ...s.th, textAlign: 'center' }}>cleared</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((track, i) => (
                <tr key={track.id} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)' }}>
                  <td style={s.td}>{track.title}</td>
                  <td style={s.td}>{track.artist}</td>
                  <td style={{ ...s.td, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(track.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                  <td style={{ ...s.td, color: 'var(--text-muted)', maxWidth: '240px' }}>
                    {track.notes ?? '—'}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    {canEdit ? (
                      <button
                        style={{ ...s.clearedBtn, ...(track.cleared ? s.clearedOn : s.clearedOff) }}
                        onClick={() => toggleCleared(track)}
                        title={track.cleared ? 'mark uncleared' : 'mark cleared'}
                      >
                        {track.cleared ? 'cleared' : 'uncleared'}
                      </button>
                    ) : (
                      <span style={track.cleared ? s.clearedOn : s.clearedOff}>
                        {track.cleared ? 'cleared' : 'uncleared'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={s.footer}>
        {tracks.length} tracks total · {tracks.filter(t => t.cleared).length} cleared · {tracks.filter(t => !t.cleared).length} uncleared
      </div>

      {showModal && (
        <AddTrackModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 48px)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid var(--border)',
    flexWrap: 'wrap',
    gap: '12px',
  },
  pageTitle: {
    fontSize: '11px',
    letterSpacing: '0.12em',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  search: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    padding: '7px 12px',
    color: 'var(--text)',
    fontSize: '12px',
    fontFamily: 'var(--font)',
    width: '220px',
    outline: 'none',
  },
  filters: {
    display: 'flex',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  filterBtn: {
    background: 'var(--surface)',
    border: 'none',
    borderRight: '1px solid var(--border)',
    padding: '7px 12px',
    fontSize: '11px',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  filterActive: {
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontWeight: 500,
  },
  addBtn: {
    background: 'var(--bronze)',
    color: '#fff',
    border: 'none',
    padding: '7px 14px',
    fontSize: '12px',
    letterSpacing: '0.05em',
    cursor: 'pointer',
  },
  tableWrap: {
    flex: 1,
    overflowY: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    fontSize: '10px',
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    fontWeight: 500,
    textAlign: 'left',
    padding: '10px 16px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    position: 'sticky',
    top: 0,
    textTransform: 'uppercase',
  },
  td: {
    fontSize: '12px',
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text)',
    verticalAlign: 'top',
  },
  clearedBtn: {
    border: '1px solid',
    padding: '2px 8px',
    fontSize: '10px',
    letterSpacing: '0.05em',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
    background: 'none',
  },
  clearedOn: {
    color: 'var(--bronze)',
    borderColor: 'var(--bronze-dim)',
    background: '#f5ede0',
  },
  clearedOff: {
    color: 'var(--text-muted)',
    borderColor: 'var(--border)',
  },
  empty: {
    padding: '48px 24px',
    color: 'var(--text-muted)',
    fontSize: '12px',
    letterSpacing: '0.06em',
  },
  footer: {
    padding: '10px 24px',
    fontSize: '11px',
    color: 'var(--text-muted)',
    borderTop: '1px solid var(--border)',
    background: 'var(--surface)',
    letterSpacing: '0.04em',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(42, 37, 32, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    width: '100%',
    maxWidth: '400px',
    padding: '32px',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  modalTitle: {
    fontSize: '12px',
    letterSpacing: '0.08em',
    fontWeight: 500,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '14px',
    cursor: 'pointer',
    padding: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    letterSpacing: '0.06em',
    marginTop: '10px',
  },
  input: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    padding: '9px 12px',
    color: 'var(--text)',
    outline: 'none',
    width: '100%',
    fontFamily: 'var(--font)',
    fontSize: '13px',
  },
  error: {
    fontSize: '11px',
    color: '#b84040',
    marginTop: '6px',
  },
  submitBtn: {
    marginTop: '20px',
    background: 'var(--bronze)',
    color: '#fff',
    border: 'none',
    padding: '11px',
    letterSpacing: '0.06em',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
  },
}
