import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TILES = [
  { label: 'Track Pool', to: '/tracks',   query: () => supabase.from('tracks').select('id', { count: 'exact', head: true }).eq('cleared', false) },
  { label: 'Pipeline',   to: '/pipeline', query: () => supabase.from('releases').select('id', { count: 'exact', head: true }).neq('archived', true) },
  { label: 'Releases',   to: '/releases', query: () => supabase.from('releases').select('id', { count: 'exact', head: true }).neq('archived', true) },
  { label: 'Reports',    to: '/reports',  query: null },
  { label: 'Guide',      to: '/guide',    query: null },
  { label: 'Vault',      to: '/vault',    query: () => supabase.from('releases').select('id', { count: 'exact', head: true }).eq('archived', true) },
]

export default function Home() {
  const navigate = useNavigate()
  const [counts, setCounts] = useState({})

  useEffect(() => {
    TILES.forEach((tile, i) => {
      if (!tile.query) return
      tile.query().then(({ count }) => {
        setCounts(prev => ({ ...prev, [i]: count ?? 0 }))
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
}
