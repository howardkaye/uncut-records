import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TeaseReportsView from '../components/TeaseReportsView'

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
          + log tiktok update
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

function AdsLogForm({ releaseId, onSaved }) {
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({
    report_date: new Date().toISOString().slice(0, 10),
    amount_spent: '', impressions: '', link_clicks: '', service_clicks: '',
    pre_saves: '', cpc: '', cpsc: '', cpps: '',
    top_creative_url: '', top_creative_clicks: '', notes: '',
  })

  function set(key) { return e => setForm(p => ({ ...p, [key]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('ads_reports').insert({
      release_id:          releaseId,
      report_date:         form.report_date,
      amount_spent:        parseFloat(form.amount_spent)        || null,
      impressions:         parseInt(form.impressions)           || null,
      link_clicks:         parseInt(form.link_clicks)           || null,
      service_clicks:      parseInt(form.service_clicks)        || null,
      pre_saves:           parseInt(form.pre_saves)             || null,
      cpc:                 parseFloat(form.cpc)                 || null,
      cpsc:                parseFloat(form.cpsc)                || null,
      cpps:                parseFloat(form.cpps)                || null,
      top_creative_url:    form.top_creative_url.trim()         || null,
      top_creative_clicks: parseInt(form.top_creative_clicks)   || null,
      notes:               form.notes.trim()                    || null,
    })
    if (!error) {
      setForm(p => ({ ...p, amount_spent: '', impressions: '', link_clicks: '',
        service_clicks: '', pre_saves: '', cpc: '', cpsc: '', cpps: '',
        top_creative_url: '', top_creative_clicks: '', notes: '' }))
      setOpen(false)
      onSaved()
    }
    setSaving(false)
  }

  const inp = { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', padding: '6px 8px', fontSize: '11px', fontFamily: 'var(--font)', color: 'var(--text)', boxSizing: 'border-box' }
  const lbl = { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }

  return (
    <div style={{ marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
      {!open ? (
        <button
          style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '6px 16px', fontSize: '11px', letterSpacing: '0.06em', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}
          onClick={() => setOpen(true)}>
          + log ads update
        </button>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {[
              { label: 'Date',               key: 'report_date',    type: 'date' },
              { label: 'Amount Spent (£)',    key: 'amount_spent',   type: 'number', step: 'any', placeholder: '146.36' },
              { label: 'Impressions',         key: 'impressions',    type: 'number', placeholder: '26380' },
              { label: 'Link Clicks',         key: 'link_clicks',    type: 'number', placeholder: '1706' },
            ].map(f => (
              <div key={f.key}>
                <div style={lbl}>{f.label}</div>
                <input type={f.type} step={f.step} style={inp} placeholder={f.placeholder} value={form[f.key]} onChange={set(f.key)} />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {[
              { label: 'Service Clicks', key: 'service_clicks', type: 'number', placeholder: '1408' },
              { label: 'Pre-Saves',      key: 'pre_saves',      type: 'number', placeholder: '379' },
              { label: 'CPC (£)',        key: 'cpc',            type: 'number', step: 'any', placeholder: '0.09' },
              { label: 'CPSC (£)',       key: 'cpsc',           type: 'number', step: 'any', placeholder: '0.10' },
            ].map(f => (
              <div key={f.key}>
                <div style={lbl}>{f.label}</div>
                <input type={f.type} step={f.step} style={inp} placeholder={f.placeholder} value={form[f.key]} onChange={set(f.key)} />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 140px', gap: '10px' }}>
            <div>
              <div style={lbl}>CPPS (£)</div>
              <input type="number" step="any" style={inp} placeholder="0.39" value={form.cpps} onChange={set('cpps')} />
            </div>
            <div>
              <div style={lbl}>Top Creative URL</div>
              <input type="url" style={inp} placeholder="https://www.instagram.com/p/..." value={form.top_creative_url} onChange={set('top_creative_url')} />
            </div>
            <div>
              <div style={lbl}>Creative Clicks</div>
              <input type="number" style={inp} placeholder="1394" value={form.top_creative_clicks} onChange={set('top_creative_clicks')} />
            </div>
          </div>
          <div>
            <div style={lbl}>Notes (optional)</div>
            <input style={inp} placeholder="Any extra context…" value={form.notes} onChange={set('notes')} />
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

function AdsSection({ reports, onDeleted }) {
  if (!reports || reports.length === 0) return null
  const latest = reports[0]
  const fmtGbp = n => n != null ? `£${parseFloat(n).toFixed(2)}` : '—'
  const fmtN   = n => n != null ? parseInt(n).toLocaleString() : '—'

  async function handleDelete() {
    await supabase.from('ads_reports').delete().eq('id', latest.id)
    onDeleted()
  }

  return (
    <div style={{ marginTop: '16px', padding: '14px 16px', background: 'var(--surface-2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Ads</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>{fmtGbp(latest.amount_spent)}</span>
          <span style={{ fontSize: '10px', letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>spent</span>
          {latest.report_date && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', border: '1px solid var(--border)', background: '#fff', padding: '2px 7px', borderRadius: 'var(--radius-pill)' }}>
              {new Date(latest.report_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
          <button onClick={handleDelete}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1, padding: '2px 4px', borderRadius: '4px' }}
            title="Delete this ads report">
            ×
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0', marginBottom: '10px' }}>
        {[
          { label: 'Impressions',    value: fmtN(latest.impressions) },
          { label: 'Link Clicks',    value: fmtN(latest.link_clicks) },
          { label: 'Service Clicks', value: fmtN(latest.service_clicks) },
          { label: 'Pre-Saves',      value: fmtN(latest.pre_saves) },
        ].map(stat => (
          <div key={stat.label} style={{ paddingRight: '12px' }}>
            <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '1px' }}>{stat.value}</div>
            <div style={{ fontSize: '10px', letterSpacing: '0.07em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{stat.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { label: 'CPC',  value: fmtGbp(latest.cpc) },
          { label: 'CPSC', value: fmtGbp(latest.cpsc) },
          { label: 'CPPS', value: fmtGbp(latest.cpps) },
        ].map(m => m.value !== '—' && (
          <div key={m.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px', display: 'flex', gap: '6px', alignItems: 'baseline' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{m.value}</span>
            <span style={{ fontSize: '10px', letterSpacing: '0.07em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{m.label}</span>
          </div>
        ))}
        {latest.top_creative_url && (
          <a href={latest.top_creative_url} target="_blank" rel="noreferrer"
            style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', color: 'var(--bronze)', textDecoration: 'none', display: 'flex', gap: '6px', alignItems: 'center' }}>
            top creative
            {latest.top_creative_clicks != null && <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{fmtN(latest.top_creative_clicks)} clicks</span>}
          </a>
        )}
      </div>
      {latest.notes && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{latest.notes}</div>
      )}
    </div>
  )
}

export default function Reports() {
  const navigate = useNavigate()
  const [releases,      setReleases]      = useState([])
  const [teaseReleases, setTeaseReleases] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [copied,        setCopied]        = useState(false)
  const [stageFilter,   setStageFilter]   = useState('all')
  const [activeTab,     setActiveTab]     = useState('performance') // 'performance' | 'tease'

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: rels }, { data: allAds }] = await Promise.all([
      supabase.from('releases').select('*, track:tracks(*)').neq('archived', true).order('release_date', { ascending: false }),
      supabase.from('ads_reports').select('*').order('report_date', { ascending: false }),
    ])

    supabase
      .from('releases')
      .select('*, track:tracks(*)')
      .in('stage', ['tease_window', 'reporting'])
      .neq('archived', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setTeaseReleases(data ?? []))

    if (!rels) { setLoading(false); return }

    const adsByRelease = {}
    for (const a of (allAds ?? [])) {
      if (!adsByRelease[a.release_id]) adsByRelease[a.release_id] = []
      adsByRelease[a.release_id].push(a)
    }

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
        _ads:       adsByRelease[r.id] ?? [],
      }
    }))

    setReleases(enriched)
    setLoading(false)
  }

  const activeStages = ['tease_window', 'reporting']
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
          <div style={s.pageSuper}>WEEK OF {weekOf().toUpperCase()}</div>
          <div style={s.pageTitle}>REPORTS</div>
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

      {/* Tab bar */}
      <div style={s.tabBar}>
        <button
          style={{ ...s.tabBtn, ...(activeTab === 'performance' ? s.tabActive : {}) }}
          onClick={() => setActiveTab('performance')}>
          Performance
        </button>
        <button
          style={{ ...s.tabBtn, ...(activeTab === 'tease' ? s.tabActive : {}) }}
          onClick={() => setActiveTab('tease')}>
          Tease Reports {teaseReleases.length > 0 && `(${teaseReleases.length})`}
        </button>
      </div>

      {/* Tease Reports tab */}
      {activeTab === 'tease' && (
        <div style={s.teaseSection}>
          {teaseReleases.length === 0 ? (
            <div style={s.empty}>No releases currently in tease window or reporting.</div>
          ) : teaseReleases.map(r => (
            <div key={r.id} style={s.teaseBlock}>
              <div style={s.teaseBlockHeader}>
                <div>
                  <div style={s.teaseTrackTitle}>{r.track?.title ?? '—'}</div>
                  <div style={s.teaseTrackArtist}>{r.track?.artist ?? '—'}</div>
                </div>
                <span style={{ ...s.stagePill, background: r.stage === 'tease_window' ? 'var(--pink)' : 'var(--surface-2)' }}>
                  {r.stage === 'tease_window' ? 'In Market' : 'Reporting'}
                </span>
              </div>
              <TeaseReportsView release={r} />
            </div>
          ))}
        </div>
      )}

      {/* Performance tab */}
      {activeTab === 'performance' && (
        loading ? (
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

                {/* TikTok stats */}
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

                {/* Ads section */}
                <AdsSection reports={r._ads} onDeleted={fetchData} />

                {r.notes && (
                  <div style={s.notesBlock}>
                    <span style={s.notesLabel}>notes</span>
                    <span style={s.notesText}>{r.notes}</span>
                  </div>
                )}

                <LogDataForm releaseId={r.id} onSaved={fetchData} />
                <AdsLogForm  releaseId={r.id} onSaved={fetchData} />
              </div>
            )
          })}
          </div>
        )
      )}
    </div>
  )
}

const s = {
  page:   { display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 48px)' },

  tabBar:   { display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', background: '#fff' },
  tabBtn:   { background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '11px 18px', fontSize: '12px', letterSpacing: '0.05em', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '-1px', fontFamily: 'var(--font)' },
  tabActive: { color: 'var(--green)', borderBottomColor: 'var(--green)', fontWeight: 500 },

  teaseSection:    { display: 'flex', flexDirection: 'column', gap: '32px', padding: '24px' },
  teaseBlock:      { display: 'flex', flexDirection: 'column', gap: '20px' },
  teaseBlockHeader:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', paddingBottom: '12px', borderBottom: '1.5px solid var(--border)' },
  teaseTrackTitle: { fontSize: '16px', fontWeight: 500, color: 'var(--green)', marginBottom: '2px' },
  teaseTrackArtist:{ fontSize: '12px', color: 'var(--text-muted)' },
  header: {
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '12px',
  },
  pageSuper:   { fontFamily: 'var(--font)', fontSize: '11px', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' },
  pageTitle:   { fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 900, color: 'var(--green)', letterSpacing: '-0.01em', lineHeight: 0.9 },
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
