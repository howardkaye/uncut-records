import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TILES = [
  { label: 'Track Pool', to: '/tracks',   query: () => supabase.from('tracks').select('id', { count: 'exact', head: true }).eq('cleared', false) },
  { label: 'Pipeline',   to: '/pipeline', query: () => supabase.from('releases').select('id', { count: 'exact', head: true }).neq('archived', true) },
  { label: 'Releases',   to: '/releases', query: () => supabase.from('releases').select('id', { count: 'exact', head: true }).in('stage', ['released', 'reporting']) },
  { label: 'Reports',    to: '/reports',  query: null },
  { label: 'Calendar',   to: '/calendar', query: null },
  { label: 'Vault',      to: '/vault',    query: () => supabase.from('releases').select('id', { count: 'exact', head: true }).eq('archived', true) },
]

const TICKER_STATS = [
  { label: 'RELEASES THIS QUARTER', query: () => supabase.from('releases').select('id', { count: 'exact', head: true }).in('stage', ['released', 'reporting']).gte('created_at', new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1).toISOString()) },
  { label: 'TRACKS IN PIPELINE',    query: () => supabase.from('releases').select('id', { count: 'exact', head: true }).neq('archived', true) },
  { label: 'NEW IN POOL',           query: () => supabase.from('tracks').select('id', { count: 'exact', head: true }).eq('cleared', false) },
]

export default function Home() {
  const navigate = useNavigate()
  const [counts, setCounts] = useState({})
  const [ticker, setTicker] = useState({})

  useEffect(() => {
    TILES.forEach((tile, i) => {
      if (!tile.query) return
      tile.query().then(({ count }) => {
        setCounts(prev => ({ ...prev, [i]: count ?? 0 }))
      })
    })
    TICKER_STATS.forEach((stat, i) => {
      stat.query().then(({ count }) => {
        setTicker(prev => ({ ...prev, [i]: count ?? 0 }))
      })
    })
  }, [])

  return (
    <div style={s.page}>
      {/* Hero wordmark */}
      <div style={s.hero}>
        <div style={s.wordmark}>UNCUT</div>
        <div style={s.wordmarkSub}>Records</div>
      </div>

      {/* Tiles grid */}
      <div style={s.grid}>
        {TILES.map((tile, i) => (
          <button key={tile.to} style={s.tile} onClick={() => navigate(tile.to)}>
            <span style={s.tileLabel}>{tile.label}</span>
            {counts[i] !== undefined && (
              <span style={s.tileCount}>{counts[i]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Stats ticker */}
      <div style={s.ticker}>
        {TICKER_STATS.map((stat, i) => (
          <span key={i} style={s.tickerItem}>
            {ticker[i] ?? '—'} {stat.label}
            {i < TICKER_STATS.length - 1 && <span style={s.tickerDot}> · </span>}
          </span>
        ))}
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: 'calc(100vh - 60px)',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 40px 40px',
  },
  hero: {
    textAlign: 'center',
    marginBottom: '48px',
  },
  wordmark: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(80px, 18vw, 220px)',
    color: 'var(--green)',
    lineHeight: 0.9,
    letterSpacing: '-0.02em',
    textTransform: 'uppercase',
    fontWeight: 900,
  },
  wordmarkSub: {
    fontFamily: 'var(--font)',
    fontSize: 'clamp(18px, 3vw, 32px)',
    color: 'var(--green)',
    marginTop: '8px',
    letterSpacing: '0.04em',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    width: '100%',
    maxWidth: '900px',
    marginBottom: '40px',
  },
  tile: {
    background: 'var(--pink)',
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    padding: '28px 36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'transform 0.15s, filter 0.15s',
    ':hover': { filter: 'brightness(0.95)' },
  },
  tileLabel: {
    fontFamily: 'var(--font)',
    fontSize: 'clamp(16px, 2vw, 22px)',
    color: 'var(--green)',
    fontWeight: 400,
  },
  tileCount: {
    fontFamily: 'var(--font)',
    fontSize: 'clamp(14px, 1.5vw, 18px)',
    color: 'var(--green)',
    opacity: 0.6,
  },
  ticker: {
    fontSize: '11px',
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  tickerItem: {},
  tickerDot: { margin: '0 8px' },
}
