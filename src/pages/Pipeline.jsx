import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { seedChecklistForRelease } from '../lib/seedChecklist'
import ArtworkThumb from '../components/ArtworkThumb'

const STAGES = [
  { key: 'intake',        label: 'Selected' },
  { key: 'pre_release',   label: 'Preparing' },
  { key: 'tease_window',  label: 'In Market' },
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

// What needs to happen before each advance
const STAGE_GATES = {
  'intake→pre_release': {
    title: 'Ready to start Preparing?',
    checks: [
      'Track file uploaded and sound quality checked',
    ],
    note: null,
    cta: 'Yes, move to Preparing',
  },
  'pre_release→tease_window': {
    title: 'Ready to go In Market?',
    checks: [
      'Distribution submitted to Co-Brand',
      'Artwork approved and delivered',
      'LST briefed with track, artist name, and start date',
      'Interns and Flowstate briefed for volume content',
    ],
    note: 'Tease start date will be set to next Monday.',
    cta: 'Yes, go In Market',
  },
  'tease_window→released': {
    title: 'Confirm release?',
    checks: [], note: null, cta: 'Yes, confirm release',
  },
}

function daysInStage(release) {
  const d = Math.round((new Date() - new Date(release.updated_at || release.created_at)) / 86400000)
  if (d === 0) return 'today'
  return `${d}d in stage`
}

function ReleaseCard({ release, onMove, onRequestAdvance, onRemove, onArchive, isCoordinator }) {
  const { track, stage } = release
  const stageIdx = STAGES.findIndex(s => s.key === stage)
  const canAdvance = stageIdx < STAGES.length - 1
  const canRetreat = stageIdx > 0
  const [confirmRemove, setConfirmRemove] = useState(false)

  if (confirmRemove) {
    return (
      <div style={s.card}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.4 }}>
          Done with <strong style={{ color: 'var(--green)' }}>{track?.title}</strong>?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button style={s.cardActionBtn} onClick={() => onArchive(release)}>↓ Move to vault</button>
          <button style={{ ...s.cardActionBtn, background: 'none', border: '1px solid #d04040', color: '#d04040', borderRadius: 'var(--radius-pill)' }} onClick={() => onRemove(release)}>Remove entirely</button>
          <button style={{ ...s.cardActionBtn, background: 'none', border: '1.5px solid var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--radius-pill)' }} onClick={() => setConfirmRemove(false)}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.card}>
      {/* Artwork + header row */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
        <ArtworkThumb path={release.artwork_url} size={44} radius={6} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={s.cardArtist}>{track?.artist ?? '—'}</div>
            {isCoordinator && (
              <button style={s.cardX} onClick={() => setConfirmRemove(true)}>×</button>
            )}
          </div>
          <Link to={`/releases/${release.id}`} style={s.cardTitle}>
            {track?.title ?? '—'}
          </Link>
        </div>
      </div>

      {/* Meta row */}
      <div style={s.cardMeta}>
        <span style={s.cardMetaText}>{daysInStage(release)}</span>
        {release.release_date && (
          <>
            <span style={s.cardDot}>·</span>
            <span style={s.cardMetaText}>{new Date(release.release_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          </>
        )}
      </div>

      {/* Advance / retreat */}
      {isCoordinator && (
        <div style={s.cardActions}>
          {canRetreat && (
            <button style={s.moveBtn} onClick={() => onMove(release, STAGES[stageIdx - 1].key)}>←</button>
          )}
          <div style={{ flex: 1 }} />
          {canAdvance && (
            <button style={{ ...s.moveBtn, borderColor: 'var(--green)', color: 'var(--green)' }}
              onClick={() => onRequestAdvance(release, STAGES[stageIdx + 1].key)}>→</button>
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

    // Seed checklist items immediately so they're ready when the gate modal opens
    await seedChecklistForRelease(release.id)

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

// ─── Gate Modal ────────────────────────────────
function GateModal({ confirmMove, onClose, onConfirm, onMoveBack, gateChecked, setGateChecked }) {
  const navigate = useNavigate()
  const gateKey  = `${confirmMove.release.stage}→${confirmMove.newStage}`
  const isChecklistGate = gateKey === 'pre_release→tease_window'
  const gate = STAGE_GATES[gateKey] ?? {
    title: `Move to ${STAGES.find(s => s.key === confirmMove.newStage)?.label}?`,
    checks: [], note: null, cta: 'Yes, confirm',
  }

  // Checklist progress state
  const [preItems,  setPreItems]  = useState([])
  const [loadingCL, setLoadingCL] = useState(isChecklistGate)

  useEffect(() => {
    if (!isChecklistGate) return
    supabase.from('checklist_items').select('id,completed,not_required,label')
      .eq('release_id', confirmMove.release.id).eq('checklist', 'pre_release')
      .then(({ data }) => { setPreItems(data ?? []); setLoadingCL(false) })
  }, [confirmMove.release.id])

  const curIdx   = STAGES.findIndex(s => s.key === confirmMove.release.stage)
  const prevStage = curIdx > 0 ? STAGES[curIdx - 1] : null
  const track = confirmMove.release.track ?? {}

  // ── Checklist gate (Preparing → In Market) ──────────────────
  if (isChecklistGate) {
    const countable = items => items.filter(i => !i.not_required && !i.label.startsWith('§'))
    const preDone   = countable(preItems).filter(i => i.completed).length
    const preTotal  = countable(preItems).length
    const prePct    = preTotal ? Math.round((preDone / preTotal) * 100) : 0

    return (
      <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={s.gateModal}>
          <div style={s.modalHeader}>
            <span style={s.modalTitle}>Ready to go In Market?</span>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{track.title}</span>
            {track.artist && track.artist !== 'TBC' ? ` · ${track.artist}` : ''}
          </div>

          {loadingCL ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0' }}>loading…</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text)' }}>Distribution checklist</span>
                <span style={{ fontSize: '11px', color: prePct === 100 ? 'var(--green)' : 'var(--text-muted)' }}>
                  {preDone}/{preTotal} {prePct === 100 ? '✓' : ''}
                </span>
              </div>
              <div style={{ height: '4px', background: 'var(--surface-2)', borderRadius: '2px', marginBottom: '16px' }}>
                <div style={{ height: '100%', borderRadius: '2px', width: `${prePct}%`, background: prePct === 100 ? 'var(--green)' : 'var(--pink)', transition: 'width 0.3s' }} />
              </div>
              {prePct < 100 && (
                <button
                  style={{ width: '100%', background: 'var(--pink)', color: 'var(--green)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '0.04em', marginBottom: '12px' }}
                  onClick={() => navigate(`/releases/${confirmMove.release.id}`)}>
                  Open release to finish checklist →
                </button>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              style={{ flex: 1, background: 'var(--pink)', color: 'var(--green)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '0.04em' }}
              onClick={onConfirm}>
              Yes, go In Market
            </button>
            <button
              style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '10px 16px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}
              onClick={onClose}>
              Cancel
            </button>
          </div>
          {prevStage && (
            <div style={{ marginTop: '14px', textAlign: 'center' }}>
              <button style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font)', textDecoration: 'underline' }}
                onClick={() => onMoveBack(prevStage.key)}>
                ← Move back to {prevStage.label}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Simple gate (all other transitions) ─────────────────────
  const allChecked = gate.checks.length === 0 || gate.checks.every((_, i) => gateChecked[i])

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.gateModal}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{gate.title}</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{track.title}</span>
          {track.artist && track.artist !== 'TBC' ? ` · ${track.artist}` : ''}
        </div>

        {gate.checks.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Confirm before advancing
            </div>
            {gate.checks.map((check, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                <input type="checkbox"
                  checked={!!gateChecked[i]}
                  onChange={() => setGateChecked(prev => ({ ...prev, [i]: !prev[i] }))}
                  style={{ accentColor: 'var(--bronze)', marginTop: '2px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '12px', color: gateChecked[i] ? 'var(--text-muted)' : 'var(--text)', textDecoration: gateChecked[i] ? 'line-through' : 'none', lineHeight: 1.4 }}>
                  {check}
                </span>
              </label>
            ))}
          </div>
        )}

        {gate.note && (
          <div style={{ fontSize: '11px', color: 'var(--bronze)', marginTop: '12px', padding: '8px 10px', background: '#fdf8f2', border: '1px solid var(--bronze-dim)' }}>
            {gate.note}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button
            style={{ flex: 1, background: allChecked ? 'var(--pink)' : 'var(--surface-2)', color: allChecked ? 'var(--green)' : 'var(--text-muted)', border: `1.5px solid ${allChecked ? 'var(--pink)' : 'var(--border)'}`, borderRadius: 'var(--radius-pill)', padding: '10px', fontSize: '12px', cursor: allChecked ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)', letterSpacing: '0.04em', transition: 'all 0.15s' }}
            onClick={onConfirm}
            disabled={!allChecked}>
            {gate.cta}
          </button>
          <button
            style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '10px 16px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}
            onClick={onClose}>
            Cancel
          </button>
        </div>
        {prevStage && (
          <div style={{ marginTop: '14px', textAlign: 'center' }}>
            <button style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font)', textDecoration: 'underline' }}
              onClick={() => onMoveBack(prevStage.key)}>
              ← Move back to {prevStage.label}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Pipeline() {
  const { profile } = useAuth()
  const [releases, setReleases] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [confirmMove, setConfirmMove] = useState(null) // { release, newStage }
  const [gateChecked, setGateChecked] = useState({})   // { [index]: bool }
  const isCoordinator = !profile || profile.role === 'coordinator'

  useEffect(() => {
    fetchReleases()
  }, [])

  async function fetchReleases() {
    const { data, error } = await supabase
      .from('releases')
      .select('*, track:tracks(*)')
      .neq('archived', true)
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

  async function archiveRelease(release) {
    const { error } = await supabase.from('releases').update({ archived: true }).eq('id', release.id)
    if (!error) setReleases(prev => prev.filter(r => r.id !== release.id))
  }

  async function removeFromPipeline(release) {
    // Delete related data then the release, and unset cleared on the track
    await supabase.from('checklist_items').delete().eq('release_id', release.id)
    await supabase.from('performance_data').delete().eq('release_id', release.id)
    await supabase.from('tease_window_logs').delete().eq('release_id', release.id)
    await supabase.from('releases').delete().eq('id', release.id)
    if (release.track?.id) {
      await supabase.from('tracks').update({ cleared: false }).eq('id', release.track.id)
    }
    setReleases(prev => prev.filter(r => r.id !== release.id))
  }

  function requestAdvance(release, newStage) {
    setGateChecked({})
    setConfirmMove({ release, newStage })
  }

  function confirmAndMove() {
    moveRelease(confirmMove.release, confirmMove.newStage)
    setConfirmMove(null)
    setGateChecked({})
  }

  const byStage = stage => releases.filter(r => r.stage === stage)

  if (loading) return <div style={s.loading}>loading pipeline...</div>

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <div style={s.pageSuper}>{releases.length} TRACKS MOVING</div>
          <div style={s.pageTitle}>PIPELINE</div>
        </div>
        {isCoordinator && (
          <button style={s.newBtn} onClick={() => setShowModal(true)}>+ new release</button>
        )}
      </div>

      <div style={s.board}>
        {STAGES.map(stage => {
          const cards = byStage(stage.key)
          return (
            <div key={stage.key} style={s.column}>
              <div style={s.columnHeader}>
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
                    onRequestAdvance={requestAdvance}
                    onRemove={removeFromPipeline}
                    onArchive={archiveRelease}
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

      {confirmMove && (
        <GateModal
          confirmMove={confirmMove}
          onClose={() => { setConfirmMove(null); setGateChecked({}) }}
          onConfirm={confirmAndMove}
          onMoveBack={(prevKey) => { moveRelease(confirmMove.release, prevKey); setConfirmMove(null); setGateChecked({}) }}
          gateChecked={gateChecked}
          setGateChecked={setGateChecked}
        />
      )}
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 60px)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid var(--border)',
    gap: '16px',
  },
  pageSuper: {
    fontFamily: 'var(--font)',
    fontSize: '11px',
    letterSpacing: '0.1em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    marginBottom: '2px',
  },
  pageTitle: {
    fontFamily: 'var(--font-display)', fontVariationSettings: '"YEAR" 2050',
    fontSize: 'clamp(36px, 5vw, 64px)',
    fontWeight: 900,
    color: 'var(--green)',
    letterSpacing: '-0.01em',
    lineHeight: 0.9,
  },
  newBtn: {
    background: 'var(--pink)',
    color: 'var(--green)',
    border: 'none',
    padding: '8px 20px',
    fontSize: '12px',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    borderRadius: 'var(--radius-pill)',
    fontFamily: 'var(--font)',
  },
  board: {
    display: 'flex',
    flex: 1,
    gap: '12px',
    overflowX: 'auto',
    overflowY: 'hidden',
    padding: '16px 24px 24px',
  },
  column: {
    flex: '0 0 210px',
    display: 'flex',
    flexDirection: 'column',
    border: '1.5px solid var(--border)',
    borderRadius: '16px',
    overflow: 'hidden',
    background: '#fff',
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px 12px',
    borderBottom: '1.5px solid var(--border)',
    flexShrink: 0,
  },
  gateModal: {
    background: 'var(--surface)',
    border: '1.5px solid var(--border)',
    borderRadius: '20px',
    width: '100%',
    maxWidth: '420px',
    padding: '28px 32px',
  },
  columnLabel: {
    fontFamily: 'var(--font)',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--green)',
  },
  columnCount: {
    fontFamily: 'var(--font)',
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontWeight: 400,
  },
  columnBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 10px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  empty: {
    color: 'var(--border)',
    fontSize: '22px',
    textAlign: 'center',
    padding: '24px 0',
  },
  card: {
    background: '#fff',
    border: '1.5px solid var(--border)',
    borderRadius: '12px',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  cardArtist: {
    fontFamily: 'var(--font)',
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--green)',
    letterSpacing: '0.01em',
    lineHeight: 1.2,
  },
  cardTitle: {
    fontFamily: 'var(--font)',
    fontSize: '13px',
    fontWeight: 400,
    color: 'var(--text)',
    textDecoration: 'none',
    lineHeight: 1.3,
    display: 'block',
    marginBottom: '4px',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  cardMetaText: {
    fontFamily: 'var(--font)',
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  cardDot: {
    fontFamily: 'var(--font)',
    fontSize: '11px',
    color: 'var(--border)',
  },
  cardX: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '0 0 0 4px',
    lineHeight: 1,
    opacity: 0.5,
    flexShrink: 0,
  },
  cardActionBtn: {
    background: 'var(--pink)',
    border: 'none',
    color: 'var(--green)',
    padding: '7px 14px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
    textAlign: 'left',
    borderRadius: 'var(--radius-pill)',
    width: '100%',
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
    border: '1.5px solid var(--border)',
    color: 'var(--text-muted)',
    width: '26px',
    height: '26px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '13px',
    padding: 0,
    borderRadius: '50%',
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
    border: '1.5px solid var(--border)',
    borderRadius: '20px',
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
    border: '1.5px solid var(--border)',
    borderRadius: '8px',
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
    background: 'var(--pink)',
    color: 'var(--green)',
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    padding: '12px',
    letterSpacing: '0.06em',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
  },
}
