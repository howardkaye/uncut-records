import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { profile, session, refreshProfile } = useAuth()

  const [name, setName]   = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [saveError, setSaveError] = useState(null)

  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploading, setUploading] = useState(false)

  const [pw, setPw]           = useState({ new: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError]   = useState(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  // Keep form in sync if profile loads after mount
  useEffect(() => {
    if (profile?.full_name) setName(profile.full_name)
    if (profile?.phone)     setPhone(profile.phone)
  }, [profile?.full_name, profile?.phone])

  // Load avatar
  useEffect(() => {
    if (!profile?.id) return
    supabase.from('users').select('avatar_url').eq('id', profile.id).single().then(({ data }) => {
      if (data?.avatar_url) {
        supabase.storage.from('tracks').createSignedUrl(data.avatar_url, 3600).then(({ data: d }) => {
          if (d?.signedUrl) setAvatarUrl(d.signedUrl)
        })
      }
    })
  }, [profile?.id])

  async function handleAvatarUpload(e) {
    const file = e.target.files[0]
    if (!file || !profile?.id) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `avatars/${profile.id}.${ext}`
    const { error } = await supabase.storage.from('tracks').upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      await supabase.from('users').update({ avatar_url: path }).eq('id', profile.id)
      const { data: signed } = await supabase.storage.from('tracks').createSignedUrl(path, 3600)
      if (signed?.signedUrl) setAvatarUrl(signed.signedUrl)
    }
    setUploading(false)
  }

  async function saveProfile(e) {
    e.preventDefault()
    setSaving(true); setSaved(false); setSaveError(null)
    const { error } = await supabase
      .from('users')
      .update({ full_name: name.trim(), phone: phone.trim() })
      .eq('id', profile.id)
    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      await refreshProfile()
    }
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

  const initials = (profile?.full_name ?? name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.pageTitle}>PROFILE</span>
      </div>

      <div style={s.body}>
        <div style={s.card}>

          {/* ── Avatar ── */}
          <div style={s.cardTitle}>Profile photo</div>
          <div style={s.avatarSection}>
            <div style={s.avatarWrap}>
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" style={s.avatarImg} />
                : <div style={s.avatarInitials}>{initials}</div>
              }
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={s.avatarUploadBtn}>
                <input type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                {uploading ? 'uploading…' : 'upload photo'}
              </label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>JPG or PNG, shown in chat</span>
            </div>
          </div>

          <div style={s.divider} />

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
            {saveError && <p style={s.error}>{saveError}</p>}
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
  page:           { display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 48px)' },
  header:         { padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' },
  pageTitle:      { fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 500 },
  body:           { flex: 1, padding: '32px 24px', display: 'flex', justifyContent: 'center' },
  card:           { background: 'var(--surface)', border: '1px solid var(--border)', padding: '32px', width: '100%', maxWidth: '440px' },
  cardTitle:      { fontSize: '11px', letterSpacing: '0.1em', fontWeight: 500, textTransform: 'uppercase', color: 'var(--text)', marginBottom: '16px' },
  avatarSection:  { display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '8px' },
  avatarWrap:     { width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0, background: 'var(--bronze)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatarImg:      { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  avatarInitials: { fontSize: '22px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font)', letterSpacing: '0.02em' },
  avatarUploadBtn:{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '6px 14px', fontSize: '12px', color: 'var(--text)', cursor: 'pointer', display: 'inline-block', fontFamily: 'var(--font)', letterSpacing: '0.04em' },
  form:           { display: 'flex', flexDirection: 'column', gap: '14px' },
  label:          { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' },
  input:          { background: 'var(--bg)', border: '1px solid var(--border)', padding: '9px 12px', color: 'var(--text)', outline: 'none', width: '100%', fontFamily: 'var(--font)', fontSize: '12px' },
  btn:            { background: 'var(--bronze)', color: '#fff', border: 'none', padding: '10px 20px', fontSize: '12px', letterSpacing: '0.06em', cursor: 'pointer', fontFamily: 'var(--font)', alignSelf: 'flex-start' },
  row:            { display: 'flex', alignItems: 'center', gap: '14px' },
  savedMsg:       { fontSize: '12px', color: '#5a7a4a' },
  error:          { fontSize: '11px', color: '#b84040', margin: 0 },
  success:        { fontSize: '11px', color: '#5a7a4a', margin: 0 },
  divider:        { height: '1px', background: 'var(--border)', margin: '28px 0' },
  metaRow:        { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  roleChip:       { fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '2px 8px', border: '1px solid var(--border)', letterSpacing: '0.06em' },
}
