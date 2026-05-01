import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const STAGES = [
  { key: 'intake',        label: 'Intake' },
  { key: 'pre_release',   label: 'Pre-release' },
  { key: 'tease_window',  label: 'Tease Window' },
  { key: 'released',      label: 'Released' },
  { key: 'reporting',     label: 'Reporting' },
]

function nextMonday() {
  const d = new Date()
  const day = d.getDay()
  const add = day === 1 ? 0 : day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + add)
  return d.toISOString().slice(0, 10)
}

function daysLabel(dateStr) {
  if (!dateStr) return null
  const diff = Math.round((new Date(dateStr) - new Date()) / 86400000)
  if (diff === 0) return 'today'
  if (diff > 0) return `in ${diff}d`
  return `${Math.abs(diff)}d ago`
}

function ReleaseCard({ release, onMove, onDelete, isCoordinator }) {
  const { track, stage, release_date } = release
  const stageIdx = STAGES.findIndex(s => s.key === stage)
  const canAdvance = stageIdx < STAGES.length - 1
  const canRetreat = stageIdx > 0

  return (
    <div style={s.card}>
      <Link to={`/releases/${release.id}`} style={{ ...s.cardTitle, color: 'var(--text)', textDecoration: 'none' }}>
        {track?.title ?? '—'}
      </Link>
      <div style={s.cardArtist}>{track?.artist ?? '—'}</div>

      <div style={s.cardMeta}>
        {release_date && (
          <span style={s.chip}>{new Date(release_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        )}
        {release_date && (
          <span style={{ ...s.chip, color: 'var(--text-muted)' }}>{daysLabel(release_date)}</span>
        )}
        {track?.cleared && <span style={{ ...s.chip, color: 'var(--bronze)' }}>cleared</span>}
      </div>

      {isCoordinator && (
        <div style={s.cardActions}>
          {canRetreat && (
            <button style={s.moveBtn} onClick={() => onMove(release, STAGES[stageIdx - 1].key)} title="Move back">
              ←
            </button>
          )}
          <div style={{ flex: 1 }} />
          {canAdvance && (
            <button style={{ ...s.moveBtn, color: 'var(--bronze)' }} onClick={() => onMove(release, STAGES[stageIdx + 1].key)} title="Advance">
              →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function NewReleaseModal({ onClose, onCreated }) {
  const [title, setTitle]     = useState('')
  const [artist, setArtist]   = useState('')
  const [date, setDate]       = useState('')
  const [error, setError]     = useState(null)
  const [saving, setSaving]   = useState(false)
  const { profile } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !artist.trim()) return
    setSaving(true)
    setError(null)

    const { data: track, error: trackErr } = await supabase
      .from('tracks')
      .insert({ title: title.trim(), artist: artist.trim(), submitted_by: profile?.id })
      .select()
      .single()

    if (trackErr) { setError(trackErr.message); setSaving(false); return }

    const { data: release, error: relErr } = await supabase
      .from('releases')
      .insert({
        track_id: track.id,
        stage: 'intake',
        release_date: date || null,
        coordinator_id: profile?.id,
      })
      .select('*, track:tracks(*)')
      .single()

    if (relErr) { setError(relErr.message); setSaving(false); return }

    onCreated(release)
    onClose()
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>new release</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={s.modalForm}>
          <label style={s.label}>track title</label>
          <input style={s.input} value={title} onChange={e => setTitle(e.target.value)} required autoFocus />

          <label style={s.label}>artist</label>
          <input style={s.input} value={artist} onChange={e => setArtist(e.target.value)} required />

          <label style={s.label}>release date <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
          <input style={s.input} type="date" value={date} onChange={e => setDate(e.target.value)} />

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={saving} style={s.submitBtn}>
            {saving ? 'creating...' : 'create release'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Pipeline() {
  const { profile } = useAuth()
  const [releases, setReleases] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const isCoordinator = !profile || profile.role === 'coordinator'

  useEffect(() => {
    fetchReleases()
  }, [])

  async function fetchReleases() {
    const { data, error } = await supabase
      .from('releases')
      .select('*, track:tracks(*)')
      .order('created_at', { ascending: true })

    if (!error) setReleases(data)
    setLoading(false)
  }

  async function moveRelease(release, newStage) {
    const updates = { stage: newStage, updated_at: new Date().toISOString() }
    if (newStage === 'tease_window' && !release.tease_start_date) {
      updates.tease_start_date = nextMonday()
    }
    const { error } = await supabase
      .from('releases')
      .update(updates)
      .eq('id', release.id)

    if (!error) {
      setReleases(prev =>
        prev.map(r => r.id === release.id ? { ...r, stage: newStage, ...updates } : r)
      )
    }
  }

  function handleCreated(release) {
    setReleases(prev => [...prev, release])
  }

  const byStage = stage => releases.filter(r => r.stage === stage)

  if (loading) return <div style={s.loading}>loading pipeline...</div>

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.pageTitle}>PIPELINE</span>
        {isCoordinator && (
          <button style={s.newBtn} onClick={() => setShowModal(true)}>+ new release</button>
        )}
      </div>

      <div style={s.board}>
        {STAGES.map(stage => {
          const cards = byStage(stage.key)
          const isTeaseWindow = stage.key === 'tease_window'
          return (
            <div key={stage.key} style={s.column}>
              <div style={{ ...s.columnHeader, ...(isTeaseWindow ? s.columnHeaderBronze : {}) }}>
                <span style={s.columnLabel}>{stage.label}</span>
                <span style={s.columnCount}>{cards.length}</span>
              </div>
              <div style={s.columnBody}>
                {cards.length === 0 && (
                  <div style={s.empty}>—</div>
                )}
                {cards.map(r => (
                  <ReleaseCard
                    key={r.id}
                    release={r}
                    onMove={moveRelease}
                    isCoordinator={isCoordinator}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <NewReleaseModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 48px)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid var(--border)',
  },
  pageTitle: {
    fontSize: '11px',
    letterSpacing: '0.12em',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  newBtn: {
    background: 'var(--bronze)',
    color: '#fff',
    border: 'none',
    padding: '7px 14px',
    fontSize: '12px',
    letterSpacing: '0.05em',
    cursor: 'pointer',
  },
  board: {
    display: 'flex',
    flex: 1,
    gap: '0',
    overflowX: 'auto',
    overflowY: 'hidden',
  },
  column: {
    flex: '0 0 220px',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid var(--border)',
    minWidth: 0,
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
  },
  columnHeaderBronze: {
    background: '#f0e8dc',
    borderBottom: '1px solid var(--bronze-dim)',
  },
  columnLabel: {
    fontSize: '11px',
    letterSpacing: '0.08em',
    fontWeight: 500,
    color: 'var(--text)',
  },
  columnCount: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    background: 'var(--surface-2)',
    padding: '1px 7px',
    border: '1px solid var(--border)',
  },
  columnBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    background: 'var(--bg)',
  },
  empty: {
    color: 'var(--border)',
    fontSize: '16px',
    textAlign: 'center',
    paddingTop: '20px',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  cardTitle: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text)',
    lineHeight: 1.3,
  },
  cardArtist: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  cardMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '6px',
  },
  chip: {
    fontSize: '10px',
    letterSpacing: '0.04em',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    padding: '1px 6px',
    color: 'var(--text)',
  },
  cardActions: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid var(--border)',
  },
  moveBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '13px',
    padding: 0,
  },
  loading: {
    padding: '48px 24px',
    color: 'var(--text-muted)',
    fontSize: '12px',
    letterSpacing: '0.06em',
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
  modalForm: {
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
  },
}
