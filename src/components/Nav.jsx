import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const allLinks = [
  { to: '/pipeline',   label: 'pipeline',    roles: ['coordinator', 'selector'] },
  { to: '/tracks',     label: 'track pool',  roles: ['coordinator', 'selector'] },
  { to: '/releases',   label: 'releases',    roles: ['coordinator', 'content'] },
  { to: '/reports',    label: 'reports',     roles: ['coordinator'] },
]

function ChangePasswordModal({ onClose }) {
  const [newPassword, setNewPassword]     = useState('')
  const [confirm, setConfirm]             = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)
  const [success, setSuccess]             = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirm) { setError('Passwords do not match.'); return }
    setSaving(true); setError(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setError(error.message); setSaving(false); return }
    setSuccess(true)
    setTimeout(onClose, 1500)
  }

  return (
    <div style={m.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={m.modal}>
        <div style={m.header}>
          <span style={m.title}>change password</span>
          <button style={m.close} onClick={onClose}>✕</button>
        </div>
        {success ? (
          <p style={{ fontSize: '12px', color: '#5a7a4a', padding: '8px 0' }}>Password updated successfully.</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={m.label}>new password</label>
              <input style={m.input} type="password" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} required autoFocus />
            </div>
            <div>
              <label style={m.label}>confirm password</label>
              <input style={m.input} type="password" value={confirm}
                onChange={e => setConfirm(e.target.value)} required />
            </div>
            {error && <p style={{ fontSize: '11px', color: '#b84040' }}>{error}</p>}
            <button type="submit" disabled={saving} style={m.submit}>
              {saving ? 'saving...' : 'update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function Nav() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [showChangePassword, setShowChangePassword] = useState(false)

  const links = allLinks.filter(l =>
    profile ? l.roles.includes(profile.role) : true
  )

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <>
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
          <button onClick={() => setShowChangePassword(true)} style={styles.signOut}>
            change password
          </button>
          <button onClick={handleSignOut} style={styles.signOut}>sign out</button>
        </div>
      </nav>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </>
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
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font)',
  },
}

const m = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(42,37,32,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:   { background: 'var(--surface)', border: '1px solid var(--border)', width: '100%', maxWidth: '360px', padding: '28px' },
  header:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' },
  title:   { fontSize: '12px', letterSpacing: '0.08em', fontWeight: 500 },
  close:   { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', padding: 0 },
  label:   { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' },
  input:   { background: 'var(--bg)', border: '1px solid var(--border)', padding: '8px 10px', color: 'var(--text)', outline: 'none', width: '100%', fontFamily: 'var(--font)', fontSize: '12px' },
  submit:  { background: 'var(--bronze)', color: '#fff', border: 'none', padding: '10px', fontSize: '12px', letterSpacing: '0.06em', cursor: 'pointer', fontFamily: 'var(--font)', width: '100%', marginTop: '4px' },
}
