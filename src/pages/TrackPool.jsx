import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const KEYS = ['C','C#/Db','D','D#/Eb','E','F','F#/Gb','G','G#/Ab','A','A#/Bb','B']
const GENRES = ['Pop','Dance/Electronic','Hip-Hop/R&B','Afrobeats','Amapiano','House','Drill','Indie','Other']

function AddTrackModal({ onClose, onCreated }) {
  const { profile } = useAuth()
  const [form, setForm] = useState({
    title: '', writers: '', artist: '', producers: '',
    ownership: 'needs_permission', bpm: '', track_key: '',
    track_length: '', genre: '', contact_info: '', notes: '',
  })
  const [file, setFile]         = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError]       = useState(null)
  const [saving, setSaving]     = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.writers.trim()) return
    setSaving(true); setError(null)

    let file_url = null
    if (file) {
      setProgress('uploading audio...')
      const ext = file.name.split('.').pop()
      const path = `uncleared/${crypto.randomUUID()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('tracks').upload(path, file, { contentType: file.type })
      if (uploadErr) { setError(uploadErr.message); setSaving(false); setProgress(null); return }
      file_url = path
      setProgress(null)
    }

    const payload = {
      title:        form.title.trim(),
      artist:       form.artist.trim() || 'TBC',
      writers:      form.writers.trim(),
      producers:    form.producers.trim() || null,
      ownership:    form.ownership,
      bpm:          form.bpm ? parseInt(form.bpm) : null,
      track_key:    form.track_key || null,
      track_length: form.track_length.trim() || null,
      genre:        form.genre || null,
      contact_info: form.contact_info.trim() || null,
      notes:        form.notes.trim() || null,
      cleared:      false,
      file_url,
      submitted_by: profile?.id,
    }

    const { data, error } = await supabase.from('tracks').insert(payload).select().single()
    if (error) { setError(error.message); setSaving(false); return }
    onCreated(data)
    onClose()
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>add track to pool</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={s.form}>

          <div style={s.formGrid}>
            <div style={s.formCol}>
              <label style={s.label}>track title *</label>
              <input style={s.input} value={form.title} onChange={e => set('title', e.target.value)} required autoFocus />
            </div>
            <div style={s.formCol}>
              <label style={s.label}>artist name <span style={s.opt}>(or leave blank if TBC)</span></label>
              <input style={s.input} value={form.artist} onChange={e => set('artist', e.target.value)} placeholder="TBC" />
            </div>
          </div>

          <label style={s.label}>writer(s) *</label>
          <input style={s.input} value={form.writers} onChange={e => set('writers', e.target.value)} required placeholder="Full legal names, comma separated" />

          <label style={s.label}>producer(s) <span style={s.opt}>(optional)</span></label>
          <input style={s.input} value={form.producers} onChange={e => set('producers', e.target.value)} placeholder="Full legal names, comma separated" />

          <label style={s.label}>ownership *</label>
          <div style={s.toggleRow}>
            <button type="button"
              style={{ ...s.toggleBtn, ...(form.ownership === 'needs_permission' ? s.toggleActive : {}) }}
              onClick={() => set('ownership', 'needs_permission')}>
              needs permission to release
            </button>
            <button type="button"
              style={{ ...s.toggleBtn, ...(form.ownership === '100_owned' ? s.toggleActiveGreen : {}) }}
              onClick={() => set('ownership', '100_owned')}>
              100% owned
            </button>
          </div>

          <div style={s.formGrid}>
            <div style={s.formCol}>
              <label style={s.label}>BPM <span style={s.opt}>(optional)</span></label>
              <input style={s.input} type="number" min="60" max="200" value={form.bpm} onChange={e => set('bpm', e.target.value)} placeholder="e.g. 120" />
            </div>
            <div style={s.formCol}>
              <label style={s.label}>key <span style={s.opt}>(optional)</span></label>
              <select style={s.input} value={form.track_key} onChange={e => set('track_key', e.target.value)}>
                <option value="">—</option>
                {KEYS.map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div style={s.formCol}>
              <label style={s.label}>length <span style={s.opt}>(optional)</span></label>
              <input style={s.input} value={form.track_length} onChange={e => set('track_length', e.target.value)} placeholder="e.g. 2:45" />
            </div>
            <div style={s.formCol}>
              <label style={s.label}>genre <span style={s.opt}>(optional)</span></label>
              <select style={s.input} value={form.genre} onChange={e => set('genre', e.target.value)}>
                <option value="">—</option>
                {GENRES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <label style={s.label}>contact info <span style={s.opt}>(optional)</span></label>
          <input style={s.input} value={form.contact_info} onChange={e => set('contact_info', e.target.value)} placeholder="Email or @handle for writer/producer" />

          <label style={s.label}>audio file <span style={s.opt}>(optional — goes to uncleared folder)</span></label>
          <div style={s.fileWrap}>
            <label style={s.fileLabel}>
              <input type="file" accept=".mp3,.wav,.aiff,.aif,.flac,.m4a" style={{ display: 'none' }}
                onChange={e => setFile(e.target.files[0] ?? null)} />
              {file ? <span style={{ color: 'var(--text)' }}>✓ {file.name}</span> : <span>choose file...</span>}
            </label>
            {file && <button type="button" style={s.clearFile} onClick={() => setFile(null)}>✕</button>}
          </div>
          {progress && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{progress}</p>}

          <label style={s.label}>notes <span style={s.opt}>(optional)</span></label>
          <textarea style={{ ...s.input, resize: 'vertical', minHeight: '60px' }}
            value={form.notes} onChange={e => set('notes', e.target.value)} />

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={saving} style={s.submitBtn}>
            {saving ? (progress ?? 'adding...') : 'add to uncleared pool'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function TrackPool() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tracks, setTracks]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [genreFilter, setGenreFilter] = useState('all')
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [clearing, setClearing]   = useState(null)
  const isCoordinator = !profile || profile.role === 'coordinator'
  const canEdit = isCoordinator || profile?.role === 'selector'

  useEffect(() => { fetchTracks() }, [])

  async function fetchTracks() {
    const { data } = await supabase
      .from('tracks')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setTracks(data)
    setLoading(false)
  }

  async function toggleCleared(track) {
    const newCleared = !track.cleared
    setClearing(track.id)

    const { error } = await supabase
      .from('tracks').update({ cleared: newCleared }).eq('id', track.id)

    if (error) { setClearing(null); return }

    setTracks(prev => prev.map(t => t.id === track.id ? { ...t, cleared: newCleared } : t))

    // Auto-create a release in pre-release when a track is cleared
    if (newCleared) {
      const { data: release } = await supabase
        .from('releases')
        .insert({ track_id: track.id, stage: 'pre_release', coordinator_id: profile?.id })
        .select('id')
        .single()
      if (release) {
        // Navigate to the new release detail
        navigate(`/releases/${release.id}`)
      }
    }

    setClearing(null)
  }

  async function getFile(track) {
    const { data, error } = await supabase.storage
      .from('tracks').createSignedUrl(track.file_url, 3600)
    if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function handleCreated(track) { setTracks(prev => [track, ...prev]) }

  const allGenres = [...new Set(tracks.map(t => t.genre).filter(Boolean))]

  const visible = tracks.filter(t => {
    if (filter === 'cleared' && !t.cleared) return false
    if (filter === 'uncleared' && t.cleared) return false
    if (genreFilter !== 'all' && t.genre !== genreFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        t.title?.toLowerCase().includes(q) ||
        t.artist?.toLowerCase().includes(q) ||
        t.writers?.toLowerCase().includes(q) ||
        t.genre?.toLowerCase().includes(q) ||
        String(t.bpm ?? '').includes(q) ||
        t.track_key?.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.pageTitle}>TRACK POOL</span>
        <div style={s.headerRight}>
          <input style={s.search} placeholder="search title, artist, writer, BPM, key..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <div style={s.filters}>
            {['all', 'cleared', 'uncleared'].map(f => (
              <button key={f}
                style={{ ...s.filterBtn, ...(filter === f ? s.filterActive : {}) }}
                onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          {allGenres.length > 0 && (
            <div style={s.filters}>
              <button style={{ ...s.filterBtn, ...(genreFilter === 'all' ? s.filterActive : {}) }}
                onClick={() => setGenreFilter('all')}>all genres</button>
              {allGenres.map(g => (
                <button key={g}
                  style={{ ...s.filterBtn, ...(genreFilter === g ? s.filterActive : {}) }}
                  onClick={() => setGenreFilter(g)}>{g}</button>
              ))}
            </div>
          )}
          {canEdit && (
            <button style={s.addBtn} onClick={() => setShowModal(true)}>+ add track</button>
          )}
        </div>
      </div>

      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.empty}>loading...</div>
        ) : visible.length === 0 ? (
          <div style={s.empty}>no tracks found</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>title</th>
                <th style={s.th}>artist</th>
                <th style={s.th}>writer(s)</th>
                <th style={s.th}>ownership</th>
                <th style={s.th}>bpm / key</th>
                <th style={s.th}>genre</th>
                <th style={{ ...s.th, textAlign: 'center' }}>file</th>
                <th style={{ ...s.th, textAlign: 'center' }}>status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((track, i) => (
                <tr key={track.id} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)' }}>
                  <td style={s.td}><strong>{track.title}</strong></td>
                  <td style={s.td}>{track.artist === 'TBC' ? <span style={{ color: 'var(--text-muted)' }}>TBC</span> : track.artist}</td>
                  <td style={{ ...s.td, color: 'var(--text-muted)' }}>{track.writers ?? '—'}</td>
                  <td style={s.td}>
                    <span style={{
                      fontSize: '10px', padding: '2px 7px', border: '1px solid',
                      borderColor: track.ownership === '100_owned' ? '#a8c898' : 'var(--border)',
                      color: track.ownership === '100_owned' ? '#5a7a4a' : 'var(--text-muted)',
                      background: track.ownership === '100_owned' ? '#f0f5ec' : 'var(--surface-2)',
                    }}>
                      {track.ownership === '100_owned' ? '100% owned' : 'needs permission'}
                    </span>
                  </td>
                  <td style={{ ...s.td, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {[track.bpm && `${track.bpm} BPM`, track.track_key].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td style={{ ...s.td, color: 'var(--text-muted)' }}>{track.genre ?? '—'}</td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    {track.file_url ? (
                      <button style={s.fileBtn} onClick={() => getFile(track)}>↓ file</button>
                    ) : <span style={{ color: 'var(--border)' }}>—</span>}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    {canEdit ? (
                      <button
                        disabled={clearing === track.id}
                        style={{ ...s.clearedBtn, ...(track.cleared ? s.clearedOn : s.clearedOff) }}
                        onClick={() => toggleCleared(track)}
                        title={track.cleared ? 'mark uncleared' : 'mark cleared — creates a release'}
                      >
                        {clearing === track.id ? '...' : track.cleared ? 'cleared' : 'uncleared'}
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
        {tracks.length} tracks · {tracks.filter(t => t.cleared).length} cleared · {tracks.filter(t => !t.cleared).length} uncleared
        {' · '}
        <span style={{ color: 'var(--bronze)' }}>toggling a track to cleared automatically creates a release</span>
      </div>

      {showModal && <AddTrackModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </div>
  )
}

const s = {
  page:   { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '12px' },
  pageTitle: { fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 500 },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  search: { background: 'var(--bg)', border: '1px solid var(--border)', padding: '7px 12px', color: 'var(--text)', fontSize: '12px', fontFamily: 'var(--font)', width: '280px', outline: 'none' },
  filters: { display: 'flex', border: '1px solid var(--border)', overflow: 'hidden' },
  filterBtn: { background: 'var(--surface)', border: 'none', borderRight: '1px solid var(--border)', padding: '7px 10px', fontSize: '11px', letterSpacing: '0.04em', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font)' },
  filterActive: { background: 'var(--surface-2)', color: 'var(--text)', fontWeight: 500 },
  addBtn: { background: 'var(--bronze)', color: '#fff', border: 'none', padding: '7px 14px', fontSize: '12px', letterSpacing: '0.05em', cursor: 'pointer', fontFamily: 'var(--font)' },
  tableWrap: { flex: 1, overflowY: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'left', padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, textTransform: 'uppercase' },
  td: { fontSize: '12px', padding: '9px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text)', verticalAlign: 'middle' },
  clearedBtn: { border: '1px solid', padding: '2px 8px', fontSize: '10px', letterSpacing: '0.05em', cursor: 'pointer', fontFamily: 'var(--font)', background: 'none' },
  clearedOn:  { color: 'var(--bronze)', borderColor: 'var(--bronze-dim)', background: '#f5ede0' },
  clearedOff: { color: 'var(--text-muted)', borderColor: 'var(--border)' },
  fileBtn: { background: 'none', border: '1px solid var(--border)', color: 'var(--bronze)', padding: '3px 8px', fontSize: '10px', letterSpacing: '0.05em', cursor: 'pointer', fontFamily: 'var(--font)' },
  footer: { padding: '10px 24px', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', background: 'var(--surface)', letterSpacing: '0.04em' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(42,37,32,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: 'var(--surface)', border: '1px solid var(--border)', width: '100%', maxWidth: '560px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' },
  modalTitle: { fontSize: '12px', letterSpacing: '0.08em', fontWeight: 500 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', padding: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '6px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  formCol: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em', marginTop: '10px' },
  opt: { color: 'var(--border)', fontStyle: 'italic' },
  input: { background: 'var(--bg)', border: '1px solid var(--border)', padding: '9px 12px', color: 'var(--text)', outline: 'none', width: '100%', fontFamily: 'var(--font)', fontSize: '12px' },
  toggleRow: { display: 'flex', border: '1px solid var(--border)', overflow: 'hidden' },
  toggleBtn: { flex: 1, background: 'var(--bg)', border: 'none', borderRight: '1px solid var(--border)', padding: '9px', fontSize: '11px', letterSpacing: '0.04em', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font)' },
  toggleActive: { background: 'var(--bronze)', color: '#fff' },
  toggleActiveGreen: { background: '#5a7a4a', color: '#fff' },
  fileWrap: { display: 'flex', alignItems: 'center', gap: '8px' },
  fileLabel: { flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', padding: '9px 12px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', display: 'block' },
  clearFile: { background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '9px 10px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font)' },
  error: { fontSize: '11px', color: '#b84040', marginTop: '6px' },
  submitBtn: { marginTop: '20px', background: 'var(--bronze)', color: '#fff', border: 'none', padding: '11px', letterSpacing: '0.06em', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)' },
}
