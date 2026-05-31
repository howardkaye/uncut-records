import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const PAGE_LABELS = {
  '/tracks':   'Track Pool',
  '/pipeline': 'Pipeline',
  '/releases': 'Releases',
  '/reports':  'Reports',
  '/vault':    'Vault',
  '/guide':    'Guide',
  '/profile':  'Profile',
}

export default function Nav() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isHome = location.pathname === '/'
  const pageLabel = Object.entries(PAGE_LABELS).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] ?? ''

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <nav style={styles.nav}>
      {/* Left: wordmark + current page name */}
      <div style={styles.left}>
        <NavLink to="/" style={{ textDecoration: 'none' }}>
          <div style={styles.wordmark}>UNCUT</div>
        </NavLink>
        {pageLabel && <span style={styles.pageLabel}>{pageLabel.toUpperCase()}</span>}
      </div>

      {/* Right: Home button + sign out */}
      <div style={styles.right}>
        {!isHome && (
          <NavLink to="/" style={{ textDecoration: 'none' }}>
            <div style={styles.homeBtn}>← Home</div>
          </NavLink>
        )}
        <button onClick={handleSignOut} style={styles.signOut}>Sign out</button>
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    height: '60px',
    background: '#fff',
    borderBottom: '1.5px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  wordmark: {
    fontFamily: 'var(--font-display)',
    fontSize: '22px',
    fontWeight: 900,
    color: 'var(--green)',
    letterSpacing: '0.02em',
    lineHeight: 1,
    fontVariationSettings: '"YEAR" 2050',
  },
  pageLabel: {
    fontFamily: 'var(--font)',
    fontSize: '12px',
    color: 'var(--text-muted)',
    letterSpacing: '0.08em',
    fontWeight: 400,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  homeBtn: {
    fontFamily: 'var(--font)',
    fontSize: '13px',
    color: 'var(--green)',
    border: '1.5px solid var(--green)',
    borderRadius: 'var(--radius-pill)',
    padding: '6px 20px',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    transition: 'all 0.15s',
  },
  signOut: {
    fontFamily: 'var(--font)',
    fontSize: '12px',
    color: 'var(--text-muted)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
}
