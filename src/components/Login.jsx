import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.wordmark}>UNCUT RECORDS</div>
        <p style={styles.sub}>release management</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            style={styles.input}
            placeholder="you@uncutrecords.com"
          />

          <label style={styles.label}>password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={styles.input}
            placeholder="••••••••"
          />

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'signing in...' : 'sign in'}
          </button>
        </form>
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
    border: '1px solid var(--border)',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '380px',
  },
  wordmark: {
    fontSize: '15px',
    fontWeight: '600',
    letterSpacing: '0.12em',
    color: 'var(--bronze)',
    marginBottom: '4px',
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
    border: '1px solid var(--border)',
    padding: '10px 12px',
    color: 'var(--text)',
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.15s',
  },
  error: {
    fontSize: '11px',
    color: '#b84040',
    marginTop: '8px',
  },
  button: {
    marginTop: '24px',
    background: 'var(--bronze)',
    color: '#fff',
    border: 'none',
    padding: '12px',
    letterSpacing: '0.08em',
    fontWeight: '500',
    transition: 'background 0.15s',
  },
}
