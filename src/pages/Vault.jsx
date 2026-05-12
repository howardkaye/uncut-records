import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function fmt(n) {
  if (!n) return '0'
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

export default function Vault() {
  const [releases, setReleases] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  useEffect(() => { fetchVault() }, [])

  async function fetchVault() {
    const { data: rels } = await supabase
      .from('releases')
      .select('*, track:tracks(*)')
      .eq('stage', 'archived')
      .order('release_date', { ascending: false })

    if (!rels) { setLoading(false); return }

    const enriched = await Promise.all(rels.map(async r => {
      const { data: perf } = await supabase
        .from('performance_data')
        .select('streams, tiktok_uses, tiktok_views')
        .eq('release_id', r.id)

      const p = perf ?? []
      return {
        ...r,
        _ttUses:  p.reduce((a, x) => a + (x.tiktok_uses  || 0), 0),
        _ttViews: p.reduce((a, x) => a + (x.tiktok_views || 0), 0),
        _streams: p.reduce((a, x) => a + (x.streams      || 0), 0),
      }
    }))

    setReleases(enriched)
    setLoading(false)
  }

  const visible = releases.filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (r.track?.title ?? '').toLowerCase().includes(q) ||
           (r.track?.artist ?? '').toLowerCase().includes(q)
  })

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <div style={s.pageTitle}>VAULT</div>
          <div style={s.pageSubtitle}>archived releases</div>
        </div>
        <input
          style={s.search}
          placeholder="search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={s.empty}>loading vault...</div>
      ) : visible.length === 0 ? (
        <div style={s.empty}>
          {search ? 'no results' : <>no archived releases — archive from the <Link to="/pipeline" style={{ color: 'var(--bronze)' }}>pipeline</Link></>}
        </div>
      ) : (
        <div style={s.table}>
          <div style={s.thead}>
            <div style={{ ...s.th, flex: '2 1 0' }}>Track</div>
            <div style={{ ...s.th, flex: '1 1 0' }}>Artist</div>
            <div style={{ ...s.th, ...s.thNum }}>Release</div>
            <div style={{ ...s.th, ...s.thNum }}>Sound Uses</div>
            <div style={{ ...s.th, ...s.thNum }}>Sound Views</div>
            <div style={{ ...s.th, ...s.thNum }}>Top Vid Views</div>
          </div>

          {visible.map(r => (
            <Link key={r.id} to={`/releases/${r.id}`} style={{ ...s.row, textDecoration: 'none' }}>
              <div style={{ ...s.td, flex: '2 1 0', color: 'var(--bronze)', fontWeight: 500 }}>
                {r.track?.title ?? '—'}
              </div>
              <div style={{ ...s.td, flex: '1 1 0' }}>
                {r.track?.artist ?? '—'}
              </div>
              <div style={{ ...s.td, ...s.tdNum }}>
                {r.release_date
                  ? new Date(r.release_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'}
              </div>
              <div style={{ ...s.td, ...s.tdNum }}>{fmt(r._ttUses)}</div>
              <div style={{ ...s.td, ...s.tdNum }}>{fmt(r._ttViews)}</div>
              <div style={{ ...s.td, ...s.tdNum }}>{fmt(r._streams)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  page:        { display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 48px)' },
  header:      { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', gap: '16px', flexWrap: 'wrap' },
  pageTitle:   { fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 500 },
  pageSubtitle: { fontSize: '12px', color: 'var(--text)', marginTop: '3px' },
  search:      { background: 'var(--bg)', border: '1px solid var(--border)', padding: '7px 12px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none', width: '200px' },
  empty:       { padding: '48px 24px', color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.06em' },

  table:  { display: 'flex', flexDirection: 'column' },
  thead:  { display: 'flex', padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' },
  th:     { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 500 },
  thNum:  { flex: '1 1 0', textAlign: 'right' },

  row:    { display: 'flex', padding: '14px 24px', borderBottom: '1px solid var(--border)', alignItems: 'center', transition: 'background 0.1s', color: 'inherit' },
  td:     { fontSize: '13px', color: 'var(--text)' },
  tdNum:  { flex: '1 1 0', textAlign: 'right', fontSize: '13px', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' },
}
