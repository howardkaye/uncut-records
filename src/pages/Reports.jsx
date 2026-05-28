import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const STAGE_LABEL = {
  intake: 'Intake', pre_release: 'Pre-release',
  tease_window: 'Tease Window', released: 'Released', reporting: 'Reporting',
}

function fmt(n) {
  if (!n) return '0'
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.round((new Date() - new Date(dateStr)) / 86400000)
}

function weekOf() {
  const d = new Date()
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  return monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildReportText(releases) {
  const lines = []
  lines.push('UNCUT RECORDS — WEEKLY REPORT')
  lines.push(`Week of ${weekOf()}`)
  lines.push('')

  if (releases.length === 0) {
    lines.push('No active releases this week.')
    return lines.join('\n')
  }

  releases.forEach(r => {
    const days = daysSince(r.release_date)
    lines.push('─'.repeat(48))
    lines.push(`${r.track?.title ?? '—'} — ${r.track?.artist ?? '—'}`)
    lines.push(`Stage: ${STAGE_LABEL[r.stage]} | Release date: ${r.release_date ? new Date(r.release_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBC'}${days !== null ? ` | ${days}d live` : ''}`)
    lines.push('')
    lines.push('TikTok UGC')
    lines.push(`  Sound uses:        ${fmt(r._ttUses)}`)
    lines.push(`  Sound views:       ${fmt(r._ttViews)}`)
    lines.push(`  Top video views:   ${fmt(r._streams)}`)
    lines.push('')
    lines.push('Checklists')
    lines.push(`  Pre-release:  ${r._preDone}/${r._preTotal} items complete`)
    lines.push(`  Post-release: ${r._postDone}/${r._postTotal} items complete`)
    if (r.notes) {
      lines.push('')
      lines.push(`Notes: ${r.notes}`)
    }
    lines.push('')
  })

  lines.push('─'.repeat(48))
  lines.push(`Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`)
  return lines.join('\n')
}

function LogDataForm({ releaseId, onSaved }) {
  const { profile } = useAuth()
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({
    report_date: new Date().toISOString().slice(0, 10),
    tiktok_uses: '', tiktok_views: '', streams: '', notes: '',
  })

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('performance_data').insert({
      release_id: releaseId,
      report_date: form.report_date,
      platform: 'TikTok',
      streams:      parseInt(form.streams)      || 0,
      tiktok_uses:  parseInt(form.tiktok_uses)  || 0,
      tiktok_views: parseInt(form.tiktok_views) || 0,
      notes: form.notes.trim() || null,
      recorded_by: profile?.id,
    })
    if (!error) {
      setForm(f => ({ ...f, tiktok_uses: '', tiktok_views: '', streams: '', notes: '' }))
      setOpen(false)
      onSaved()
    }
    setSaving(false)
  }

  return (
    <div style={{ marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
      {!open ? (
        <button
          style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '6px 16px', fontSize: '11px', letterSpacing: '0.06em', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}
          onClick={() => setOpen(true)}>
          + log update
        </button>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            {[
              { label: 'Date',             key: 'report_date',  type: 'date'   },
              { label: 'Sound Uses',       key: 'tiktok_uses',  type: 'number', placeholder: '0' },
              { label: 'Sound Views',      key: 'tiktok_views', type: 'number', placeholder: '0' },
              { label: 'Top Video Views',  key: 'streams',      type: 'number', placeholder: '0' },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{f.label}</div>
                <input
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', padding: '6px 8px', fontSize: '11px', fontFamily: 'var(--font)', color: 'var(--text)', boxSizing: 'border-box' }}
                  type={f.type} placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Notes (optional)</div>
            <input
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', padding: '6px 8px', fontSize: '11px', fontFamily: 'var(--font)', color: 'var(--text)', boxSizing: 'border-box' }}
              placeholder="e.g. playlist add, TikTok spike…"
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={saving}
              style={{ background: 'var(--pink)', color: 'var(--green)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '7px 20px', fontSize: '11px', letterSpacing: '0.06em', cursor: 'pointer', fontFamily: 'var(--font)' }}>
              {saving ? 'saving…' : 'save'}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '7px 14px', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font)' }}>
              cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function Reports() {
  const navigate = useNavigate()
  const [releases, setReleases] = useState([])
  const [loading, setLoading]   = useState(true)
  const [copied, setCopied]     = useState(false)
  const [stageFilter, setStageFilter] = useState('all')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: rels } = await supabase
      .from('releases')
      .select('*, track:tracks(*)')
      .neq('archived', true)
      .order('release_date', { ascending: false })

    if (!rels) { setLoading(false); return }

    const enriched = await Promise.all(rels.map(async r => {
      const [perfRes, checkRes] = await Promise.all([
        supabase.from('performance_data').select('streams, tiktok_uses, tiktok_views').eq('release_id', r.id),
        supabase.from('checklist_items').select('checklist, completed').eq('release_id', r.id),
      ])

      const perf  = perfRes.data ?? []
      const items = checkRes.data ?? []

      const pre  = items.filter(i => i.checklist === 'pre_release')
      const post = items.filter(i => i.checklist === 'post_release')

      return {
        ...r,
        _streams:   perf.reduce((a, p) => a + (p.streams || 0), 0),
        _ttUses:    perf.reduce((a, p) => a + (p.tiktok_uses || 0), 0),
        _ttViews:   perf.reduce((a, p) => a + (p.tiktok_views || 0), 0),
        _preDone:   pre.filter(i => i.completed).length,
        _preTotal:  pre.length,
        _postDone:  post.filter(i => i.completed).length,
        _postTotal: post.length,
      }
    }))

    setReleases(enriched)
    setLoading(false)
  }

  const activeStages = ['tease_window', 'released', 'reporting']
  const visible = stageFilter === 'active'
    ? releases.filter(r => activeStages.includes(r.stage))
    : releases

  async function copyReport() {
    const text = buildReportText(visible)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <div style={s.pageTitle}>WEEKLY REPORT</div>
          <div style={s.pageSubtitle}>week of {weekOf()}</div>
        </div>
        <div style={s.headerRight}>
          <div style={s.filters}>
            <button style={{ ...s.filterBtn, ...(stageFilter === 'all' ? s.filterActive : {}) }} onClick={() => setStageFilter('all')}>
              all releases
            </button>
            <button style={{ ...s.filterBtn, ...(stageFilter === 'active' ? s.filterActive : {}) }} onClick={() => setStageFilter('active')}>
              live only
            </button>
          </div>
          <button style={s.weeklyBtn} onClick={() => navigate('/weekly-report')}>
            ↓ weekly PDF
          </button>
          <button style={{ ...s.copyBtn, ...(copied ? s.copiedBtn : {}) }} onClick={copyReport} disabled={loading}>
            {copied ? 'copied ✓' : 'copy report'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={s.empty}>generating report...</div>
      ) : visible.length === 0 ? (
        <div style={s.empty}>
          no {stageFilter === 'active' ? 'live' : ''} releases —{' '}
          <Link to="/pipeline" style={{ color: 'var(--bronze)' }}>go to pipeline</Link>
        </div>
      ) : (
        <div style={s.cards}>
          {visible.map(r => {
            const days = daysSince(r.release_date)
            const preProgress  = r._preTotal  ? Math.round((r._preDone  / r._preTotal)  * 100) : 0
            const postProgress = r._postTotal ? Math.round((r._postDone / r._postTotal) * 100) : 0

            return (
              <div key={r.id} style={s.card}>
                {/* Card header */}
                <div style={s.cardHeader}>
                  <div>
                    <Link to={`/releases/${r.id}`} style={s.cardTitle}>
                      {r.track?.title ?? '—'}
                    </Link>
                    <div style={s.cardArtist}>{r.track?.artist ?? '—'}</div>
                  </div>
                  <div style={s.cardMeta}>
                    <span style={s.stagePill}>{STAGE_LABEL[r.stage]}</span>
                    {r.release_date && (
                      <span style={s.datePill}>
                        {new Date(r.release_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {days !== null && days >= 0 && <> · {days}d live</>}
                      </span>
                    )}
                  </div>
                </div>

                <div style={s.cardDivider} />

                {/* Stats row */}
                <div style={s.statsRow}>
                  {[
                    { label: 'Sound Uses',      value: fmt(r._ttUses) },
                    { label: 'Sound Views',     value: fmt(r._ttViews) },
                    { label: 'Top Video Views', value: fmt(r._streams) },
                  ].map(stat => (
                    <div key={stat.label} style={s.stat}>
                      <div style={s.statValue}>{stat.value}</div>
                      <div style={s.statLabel}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div style={s.cardDivider} />

                {/* Checklists */}
                <div style={s.checklistRow}>
                  {[
                    { label: 'Pre-release',  done: r._preDone,  total: r._preTotal,  pct: preProgress },
                    { label: 'Post-release', done: r._postDone, total: r._postTotal, pct: postProgress },
                  ].map(cl => (
                    <div key={cl.label} style={s.checklistBlock}>
                      <div style={s.checklistHeader}>
                        <span style={s.checklistLabel}>{cl.label}</span>
                        <span style={s.checklistCount}>{cl.done}/{cl.total}</span>
                      </div>
                      <div style={s.bar}>
                        <div style={{ ...s.barFill, width: `${cl.pct}%`, background: cl.pct === 100 ? 'var(--bronze)' : 'var(--bronze-dim)' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                {r.notes && (
                  <div style={s.notesBlock}>
                    <span style={s.notesLabel}>notes</span>
                    <span style={s.notesText}>{r.notes}</span>
                  </div>
                )}

                <LogDataForm releaseId={r.id} onSaved={fetchData} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const s = {
  page:   { display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 48px)' },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '12px',
  },
  pageTitle:   { fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 500 },
  pageSubtitle: { fontSize: '12px', color: 'var(--text)', marginTop: '3px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  filters:     { display: 'flex', gap: '6px' },
  filterBtn:   { background: '#fff', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '7px 16px', fontSize: '11px', letterSpacing: '0.05em', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font)' },
  filterActive: { background: 'var(--pink)', borderColor: 'var(--pink)', color: 'var(--green)', fontWeight: 600 },
  weeklyBtn:   { background: 'var(--pink)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '7px 16px', fontSize: '11px', letterSpacing: '0.06em', cursor: 'pointer', color: 'var(--green)', fontFamily: 'var(--font)' },
  copyBtn:     { background: '#fff', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '7px 16px', fontSize: '11px', letterSpacing: '0.06em', cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font)' },
  copiedBtn:   { background: 'var(--pink)', color: 'var(--green)', borderColor: 'var(--pink)' },

  empty: { padding: '48px 24px', color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.06em' },

  cards: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' },

  card:       { background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: '16px', padding: '20px 24px' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
  cardTitle:  { fontSize: '15px', fontWeight: 500, color: 'var(--green)', textDecoration: 'none', display: 'block', marginBottom: '2px' },
  cardArtist: { fontSize: '12px', color: 'var(--text-muted)' },
  cardMeta:   { display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 },
  cardDivider: { height: '1px', background: 'var(--border)', margin: '16px 0' },

  stagePill: { fontSize: '10px', letterSpacing: '0.06em', color: 'var(--green)', border: '1.5px solid var(--border)', background: 'var(--pink)', padding: '2px 10px', borderRadius: 'var(--radius-pill)' },
  datePill:  { fontSize: '10px', letterSpacing: '0.04em', color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' },

  statsRow:  { display: 'flex', gap: '0' },
  stat:      { flex: 1, padding: '0 16px 0 0' },
  statValue: { fontSize: '20px', fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '2px' },
  statLabel: { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' },

  checklistRow:   { display: 'flex', gap: '24px' },
  checklistBlock: { flex: 1 },
  checklistHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  checklistLabel:  { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em' },
  checklistCount:  { fontSize: '11px', color: 'var(--text-muted)' },
  bar:     { height: '3px', background: 'var(--surface-2)', borderRadius: '2px' },
  barFill: { height: '100%', borderRadius: '2px', transition: 'width 0.4s' },

  notesBlock: { marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'baseline' },
  notesLabel: { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', flexShrink: 0 },
  notesText:  { fontSize: '12px', color: 'var(--text)', lineHeight: 1.5 },
}
