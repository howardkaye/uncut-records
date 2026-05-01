import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { profile, session } = useAuth()

  const [name, setName]   = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const [pw, setPw]           = useState({ new: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError]   = useState(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  async function saveProfile(e) {
    e.preventDefault()
    setSaving(true); setSaved(false)
    const { error } = await supabase
      .from('users')
      .update({ full_name: name.trim(), phone: phone.trim() })
      .eq('id', profile.id)
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  async function changePassword(e) {
    e.preventDefault()
    setPwError(null); setPwSuccess(false)
    if (pw.new.length < 6) { setPwError('Password must be at least 6 characters.'); return }
    if (pw.new !== pw.confirm) { setPwError('Passwords do not match.'); return }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw.new })
    if (error) { setPwError(error.message); setPwSaving(false); return }
    setPwSuccess(true)
    setPw({ new: '', confirm: '' })
    setPwSaving(false)
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.pageTitle}>PROFILE</span>
      </div>

      <div style={s.body}>
        <div style={s.card}>

          {/* ── Details ── */}
          <div style={s.cardTitle}>Your details</div>
          <form onSubmit={saveProfile} style={s.form}>
            <div>
              <label style={s.label}>name</label>
              <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
            </div>
            <div>
              <label style={s.label}>email</label>
              <input style={{ ...s.input, color: 'var(--text-muted)', background: 'var(--surface-2)' }}
                value={session?.user?.email ?? ''} readOnly />
            </div>
            <div>
              <label style={s.label}>phone <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
              <input style={s.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 7700 000000" />
            </div>
            <div style={s.row}>
              <button type="submit" disabled={saving} style={s.btn}>
                {saving ? 'saving...' : 'save details'}
              </button>
              {saved && <span style={s.savedMsg}>✓ saved</span>}
            </div>
          </form>

          <div style={s.divider} />

          {/* ── Password ── */}
          <div style={s.cardTitle}>Change password</div>
          <form onSubmit={changePassword} style={s.form}>
            <div>
              <label style={s.label}>new password</label>
              <input style={s.input} type="password" value={pw.new}
                onChange={e => setPw(p => ({ ...p, new: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>confirm password</label>
              <input style={s.input} type="password" value={pw.confirm}
                onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
            </div>
            {pwError && <p style={s.error}>{pwError}</p>}
            {pwSuccess && <p style={s.success}>✓ Password updated successfully.</p>}
            <button type="submit" disabled={pwSaving} style={s.btn}>
              {pwSaving ? 'updating...' : 'update password'}
            </button>
          </form>

          <div style={s.divider} />

          {/* ── Role ── */}
          <div style={s.metaRow}>
            <span style={s.label}>role</span>
            <span style={s.roleChip}>{profile?.role ?? '—'}</span>
          </div>

        </div>
      </div>
    </div>
  )
}

const s = {
  page:      { display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 48px)' },
  header:    { padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' },
  pageTitle: { fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 500 },
  body:      { flex: 1, padding: '32px 24px', display: 'flex', justifyContent: 'center' },
  card:      { background: 'var(--surface)', border: '1px solid var(--border)', padding: '32px', width: '100%', maxWidth: '440px' },
  cardTitle: { fontSize: '11px', letterSpacing: '0.1em', fontWeight: 500, textTransform: 'uppercase', color: 'var(--text)', marginBottom: '16px' },
  form:      { display: 'flex', flexDirection: 'column', gap: '14px' },
  label:     { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' },
  input:     { background: 'var(--bg)', border: '1px solid var(--border)', padding: '9px 12px', color: 'var(--text)', outline: 'none', width: '100%', fontFamily: 'var(--font)', fontSize: '12px' },
  btn:       { background: 'var(--bronze)', color: '#fff', border: 'none', padding: '10px 20px', fontSize: '12px', letterSpacing: '0.06em', cursor: 'pointer', fontFamily: 'var(--font)', alignSelf: 'flex-start' },
  row:       { display: 'flex', alignItems: 'center', gap: '14px' },
  savedMsg:  { fontSize: '12px', color: '#5a7a4a' },
  error:     { fontSize: '11px', color: '#b84040', margin: 0 },
  success:   { fontSize: '11px', color: '#5a7a4a', margin: 0 },
  divider:   { height: '1px', background: 'var(--border)', margin: '28px 0' },
  metaRow:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  roleChip:  { fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '2px 8px', border: '1px solid var(--border)', letterSpacing: '0.06em' },
}
