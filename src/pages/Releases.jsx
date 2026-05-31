import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STAGES = [
  { key: 'intake',       label: 'Intake' },
  { key: 'pre_release',  label: 'Pre-release' },
  { key: 'tease_window', label: 'Tease Window' },
  { key: 'reporting',    label: 'Reporting' },
]

const stageStyle = {
  intake:       { color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--surface-2)' },
  pre_release:  { color: '#5a7a4a', borderColor: '#a8c898', background: '#f0f5ec' },
  tease_window: { color: 'var(--bronze)', borderColor: 'var(--bronze-dim)', background: '#f5ede0' },
  reporting:    { color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--surface-2)' },
}

function daysLabel(dateStr) {
  if (!dateStr) return null
  const diff = Math.round((new Date(dateStr) - new Date()) / 86400000)
  if (diff === 0) return 'today'
  if (diff > 0) return `in ${diff}d`
  return `${Math.abs(diff)}d ago`
}

export default function Releases() {
  const [releases, setReleases] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('releases')
        .select('*, track:tracks(*)')
        .order('created_at', { ascending: false })
      if (data) setReleases(data)
      setLoading(false)
    }
    fetch()
  }, [])

  const visible = filter === 'all' ? releases : releases.filter(r => r.stage === filter)

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <div style={s.pageSuper}>{releases.length} TOTAL</div>
          <div style={s.pageTitle}>RELEASES</div>
        </div>
        <div style={s.filters}>
          <button style={{ ...s.filterBtn, ...(filter === 'all' ? s.filterActive : {}) }} onClick={() => setFilter('all')}>
            all
          </button>
          {STAGES.map(st => (
            <button
              key={st.key}
              style={{ ...s.filterBtn, ...(filter === st.key ? s.filterActive : {}) }}
              onClick={() => setFilter(st.key)}
            >
              {st.label.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.empty}>loading...</div>
        ) : visible.length === 0 ? (
          <div style={s.empty}>no releases</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>title</th>
                <th style={s.th}>artist</th>
                <th style={s.th}>stage</th>
                <th style={s.th}>release date</th>
                <th style={s.th}>cleared</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => {
                const ss = stageStyle[r.stage] ?? stageStyle.intake
                return (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)' }}>
                    <td style={s.td}>
                      <Link to={`/releases/${r.id}`} style={s.titleLink}>
                        {r.track?.title ?? '—'}
                      </Link>
                    </td>
                    <td style={s.td}>{r.track?.artist ?? '—'}</td>
                    <td style={s.td}>
                      <span style={{ ...s.chip, ...ss }}>
                        {STAGES.find(st => st.key === r.stage)?.label ?? r.stage}
                      </span>
                    </td>
                    <td style={{ ...s.td, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {r.release_date
                        ? `${new Date(r.release_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })} · ${daysLabel(r.release_date)}`
                        : '—'}
                    </td>
                    <td style={s.td}>
                      {r.track?.cleared
                        ? <span style={{ ...s.chip, color: 'var(--green)', borderColor: 'var(--pink)', background: 'var(--pink)' }}>cleared</span>
                        : <span style={{ ...s.chip, color: 'var(--text-muted)' }}>uncleared</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={s.footer}>{releases.length} releases total</div>
    </div>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' },
  header: {
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '12px',
  },
  pageSuper: { fontFamily: 'var(--font)', fontSize: '11px', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' },
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 900, color: 'var(--green)', letterSpacing: '-0.01em', lineHeight: 0.9 },
  filters: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  filterBtn: {
    background: '#fff', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)',
    padding: '6px 14px', fontSize: '11px', letterSpacing: '0.05em', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font)',
  },
  filterActive: { background: 'var(--pink)', borderColor: 'var(--pink)', color: 'var(--green)', fontWeight: 600 },
  tableWrap: { flex: 1, overflowY: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 500,
    textAlign: 'left', padding: '10px 16px', background: 'var(--surface)',
    borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, textTransform: 'uppercase',
  },
  td: { fontSize: '12px', padding: '10px 16px', borderBottom: '1px solid var(--border)', color: 'var(--text)', verticalAlign: 'middle' },
  titleLink: { color: 'var(--green)', textDecoration: 'none', fontWeight: 500 },
  chip: {
    fontSize: '10px', letterSpacing: '0.04em', padding: '2px 10px',
    border: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: 'var(--radius-pill)',
  },
  empty: { padding: '48px 24px', color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.06em' },
  footer: {
    padding: '10px 24px', fontSize: '11px', color: 'var(--text-muted)',
    borderTop: '1px solid var(--border)', background: 'var(--surface)', letterSpacing: '0.04em',
  },
}
