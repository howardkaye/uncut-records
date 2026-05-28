import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  const [forgotMode, setForgotMode]   = useState(false)
  const [resetEmail, setResetEmail]   = useState('')
  const [resetSent, setResetSent]     = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError]   = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleForgot(e) {
    e.preventDefault()
    setResetError(null)
    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: 'https://uncut-records.vercel.app/profile',
    })
    if (error) { setResetError(error.message); setResetLoading(false); return }
    setResetSent(true)
    setResetLoading(false)
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.wordmark}>UNCUT</div>
        <p style={styles.sub}>records · release management</p>

        {forgotMode ? (
          resetSent ? (
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.6, marginBottom: '20px' }}>
                Reset link sent to <strong>{resetEmail}</strong>. Check your inbox and click the link to set a new password.
              </p>
              <button style={styles.ghost} onClick={() => { setForgotMode(false); setResetSent(false) }}>
                ← back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot} style={styles.form}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '8px' }}>
                Enter your email and we'll send you a reset link.
              </p>
              <label style={styles.label}>email</label>
              <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                required autoFocus style={styles.input} placeholder="you@example.com" />
              {resetError && <p style={styles.error}>{resetError}</p>}
              <button type="submit" disabled={resetLoading} style={{ ...styles.button, marginTop: '20px' }}>
                {resetLoading ? 'sending...' : 'send reset link'}
              </button>
              <button type="button" style={{ ...styles.ghost, marginTop: '12px' }}
                onClick={() => setForgotMode(false)}>
                ← back to sign in
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoFocus style={styles.input} placeholder="you@uncutrecords.com" />

            <label style={styles.label}>password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              required style={styles.input} placeholder="••••••••" />

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? 'signing in...' : 'sign in'}
            </button>

            <button type="button" style={styles.ghost} onClick={() => setForgotMode(true)}>
              forgot password?
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
  },
  card: {
    background: 'var(--surface)',
    border: '1.5px solid var(--border)',
    borderRadius: '20px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '380px',
  },
  wordmark: {
    fontFamily: 'var(--font-display)',
    fontSize: '36px',
    fontWeight: 900,
    letterSpacing: '-0.01em',
    color: 'var(--green)',
    marginBottom: '4px',
    lineHeight: 1,
  },
  sub: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    letterSpacing: '0.06em',
    marginBottom: '36px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    letterSpacing: '0.06em',
    marginTop: '12px',
  },
  input: {
    background: 'var(--bg)',
    border: '1.5px solid var(--border)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: 'var(--text)',
    outline: 'none',
    width: '100%',
    fontFamily: 'var(--font)',
    fontSize: '12px',
  },
  error: {
    fontSize: '11px',
    color: '#b84040',
    marginTop: '8px',
  },
  button: {
    marginTop: '24px',
    background: 'var(--pink)',
    color: 'var(--green)',
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    padding: '12px',
    letterSpacing: '0.08em',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
    fontSize: '12px',
  },
  ghost: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '11px',
    letterSpacing: '0.06em',
    cursor: 'pointer',
    padding: '8px 0 0',
    textAlign: 'left',
    fontFamily: 'var(--font)',
  },
}
