import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const STAGES = ['intake','pre_release','tease_window','released','reporting']
const STAGE_LABELS = {
  intake: 'Intake',
  pre_release: 'Pre-release',
  tease_window: 'Tease Window',
  released: 'Released',
  reporting: 'Reporting',
}

function weekEnding() {
  const d = new Date()
  // Find the coming/current Friday
  const day = d.getDay()
  const diff = day <= 5 ? 5 - day : 6
  d.setDate(d.getDate() + diff)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmt(n) {
  if (!n) return '0'
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.floor((new Date() - new Date(dateStr)) / 86400000)
}

export default function WeeklyReport() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const reportRef = useRef(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [releasesRes, logsRes, perfRes] = await Promise.all([
      supabase.from('releases')
        .select('*, track:tracks(*)')
        .order('created_at', { ascending: false }),
      supabase.from('tease_window_logs')
        .select('*, logger:logged_by(full_name, email)')
        .order('logged_at', { ascending: false }),
      supabase.from('performance_data')
        .select('*')
        .order('report_date', { ascending: false }),
    ])

    const releases  = releasesRes.data ?? []
    const logs      = logsRes.data ?? []
    const perf      = perfRes.data ?? []

    // Pipeline counts
    const pipeline = {}
    STAGES.forEach(s => { pipeline[s] = releases.filter(r => r.stage === s) })

    // Active tease window
    const teaseReleases = pipeline['tease_window']

    // Tease logs per release
    const teaseLogs = {}
    teaseReleases.forEach(r => {
      teaseLogs[r.id] = logs.filter(l => l.release_id === r.id).slice(0, 3)
    })

    // Performance — last 14 days, grouped by release
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    const recentPerf = perf.filter(p => new Date(p.report_date) >= cutoff)

    const perfByRelease = {}
    recentPerf.forEach(p => {
      if (!perfByRelease[p.release_id]) perfByRelease[p.release_id] = []
      perfByRelease[p.release_id].push(p)
    })

    // Released / reporting tracks with recent perf
    const activeReleases = [...pipeline['released'], ...pipeline['reporting']]
      .filter(r => perfByRelease[r.id])

    // Recent decisions (last 14 days)
    const recentDecisions = releases.filter(r => {
      if (!r.friday_decision) return false
      const updated = new Date(r.updated_at)
      return (new Date() - updated) <= 14 * 86400000
    })

    // Upcoming — pre-release with release dates
    const upcoming = pipeline['pre_release']
      .filter(r => r.release_date)
      .sort((a, b) => new Date(a.release_date) - new Date(b.release_date))

    setData({ pipeline, teaseReleases, teaseLogs, perfByRelease, activeReleases, recentDecisions, upcoming })
    setLoading(false)
  }

  function handlePrint() {
    window.print()
  }

  if (loading) return <div style={s.loading}>building report...</div>

  const { pipeline, teaseReleases, teaseLogs, perfByRelease, activeReleases, recentDecisions, upcoming } = data
  const totalInPipeline = STAGES.reduce((n, st) => n + pipeline[st].length, 0)

  return (
    <div>
      {/* Print button — hidden when printing */}
      <div style={s.toolbar} className="no-print">
        <span style={s.toolbarLabel}>Weekly Report</span>
        <button style={s.printBtn} onClick={handlePrint}>↓ Download PDF</button>
      </div>

      {/* Report content */}
      <div ref={reportRef} style={s.report}>

        {/* Header */}
        <div style={s.reportHeader}>
          <div>
            <div style={s.reportWordmark}>UNCUT RECORDS</div>
            <div style={s.reportSub}>Weekly Update</div>
          </div>
          <div style={s.reportDate}>Week ending {weekEnding()}</div>
        </div>
        <div style={s.rule} />

        {/* Pipeline snapshot */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Pipeline at a Glance</div>
          <div style={s.snapshotGrid}>
            {STAGES.map(st => (
              <div key={st} style={{ ...s.snapshotCell, ...(st === 'tease_window' ? s.snapshotCellHighlight : {}) }}>
                <div style={s.snapshotStage}>{STAGE_LABELS[st]}</div>
                <div style={s.snapshotCount}>{pipeline[st].length}</div>
                <div style={s.snapshotTracks}>
                  {pipeline[st].slice(0, 3).map(r => (
                    <div key={r.id} style={s.snapshotTrack}>
                      {r.track?.title ?? '—'}{r.track?.artist && r.track.artist !== 'TBC' ? ` — ${r.track.artist}` : ''}
                    </div>
                  ))}
                  {pipeline[st].length > 3 && (
                    <div style={{ ...s.snapshotTrack, color: '#999' }}>+{pipeline[st].length - 3} more</div>
                  )}
                  {pipeline[st].length === 0 && (
                    <div style={{ ...s.snapshotTrack, color: '#bbb' }}>—</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={s.snapshotTotal}>{totalInPipeline} total track{totalInPipeline !== 1 ? 's' : ''} in the pipeline</div>
        </div>

        <div style={s.rule} />

        {/* Tease Window */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Tease Window</div>
          {teaseReleases.length === 0 ? (
            <p style={s.empty}>No tracks currently in the tease window.</p>
          ) : teaseReleases.map(r => (
            <div key={r.id} style={s.teaseBlock}>
              <div style={s.teaseTrack}>
                {r.track?.title ?? '—'}
                {r.track?.artist && r.track.artist !== 'TBC' && ` — ${r.track.artist}`}
              </div>
              <div style={s.teaseMeta}>
                {r.tease_start_date && (
                  <>
                    Tease started{' '}
                    {new Date(r.tease_start_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {' '}· Day {daysSince(r.tease_start_date) + 1}
                  </>
                )}
                {r.track?.bpm && ` · ${r.track.bpm} BPM`}
                {r.track?.track_key && ` · ${r.track.track_key}`}
                {r.track?.genre && ` · ${r.track.genre}`}
              </div>
              {teaseLogs[r.id]?.length > 0 && (
                <div style={s.logList}>
                  <div style={s.logListTitle}>Recent updates</div>
                  {teaseLogs[r.id].map(log => (
                    <div key={log.id} style={s.logItem}>
                      <span style={s.logDate}>
                        {new Date(log.logged_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      <span style={s.logText}>{log.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={s.rule} />

        {/* Performance */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Performance (Last 14 Days)</div>
          {activeReleases.length === 0 ? (
            <p style={s.empty}>No performance data recorded in the last 14 days.</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  {['Track', 'Artist', 'Released', 'Platform', 'Streams', 'TikTok Uses', 'TikTok Views'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeReleases.map(r => {
                  const rows = perfByRelease[r.id] ?? []
                  const totStreams  = rows.reduce((a, p) => a + (p.streams || 0), 0)
                  const totUses     = rows.reduce((a, p) => a + (p.tiktok_uses || 0), 0)
                  const totViews    = rows.reduce((a, p) => a + (p.tiktok_views || 0), 0)
                  const platforms   = [...new Set(rows.map(p => p.platform))].join(', ')
                  return (
                    <tr key={r.id} style={s.tr}>
                      <td style={s.td}>{r.track?.title ?? '—'}</td>
                      <td style={s.td}>{r.track?.artist ?? '—'}</td>
                      <td style={s.td}>{r.release_date ? new Date(r.release_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</td>
                      <td style={{ ...s.td, color: '#666' }}>{platforms || '—'}</td>
                      <td style={{ ...s.td, fontWeight: 500 }}>{fmt(totStreams)}</td>
                      <td style={s.td}>{fmt(totUses)}</td>
                      <td style={s.td}>{fmt(totViews)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={s.rule} />

        {/* Recent Decisions */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Recent Decisions</div>
          {recentDecisions.length === 0 ? (
            <p style={s.empty}>No release decisions made in the last 14 days.</p>
          ) : recentDecisions.map(r => (
            <div key={r.id} style={s.decisionRow}>
              <span style={{
                ...s.decisionBadge,
                background: r.friday_decision === 'release' ? '#eaf2e8' : '#f5ede0',
                color: r.friday_decision === 'release' ? '#4a7a3a' : '#a0723a',
                border: `1px solid ${r.friday_decision === 'release' ? '#b8d8b0' : '#c49a62'}`,
              }}>
                {r.friday_decision === 'release' ? 'Released' : 'Returned to pool'}
              </span>
              <span style={s.decisionTrack}>
                {r.track?.title ?? '—'}{r.track?.artist && r.track.artist !== 'TBC' ? ` — ${r.track.artist}` : ''}
              </span>
              <span style={s.decisionDate}>
                {new Date(r.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))}
        </div>

        <div style={s.rule} />

        {/* Coming Up */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Coming Up</div>
          {upcoming.length === 0 ? (
            <p style={s.empty}>No upcoming releases with confirmed dates.</p>
          ) : upcoming.map(r => (
            <div key={r.id} style={s.upcomingRow}>
              <span style={s.upcomingTrack}>
                {r.track?.title ?? '—'}{r.track?.artist && r.track.artist !== 'TBC' ? ` — ${r.track.artist}` : ''}
              </span>
              <span style={s.upcomingDate}>
                {new Date(r.release_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })}
              </span>
              <span style={s.upcomingDays}>
                in {Math.ceil((new Date(r.release_date) - new Date()) / 86400000)} days
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={s.rule} />
        <div style={s.footer}>
          Generated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · Uncut Records Release Management Platform
        </div>

      </div>

      {/* Print styles injected into head */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 20mm; size: A4; }
        }
      `}</style>
    </div>
  )
}

const s = {
  loading:   { padding: '48px 24px', color: '#888', fontSize: '13px', fontFamily: 'IBM Plex Mono, monospace' },
  toolbar:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', borderBottom: '1px solid #d4cec5', background: '#ede9e3', position: 'sticky', top: 0, zIndex: 10 },
  toolbarLabel: { fontSize: '11px', letterSpacing: '0.1em', color: '#888', fontFamily: 'IBM Plex Mono, monospace' },
  printBtn:  { background: '#a0723a', color: '#fff', border: 'none', padding: '8px 18px', fontSize: '12px', letterSpacing: '0.06em', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace' },

  report:    { maxWidth: '860px', margin: '0 auto', padding: '48px 40px', fontFamily: 'IBM Plex Mono, monospace', color: '#2a2520', background: '#fff', minHeight: '100vh' },

  reportHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' },
  reportWordmark: { fontSize: '18px', fontWeight: 600, letterSpacing: '0.12em', color: '#a0723a', marginBottom: '4px' },
  reportSub:  { fontSize: '11px', color: '#888', letterSpacing: '0.08em' },
  reportDate: { fontSize: '11px', color: '#888', letterSpacing: '0.06em', textAlign: 'right', paddingTop: '4px' },

  rule:      { height: '1px', background: '#d4cec5', margin: '24px 0' },
  section:   { marginBottom: '8px' },
  sectionTitle: { fontSize: '10px', letterSpacing: '0.14em', fontWeight: 600, textTransform: 'uppercase', color: '#888', marginBottom: '16px' },
  empty:     { fontSize: '12px', color: '#aaa', margin: 0 },

  snapshotGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: '#d4cec5', border: '1px solid #d4cec5', marginBottom: '12px' },
  snapshotCell: { background: '#faf8f5', padding: '14px 12px' },
  snapshotCellHighlight: { background: '#fdf8f2' },
  snapshotStage: { fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', marginBottom: '6px', fontWeight: 600 },
  snapshotCount: { fontSize: '28px', fontWeight: 600, color: '#2a2520', lineHeight: 1, marginBottom: '8px' },
  snapshotTracks: { display: 'flex', flexDirection: 'column', gap: '3px' },
  snapshotTrack: { fontSize: '10px', color: '#666', lineHeight: 1.3 },
  snapshotTotal: { fontSize: '11px', color: '#888' },

  teaseBlock: { marginBottom: '20px', paddingLeft: '12px', borderLeft: '2px solid #c49a62' },
  teaseTrack: { fontSize: '14px', fontWeight: 600, color: '#2a2520', marginBottom: '4px' },
  teaseMeta:  { fontSize: '11px', color: '#888', marginBottom: '12px' },
  logList:    { display: 'flex', flexDirection: 'column', gap: '8px' },
  logListTitle: { fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: '6px' },
  logItem:    { display: 'flex', gap: '12px', alignItems: 'flex-start' },
  logDate:    { fontSize: '11px', color: '#aaa', flexShrink: 0, minWidth: '48px' },
  logText:    { fontSize: '12px', color: '#555', lineHeight: 1.5 },

  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', fontWeight: 600, textAlign: 'left', padding: '8px 10px', background: '#f5f2ee', borderBottom: '1px solid #d4cec5', borderTop: '1px solid #d4cec5' },
  tr:        { borderBottom: '1px solid #ede9e3' },
  td:        { fontSize: '12px', color: '#2a2520', padding: '9px 10px' },

  decisionRow:   { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid #f0ece6' },
  decisionBadge: { fontSize: '10px', padding: '2px 8px', letterSpacing: '0.04em', flexShrink: 0 },
  decisionTrack: { fontSize: '12px', color: '#2a2520', flex: 1 },
  decisionDate:  { fontSize: '11px', color: '#aaa', flexShrink: 0 },

  upcomingRow:   { display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 0', borderBottom: '1px solid #f0ece6' },
  upcomingTrack: { fontSize: '12px', color: '#2a2520', flex: 1, fontWeight: 500 },
  upcomingDate:  { fontSize: '11px', color: '#555' },
  upcomingDays:  { fontSize: '11px', color: '#a0723a', flexShrink: 0 },

  footer:    { fontSize: '10px', color: '#bbb', letterSpacing: '0.06em', textAlign: 'center', paddingTop: '8px' },
}
