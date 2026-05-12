import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import JSZip from 'jszip'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { seedChecklistForRelease } from '../lib/seedChecklist'

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

function ReleaseCard({ release, onMove, onRequestAdvance, onRemove, onArchive, isCoordinator }) {
  const { track, stage, release_date } = release
  const stageIdx = STAGES.findIndex(s => s.key === stage)
  const canAdvance = stageIdx < STAGES.length - 1
  const canRetreat = stageIdx > 0
  const [confirmRemove, setConfirmRemove] = useState(false)

  return (
    <div style={s.card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <Link to={`/releases/${release.id}`} style={{ ...s.cardTitle, color: 'var(--text)', textDecoration: 'none', flex: 1 }}>
          {track?.title ?? '—'}
        </Link>
        {isCoordinator && !confirmRemove && (
          <button
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', padding: '0 2px', lineHeight: 1, opacity: 0.5, flexShrink: 0 }}
            onClick={() => setConfirmRemove(true)}
            title="Archive or remove">
            ×
          </button>
        )}
      </div>

      {confirmRemove ? (
        <div style={{ marginTop: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.4 }}>
            Done with this release?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <button
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 10px', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '0.04em', textAlign: 'left' }}
              onClick={() => onArchive(release)}>
              ↓ move to vault
            </button>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                style={{ flex: 1, background: 'none', border: '1px solid #b84040', color: '#b84040', padding: '5px', fontSize: '10px', cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '0.04em' }}
                onClick={() => onRemove(release)}>
                remove entirely
              </button>
              <button
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '5px 10px', fontSize: '11px', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}
                onClick={() => setConfirmRemove(false)}>
                cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
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
                <button style={{ ...s.moveBtn, color: 'var(--bronze)' }}
                  onClick={() => onRequestAdvance(release, STAGES[stageIdx + 1].key)}
                  title="Advance">
                  →
                </button>
              )}
            </div>
          )}
        </>
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

  // Checklist progress state (only used for Preparing → In Market)
  const [preItems,  setPreItems]  = useState([])
  const [postItems, setPostItems] = useState([])
  const [loadingCL, setLoadingCL] = useState(isChecklistGate)
  const [clConfirmed, setClConfirmed]   = useState(false)
  const [ccEmail, setCcEmail]           = useState('')
  const [ccSent, setCcSent]             = useState(false)

  // Release gate state (tease_window → released)
  const isReleaseGate = gateKey === 'tease_window→released'
  const [releaseDecision, setReleaseDecision]   = useState(false)
  const [uploadConfirmed, setUploadConfirmed]   = useState(false)
  const [relItems, setRelItems]                 = useState([])
  const [exporting, setExporting]               = useState(false)
  const [exported, setExported]                 = useState(false)
  const [exportProgress, setExportProgress]     = useState('')

  useEffect(() => {
    if (!isReleaseGate) return
    supabase.from('checklist_items').select('*')
      .eq('release_id', confirmMove.release.id).eq('checklist', 'pre_release')
      .order('position')
      .then(({ data }) => setRelItems(data ?? []))
  }, [confirmMove.release.id, isReleaseGate])

  async function handleExport() {
    setExporting(true)
    const t = confirmMove.release.track ?? {}
    try {
      setExportProgress('Building document…')
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ children: [new TextRun({ text: 'UNCUT RECORDS', bold: true, size: 18, font: 'Arial', color: '8B6340' })] }),
            new Paragraph({ children: [new TextRun({ text: t.title ?? '—', bold: true, size: 40, font: 'Arial' })] }),
            new Paragraph({ children: [new TextRun({ text: t.artist ?? '—', size: 24, font: 'Arial', color: '666666' })] }),
            new Paragraph({ children: [new TextRun('')] }),
            ...relItems.map(item => {
              if (item.label.startsWith('§')) {
                return new Paragraph({ children: [new TextRun({ text: item.label.replace('§ ', ''), bold: true, size: 20, font: 'Arial', color: '8B6340' })] })
              }
              const status = item.not_required ? 'N/A' : item.completed ? '✓' : '○'
              const children = [new TextRun({ text: `${status}  ${item.label}`, size: 20, font: 'Arial' })]
              if (item.field_value) children.push(new TextRun({ text: `  →  ${item.field_value}`, bold: true, size: 20, font: 'Arial', color: '8B6340' }))
              return new Paragraph({ children, spacing: { before: 40, after: 40 } })
            }),
          ],
        }],
      })
      const docBlob = await Packer.toBlob(doc)
      setExportProgress('Packaging files…')
      const zip = new JSZip()
      zip.file('Release Pack.docx', docBlob)
      const fileItems = relItems.filter(i => i.file_path && !i.not_required)
      for (let i = 0; i < fileItems.length; i++) {
        const item = fileItems[i]
        setExportProgress(`Files… (${i + 1}/${fileItems.length})`)
        const { data } = await supabase.storage.from('tracks').createSignedUrl(item.file_path, 300)
        if (data?.signedUrl) {
          try {
            const blob = await (await fetch(data.signedUrl)).blob()
            const ext = item.file_path.split('.').pop()
            const name = item.label.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').substring(0, 40)
            zip.file(`files/${name}.${ext}`, blob)
          } catch (_) {}
        }
      }
      setExportProgress('Compressing…')
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a'); a.href = url
      a.download = `${t.title ?? 'Release'} - Co-Brand Pack.zip`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExported(true)
    } catch (err) { console.error(err) }
    setExporting(false); setExportProgress('')
  }

  useEffect(() => {
    if (!isChecklistGate) return
    Promise.all([
      supabase.from('checklist_items').select('id,completed,not_required,label')
        .eq('release_id', confirmMove.release.id).eq('checklist', 'pre_release'),
      supabase.from('checklist_items').select('id,completed,not_required,label')
        .eq('release_id', confirmMove.release.id).eq('checklist', 'post_release'),
    ]).then(([pre, post]) => {
      setPreItems(pre.data ?? [])
      setPostItems(post.data ?? [])
      setLoadingCL(false)
    })
  }, [confirmMove.release.id])

  const curIdx   = STAGES.findIndex(s => s.key === confirmMove.release.stage)
  const prevStage = curIdx > 0 ? STAGES[curIdx - 1] : null
  const track = confirmMove.release.track ?? {}

  // ── Checklist gate (Preparing → In Market) ──────────────────
  if (isChecklistGate) {
    const countable = items => items.filter(i => !i.not_required && !i.label.startsWith('§'))
    const preDone   = countable(preItems).filter(i => i.completed).length
    const preTotal  = countable(preItems).length
    const prePct    = preTotal  ? Math.round((preDone  / preTotal)  * 100) : 0
    const allDone   = prePct === 100

    return (
      <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={s.gateModal}>
          <div style={s.modalHeader}>
            <span style={s.modalTitle}>Ready to go In Market?</span>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{track.title}</span>
            {track.artist && track.artist !== 'TBC' ? ` · ${track.artist}` : ''}
          </div>

          <div style={{ fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
            Checklist progress
          </div>

          {loadingCL ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0' }}>loading…</div>
          ) : (
            <>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text)' }}>Distribution checklist</span>
                  <span style={{ fontSize: '11px', color: prePct === 100 ? '#5a7a4a' : 'var(--text-muted)' }}>
                    {preDone}/{preTotal} {prePct === 100 ? '✓' : ''}
                  </span>
                </div>
                <div style={{ height: '4px', background: 'var(--surface-2)', borderRadius: '2px' }}>
                  <div style={{ height: '100%', borderRadius: '2px', width: `${prePct}%`, background: prePct === 100 ? '#5a7a4a' : 'var(--bronze)', transition: 'width 0.3s' }} />
                </div>
              </div>

              {!allDone && (
                <div style={{ marginTop: '4px', marginBottom: '16px' }}>
                  <button
                    style={{ width: '100%', background: 'var(--bronze)', color: '#fff', border: 'none', padding: '10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '0.04em' }}
                    onClick={() => navigate(`/releases/${confirmMove.release.id}`)}>
                    Open release to complete checklist →
                  </button>
                </div>
              )}

              <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0' }} />

              <div style={{ fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                Send to content creator
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input
                  type="email"
                  placeholder="content creator email…"
                  value={ccEmail}
                  onChange={e => setCcEmail(e.target.value)}
                  style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', padding: '7px 10px', fontSize: '11px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none' }}
                />
                <button
                  style={{ background: ccSent ? 'var(--surface-2)' : 'var(--bronze)', color: ccSent ? 'var(--text-muted)' : '#fff', border: 'none', padding: '7px 14px', fontSize: '11px', fontFamily: 'var(--font)', cursor: ccEmail.trim() ? 'pointer' : 'not-allowed', opacity: ccEmail.trim() ? 1 : 0.5, letterSpacing: '0.04em', flexShrink: 0 }}
                  disabled={!ccEmail.trim()}
                  onClick={() => {
                    const subject = encodeURIComponent(`Brief: ${track.title ?? 'Track'} — ${track.artist ?? 'Artist'}`)
                    const body = encodeURIComponent(
                      `Hi,\n\nHere are the details for the upcoming track:\n\nTrack: ${track.title ?? '—'}\nArtist: ${track.artist ?? '—'}\n\nLet me know if you need anything else.\n\nUncut Records`
                    )
                    window.location.href = `mailto:${encodeURIComponent(ccEmail.trim())}?subject=${subject}&body=${body}`
                    setCcSent(true)
                  }}>
                  {ccSent ? '✓ sent' : '↗ send brief'}
                </button>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={clConfirmed}
                  onChange={() => setClConfirmed(p => !p)}
                  style={{ accentColor: 'var(--bronze)', marginTop: '2px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.4 }}>
                  Content creator is briefed and ready to launch
                </span>
              </label>

              <div style={{ fontSize: '11px', color: 'var(--bronze)', marginTop: '12px', padding: '8px 10px', background: '#fdf8f2', border: '1px solid var(--bronze-dim)' }}>
                Tease start date will be set to next Monday.
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
            <button
              style={{ flex: 1, background: clConfirmed ? 'var(--bronze)' : 'var(--surface-2)', color: clConfirmed ? '#fff' : 'var(--text-muted)', border: `1px solid ${clConfirmed ? 'var(--bronze)' : 'var(--border)'}`, padding: '10px', fontSize: '12px', cursor: clConfirmed ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)', letterSpacing: '0.04em', transition: 'all 0.15s' }}
              onClick={onConfirm}
              disabled={!clConfirmed}>
              Yes, go In Market
            </button>
            <button
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '10px 16px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}
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

  // ── Release gate (In Market → Released) ─────────────────────
  if (isReleaseGate) {
    const canConfirm = releaseDecision && exported && uploadConfirmed
    return (
      <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={s.gateModal}>
          <div style={s.modalHeader}>
            <span style={s.modalTitle}>Confirm release?</span>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{track.title}</span>
            {track.artist && track.artist !== 'TBC' ? ` · ${track.artist}` : ''}
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: '16px' }}>
            <input type="checkbox" checked={releaseDecision} onChange={() => setReleaseDecision(p => !p)}
              style={{ accentColor: 'var(--bronze)', marginTop: '2px', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.4 }}>
              Release decision made — track is getting traction
            </span>
          </label>

          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0 16px' }} />

          <div style={{ fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
            Co-Brand Release Pack
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
            Export the full pack — Word doc + all checklist files — then upload to the Co-Brand portal.
          </div>
          <button
            style={{ width: '100%', background: exported ? 'var(--surface-2)' : 'var(--bronze)', color: exported ? 'var(--text-muted)' : '#fff', border: exported ? '1px solid var(--border)' : 'none', padding: '10px', fontSize: '12px', cursor: exporting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', letterSpacing: '0.04em', opacity: exporting ? 0.7 : 1, marginBottom: '16px' }}
            onClick={handleExport} disabled={exporting}>
            {exporting ? (exportProgress || 'preparing…') : exported ? '↓ Re-export Co-Brand Pack' : '↓ Export Co-Brand Release Pack'}
          </button>

          {exported && (
            <>
              <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0 16px' }} />
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={uploadConfirmed} onChange={() => setUploadConfirmed(p => !p)}
                  style={{ accentColor: 'var(--bronze)', marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.4 }}>
                  Pack uploaded to Co-Brand portal
                </span>
              </label>
            </>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
            <button
              style={{ flex: 1, background: canConfirm ? 'var(--bronze)' : 'var(--surface-2)', color: canConfirm ? '#fff' : 'var(--text-muted)', border: `1px solid ${canConfirm ? 'var(--bronze)' : 'var(--border)'}`, padding: '10px', fontSize: '12px', cursor: canConfirm ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)', letterSpacing: '0.04em', transition: 'all 0.15s' }}
              onClick={onConfirm} disabled={!canConfirm}>
              Yes, confirm release
            </button>
            <button style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '10px 16px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}
              onClick={onClose}>Cancel</button>
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
            style={{ flex: 1, background: allChecked ? 'var(--bronze)' : 'var(--surface-2)', color: allChecked ? '#fff' : 'var(--text-muted)', border: `1px solid ${allChecked ? 'var(--bronze)' : 'var(--border)'}`, padding: '10px', fontSize: '12px', cursor: allChecked ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)', letterSpacing: '0.04em', transition: 'all 0.15s' }}
            onClick={onConfirm}
            disabled={!allChecked}>
            {gate.cta}
          </button>
          <button
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '10px 16px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}
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
  const [syncing, setSyncing]         = useState(false)
  const [syncResult, setSyncResult]   = useState(null)
  const isCoordinator = !profile || profile.role === 'coordinator'

  useEffect(() => {
    fetchReleases()
  }, [])

  async function fetchReleases() {
    const { data, error } = await supabase
      .from('releases')
      .select('*, track:tracks(*)')
      .neq('stage', 'archived')
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
    await supabase.from('releases').update({ stage: 'archived' }).eq('id', release.id)
    setReleases(prev => prev.filter(r => r.id !== release.id))
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

  async function syncAsana() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync-asana')
      const { data, error } = await res.json()
      if (error) { setSyncResult({ error }); setSyncing(false); return }

      let updated = 0
      for (const item of data) {
        const match = releases.find(r =>
          r.track?.title?.toLowerCase() === item.trackName.toLowerCase()
        )
        if (!match) continue

        const updates = {}
        if (item.teaseDate && item.teaseDate !== match.tease_start_date) updates.tease_start_date = item.teaseDate
        if (item.releaseDate && item.releaseDate !== match.release_date) updates.release_date = item.releaseDate
        if (Object.keys(updates).length === 0) continue

        await supabase.from('releases').update(updates).eq('id', match.id)
        setReleases(prev => prev.map(r => r.id === match.id ? { ...r, ...updates } : r))
        updated++
      }
      setSyncResult({ updated, total: data.length })
    } catch (err) {
      setSyncResult({ error: err.message })
    }
    setSyncing(false)
  }

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
  syncBtn: {
    background: 'var(--surface)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    padding: '7px 14px',
    fontSize: '12px',
    letterSpacing: '0.05em',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
  },
  board: {
    display: 'flex',
    flex: 1,
    gap: '0',
    overflowX: 'auto',
    overflowY: 'hidden',
  },
  column: {
    flex: '1 1 0',
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
  gateModal: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    width: '100%',
    maxWidth: '420px',
    padding: '28px 32px',
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
