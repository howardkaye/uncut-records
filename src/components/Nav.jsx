import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const allLinks = [
  { to: '/tracks',     label: 'Track Pool',  roles: ['coordinator', 'selector'] },
  { to: '/pipeline',   label: 'Pipeline',    roles: ['coordinator', 'selector'] },
  { to: '/releases',   label: 'Releases',    roles: ['coordinator', 'content'] },
  { to: '/reports',    label: 'Reports',     roles: ['coordinator'] },
  { to: '/vault',      label: 'Vault',       roles: ['coordinator'] },
  { to: '/guide',      label: 'Guide',       roles: ['coordinator', 'selector', 'content'] },
]

export default function Nav() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const links = allLinks.filter(l =>
    profile ? l.roles.includes(profile.role) : true
  )

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <nav style={styles.nav}>
      <NavLink to="/" style={{ textDecoration: 'none' }}>
        <div style={styles.wordmark}>UNCUT</div>
      </NavLink>

      <div style={styles.links}>
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            style={({ isActive }) => ({
              ...styles.link,
              color: isActive ? 'var(--green)' : 'var(--text-muted)',
              fontWeight: isActive ? 600 : 400,
            })}
          >
            {l.label}
          </NavLink>
        ))}
      </div>

      <div style={styles.user}>
        <NavLink to="/profile" style={({ isActive }) => ({
          ...styles.profileBtn,
          background: isActive ? 'var(--green)' : 'transparent',
          color: isActive ? '#fff' : 'var(--green)',
        })}>
          Profile
        </NavLink>
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
    padding: '0 32px',
    gap: '32px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  wordmark: {
    fontFamily: 'var(--font-display)',
    fontSize: '22px',
    fontWeight: 900,
    color: 'var(--green)',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    lineHeight: 1,
  },
  links: { display: 'flex', gap: '24px', flex: 1 },
  link:  { fontFamily: 'var(--font)', fontSize: '13px', transition: 'color 0.1s' },
  user:  { display: 'flex', alignItems: 'center', gap: '12px' },
  profileBtn: {
    fontFamily: 'var(--font)',
    fontSize: '12px',
    padding: '5px 18px',
    borderRadius: 'var(--radius-pill)',
    border: '1.5px solid var(--green)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textDecoration: 'none',
    display: 'inline-block',
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
