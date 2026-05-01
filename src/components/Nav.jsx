import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const allLinks = [
  { to: '/pipeline',   label: 'pipeline',    roles: ['coordinator', 'selector'] },
  { to: '/tracks',     label: 'track pool',  roles: ['coordinator', 'selector'] },
  { to: '/releases',   label: 'releases',    roles: ['coordinator', 'content'] },
  { to: '/reports',    label: 'reports',     roles: ['coordinator'] },
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
      <div style={styles.wordmark}>UNCUT</div>

      <div style={styles.links}>
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            style={({ isActive }) => ({
              ...styles.link,
              color: isActive ? 'var(--bronze)' : 'var(--text-muted)',
            })}
          >
            {l.label}
          </NavLink>
        ))}
      </div>

      <div style={styles.user}>
        {profile && (
          <span style={styles.role}>{profile.role}</span>
        )}
        <button onClick={handleSignOut} style={styles.signOut}>sign out</button>
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    height: '48px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    gap: '32px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  wordmark: {
    fontSize: '13px',
    fontWeight: '600',
    letterSpacing: '0.14em',
    color: 'var(--bronze)',
    marginRight: '8px',
  },
  links: {
    display: 'flex',
    gap: '24px',
    flex: 1,
  },
  link: {
    fontSize: '12px',
    letterSpacing: '0.06em',
    transition: 'color 0.1s',
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  role: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    letterSpacing: '0.06em',
    background: 'var(--surface-2)',
    padding: '2px 8px',
    border: '1px solid var(--border)',
  },
  signOut: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    background: 'none',
    border: 'none',
    letterSpacing: '0.06em',
    padding: 0,
  },
}
