import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

async function downloadAsPDF(element, filename) {
  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF }       = await import('jspdf')
  await document.fonts.ready
  const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' })
  const img    = canvas.toDataURL('image/png')
  const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pw     = pdf.internal.pageSize.getWidth()
  const ph     = pdf.internal.pageSize.getHeight()
  const ih     = (canvas.height * pw) / canvas.width
  let left     = ih
  pdf.addImage(img, 'PNG', 0, 0, pw, ih)
  left -= ph
  while (left > 0) {
    pdf.addPage()
    pdf.addImage(img, 'PNG', 0, left - ih, pw, ih)
    left -= ph
  }
  pdf.save(filename)
}

// ── Calculations ─────────────────────────────────────────────────────────────

function calcMetrics(reports) {
  const allVideos = []
  const accMap = {}

  for (const r of reports) {
    for (const acc of (r.accounts ?? [])) {
      if (!accMap[acc.account_name]) accMap[acc.account_name] = { total_videos: 0, total_views: 0, total_likes: 0 }
      const s = accMap[acc.account_name]
      const vids = acc.videos ?? []
      s.total_videos += vids.length
      s.total_views  += vids.reduce((a, v) => a + (v.views || 0), 0)
      s.total_likes  += vids.reduce((a, v) => a + (v.likes || 0), 0)
      vids.forEach(v => allVideos.push({ ...v, account_name: acc.account_name }))
    }
  }

  Object.values(accMap).forEach(s => {
    s.ratio = s.total_views > 0 ? s.total_likes / s.total_views * 100 : 0
  })

  const combined = {
    total_videos: allVideos.length,
    total_views:  allVideos.reduce((a, v) => a + (v.views || 0), 0),
    total_likes:  allVideos.reduce((a, v) => a + (v.likes || 0), 0),
  }
  combined.ratio = combined.total_views > 0 ? combined.total_likes / combined.total_views * 100 : 0

  const top5Views = [...allVideos].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5)
  const top5Likes = [...allVideos].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 5)

  const themeMap = {}
  allVideos.filter(v => v.content_theme).forEach(v => {
    const r = v.views > 0 ? v.likes / v.views * 100 : 0
    if (!themeMap[v.content_theme]) themeMap[v.content_theme] = []
    themeMap[v.content_theme].push(r)
  })
  const themes = Object.entries(themeMap)
    .map(([theme, ratios]) => ({ theme, avg: ratios.reduce((a, b) => a + b, 0) / ratios.length, count: ratios.length }))
    .sort((a, b) => b.avg - a.avg)

  return { accMap, combined, top5Views, top5Likes, themes }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

function fmtRatio(r) {
  return typeof r === 'number' ? `${r.toFixed(1)}%` : '—'
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(release, reports, m) {
  const track = release.track ?? {}
  const rows = []
  const cell = c => `"${String(c ?? '').replace(/"/g, '""')}"`
  const row  = cols => rows.push(cols.map(cell).join(','))

  row(['Uncut Records — Tease Window Report'])
  row([`Release: ${track.title ?? '—'}${track.artist && track.artist !== 'TBC' ? ` — ${track.artist}` : ''}`])
  row([`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`])
  row([])
  row(['SUMMARY'])
  row(['Total Videos', 'Total Views', 'Total Likes', 'Like-to-View Ratio'])
  row([m.combined.total_videos, m.combined.total_views, m.combined.total_likes, fmtRatio(m.combined.ratio)])
  row([])

  if (Object.keys(m.accMap).length > 1) {
    row(['PER ACCOUNT'])
    row(['Account', 'Videos', 'Views', 'Likes', 'Ratio'])
    Object.entries(m.accMap).forEach(([name, s]) => row([name, s.total_videos, s.total_views, s.total_likes, fmtRatio(s.ratio)]))
    row([])
  }

  row(['TOP 5 BY VIEWS'])
  row(['Account', 'Views', 'Likes', 'Ratio', 'Theme', 'URL'])
  m.top5Views.forEach(v => {
    const r = v.views > 0 ? `${(v.likes / v.views * 100).toFixed(1)}%` : '—'
    row([v.account_name, v.views, v.likes, r, v.content_theme ?? '', v.video_url ?? ''])
  })
  row([])

  row(['TOP 5 BY LIKES'])
  row(['Account', 'Views', 'Likes', 'Ratio', 'Theme', 'URL'])
  m.top5Likes.forEach(v => {
    const r = v.views > 0 ? `${(v.likes / v.views * 100).toFixed(1)}%` : '—'
    row([v.account_name, v.views, v.likes, r, v.content_theme ?? '', v.video_url ?? ''])
  })

  if (m.themes.length > 0) {
    row([])
    row(['CONTENT THEME ANALYSIS'])
    row(['Theme', 'Avg Ratio', 'Videos'])
    m.themes.forEach(t => row([t.theme, fmtRatio(t.avg), t.count]))
  }

  const csv  = rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `${track.title ?? 'Release'} — Tease Report.csv`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TeaseReportsView({ release }) {
  const [reports,   setReports]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef(null)

  useEffect(() => {
    supabase
      .from('tease_reports')
      .select(`
        report_id, period_start, period_end, created_at,
        accounts:tease_report_accounts(
          account_id, account_name,
          videos:tease_report_videos(video_id, views, likes, content_theme, video_url, notes)
        )
      `)
      .eq('release_id', release.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setReports(data ?? []); setLoading(false) })
  }, [release.id])

  if (loading) return <div style={s.empty}>loading reports…</div>
  if (reports.length === 0) return <div style={s.empty}>No reports submitted yet.</div>

  const m = calcMetrics(reports)

  async function handlePDF() {
    setExporting(true)
    await downloadAsPDF(reportRef.current, `${release.track?.title ?? 'Release'} — Tease Report.pdf`)
    setExporting(false)
  }

  return (
    <div style={s.wrapper}>

      {/* Toolbar — excluded from PDF capture */}
      <div style={s.toolbar}>
        <span style={s.reportCount}>{reports.length} report{reports.length !== 1 ? 's' : ''} submitted</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={s.exportBtn} onClick={() => exportCSV(release, reports, m)}>↓ CSV</button>
          <button style={{ ...s.exportBtn, opacity: exporting ? 0.6 : 1 }} onClick={handlePDF} disabled={exporting}>
            {exporting ? 'generating…' : '↓ PDF'}
          </button>
        </div>
      </div>

      {/* Everything below is captured into the PDF */}
      <div ref={reportRef} style={{ background: '#fff', padding: '20px 0' }}>

      {/* PDF header */}
      <div style={s.printHeader}>
        <div>
          <div style={s.printWordmark}>UNCUT RECORDS</div>
          <div style={s.printTitle}>{release.track?.title ?? '—'} — Tease Window Report</div>
        </div>
        <div style={s.printDate}>Generated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>

      {/* Summary stats */}
      <div style={s.statRow}>
        {[
          ['Total Videos',       m.combined.total_videos],
          ['Total Views',        fmt(m.combined.total_views)],
          ['Total Likes',        fmt(m.combined.total_likes)],
          ['Like-to-View Ratio', fmtRatio(m.combined.ratio)],
        ].map(([label, value]) => (
          <div key={label} style={s.statCard}>
            <div style={s.statValue}>{value}</div>
            <div style={s.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* Per account — only show if more than one */}
      {Object.keys(m.accMap).length > 1 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Per Account</div>
          <table style={s.table}>
            <thead>
              <tr>{['Account', 'Videos', 'Views', 'Likes', 'Ratio'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {Object.entries(m.accMap).map(([name, as]) => (
                <tr key={name} style={s.tr}>
                  <td style={s.td}>{name}</td>
                  <td style={s.td}>{as.total_videos}</td>
                  <td style={s.td}>{fmt(as.total_views)}</td>
                  <td style={s.td}>{fmt(as.total_likes)}</td>
                  <td style={{ ...s.td, fontWeight: 500 }}>{fmtRatio(as.ratio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top 5 */}
      <div style={s.twoCol}>
        {[
          { title: 'Top 5 by Views', list: m.top5Views, primary: 'views' },
          { title: 'Top 5 by Likes', list: m.top5Likes, primary: 'likes' },
        ].map(({ title, list, primary }) => (
          <div key={title} style={s.section}>
            <div style={s.sectionTitle}>{title}</div>
            <div style={s.vidList}>
              {list.map((v, i) => {
                const ratio = v.views > 0 ? `${(v.likes / v.views * 100).toFixed(1)}%` : '—'
                return (
                  <div key={v.video_id ?? i} style={s.vidItem}>
                    <div style={s.vidRank}>{i + 1}</div>
                    <div style={s.vidInfo}>
                      <div style={s.vidStats}>
                        {primary === 'views'
                          ? <>{fmt(v.views)} views · {fmt(v.likes)} likes</>
                          : <>{fmt(v.likes)} likes · {fmt(v.views)} views</>}
                        <span style={s.vidRatio}>{ratio}</span>
                      </div>
                      {v.content_theme && <div style={s.vidTheme}>{v.content_theme}</div>}
                      <div style={s.vidAcc}>{v.account_name}</div>
                      {v.video_url && (
                        <a href={v.video_url} target="_blank" rel="noreferrer" style={s.vidLink}>↗ view</a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Theme analysis */}
      {m.themes.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Content Theme Analysis</div>
          <div style={s.themeGrid}>
            {m.themes.map((t, i) => (
              <div key={t.theme} style={{ ...s.themeCard, ...(i === 0 ? s.themeCardBest : {}) }}>
                {i === 0 && <div style={s.bestBadge}>best</div>}
                <div style={s.themeName}>{t.theme}</div>
                <div style={s.themeRatio}>{fmtRatio(t.avg)}</div>
                <div style={s.themeCount}>avg · {t.count} video{t.count !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submission history */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Submissions</div>
        {reports.map(r => {
          const vidCount = (r.accounts ?? []).reduce((a, acc) => a + (acc.videos ?? []).length, 0)
          return (
            <div key={r.report_id} style={s.subRow}>
              <span style={s.subPeriod}>{fmtDate(r.period_start)} — {fmtDate(r.period_end)}</span>
              <span style={s.subMeta}>{vidCount} video{vidCount !== 1 ? 's' : ''} · {(r.accounts ?? []).length} account{(r.accounts ?? []).length !== 1 ? 's' : ''}</span>
              <span style={s.subDate}>submitted {fmtDate(r.created_at)}</span>
            </div>
          )
        })}
      </div>

      </div> {/* end PDF capture div */}
    </div>
  )
}

const s = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '20px' },
  empty:   { fontSize: '12px', color: 'var(--text-muted)', padding: '16px 0', fontStyle: 'italic' },

  toolbar:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  reportCount: { fontSize: '12px', color: 'var(--text-muted)' },
  exportBtn:   { background: '#fff', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '6px 16px', fontSize: '11px', letterSpacing: '0.05em', cursor: 'pointer', color: 'var(--green)', fontFamily: 'var(--font)' },

  printHeader:  { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1.5px solid var(--border)' },
  printWordmark:{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.14em', color: 'var(--green)', marginBottom: '6px', textTransform: 'uppercase', fontFamily: 'var(--font)' },
  printTitle:   { fontSize: '20px', fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-display)', fontVariationSettings: '"YEAR" 2050' },
  printDate:    { fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right', paddingTop: '4px' },

  statRow:   { display: 'flex', gap: '12px' },
  statCard:  { flex: 1, background: 'var(--surface)', border: '1.5px solid var(--border)', padding: '16px 18px' },
  statValue: { fontSize: '22px', fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '4px' },
  statLabel: { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' },

  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },

  section:      { background: 'var(--surface)', border: '1.5px solid var(--border)', padding: '18px 20px' },
  sectionTitle: { fontSize: '10px', letterSpacing: '0.12em', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' },

  table: { width: '100%', borderCollapse: 'collapse' },
  th:    { fontSize: '10px', letterSpacing: '0.07em', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'left', padding: '7px 10px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' },
  tr:    { borderBottom: '1px solid var(--border)' },
  td:    { fontSize: '12px', padding: '8px 10px', color: 'var(--text)' },

  vidList:  { display: 'flex', flexDirection: 'column', gap: '0' },
  vidItem:  { display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border)' },
  vidRank:  { width: '20px', height: '20px', borderRadius: '50%', background: 'var(--pink)', color: 'var(--green)', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' },
  vidInfo:  { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  vidStats: { fontSize: '13px', fontWeight: 500, color: 'var(--text)', display: 'flex', gap: '8px', alignItems: 'baseline' },
  vidRatio: { fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 },
  vidTheme: { fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' },
  vidAcc:   { fontSize: '11px', color: 'var(--text-muted)' },
  vidLink:  { fontSize: '11px', color: 'var(--green)', textDecoration: 'underline', display: 'inline-block', marginTop: '2px' },

  themeGrid:     { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  themeCard:     { background: 'var(--bg)', border: '1.5px solid var(--border)', padding: '14px 16px', minWidth: '140px', position: 'relative' },
  themeCardBest: { background: 'var(--pink)', borderColor: 'var(--pink)' },
  bestBadge:     { position: 'absolute', top: '8px', right: '8px', fontSize: '9px', letterSpacing: '0.08em', background: 'var(--green)', color: '#fff', padding: '2px 6px', textTransform: 'uppercase' },
  themeName:     { fontSize: '12px', fontWeight: 500, color: 'var(--green)', marginBottom: '4px', marginTop: '4px' },
  themeRatio:    { fontSize: '20px', fontWeight: 600, color: 'var(--green)', letterSpacing: '-0.02em', marginBottom: '2px' },
  themeCount:    { fontSize: '10px', color: 'var(--green)', opacity: 0.7, letterSpacing: '0.04em' },

  subRow:    { display: 'flex', gap: '16px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' },
  subPeriod: { fontSize: '12px', fontWeight: 500, color: 'var(--text)' },
  subMeta:   { fontSize: '11px', color: 'var(--text-muted)' },
  subDate:   { fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' },
}
