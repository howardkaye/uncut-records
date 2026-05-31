import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import TeaseReportForm from '../components/TeaseReportForm'

export default function ContentHome() {
  const [releases, setReleases] = useState([])
  const [active,   setActive]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [done,     setDone]     = useState(false)

  useEffect(() => {
    supabase
      .from('releases')
      .select('*, track:tracks(*)')
      .eq('stage', 'tease_window')
      .neq('archived', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = data ?? []
        setReleases(list)
        if (list.length > 0) setActive(list[0])
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div style={s.page}>
      <div style={s.wordmark}>UNCUT</div>
      <div style={s.loading}>loading…</div>
    </div>
  )

  if (!active) return (
    <div style={s.page}>
      <div style={s.wordmark}>UNCUT</div>
      <div style={s.empty}>No active tease window release right now. Check back soon.</div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.hero}>
        <div style={s.wordmark}>UNCUT</div>
        <div style={s.heroSub}>Tease Window Report</div>
      </div>

      {/* Release picker — only shown if multiple active releases */}
      {releases.length > 1 && (
        <div style={s.pickerWrap}>
          <label style={s.label}>active release</label>
          <select style={s.select}
            value={active.id}
            onChange={e => { setActive(releases.find(r => r.id === e.target.value)); setDone(false) }}>
            {releases.map(r => (
              <option key={r.id} value={r.id}>{r.track?.title ?? r.id}</option>
            ))}
          </select>
        </div>
      )}

      <div style={s.formWrap}>
        {done ? (
          <div style={s.successBox}>
            <div style={s.successIcon}>✓</div>
            <div style={s.successTitle}>Report submitted</div>
            <div style={s.successSub}>Your tease window report has been logged.</div>
            <button style={s.anotherBtn} onClick={() => setDone(false)}>Submit another period</button>
          </div>
        ) : (
          <TeaseReportForm release={active} onSubmitted={() => setDone(true)} />
        )}
      </div>
    </div>
  )
}

const s = {
  page:      { minHeight: 'calc(100vh - 60px)', background: '#fff', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  hero:      { textAlign: 'center', marginBottom: '40px' },
  wordmark:  { fontFamily: 'var(--font-display)', fontSize: 'clamp(64px, 14vw, 160px)', color: 'var(--green)', lineHeight: 0.9, letterSpacing: '-0.02em', fontWeight: 900, textTransform: 'uppercase' },
  heroSub:   { fontFamily: 'var(--font)', fontSize: '13px', color: 'var(--text-muted)', marginTop: '10px', letterSpacing: '0.06em' },
  loading:   { fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.06em', marginTop: '40px' },
  empty:     { fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '360px', marginTop: '40px', lineHeight: 1.6 },

  pickerWrap: { width: '100%', maxWidth: '640px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '4px' },
  label:      { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em' },
  select:     { background: '#fff', border: '1.5px solid var(--border)', padding: '8px 12px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none' },

  formWrap: { width: '100%', maxWidth: '640px' },

  successBox:   { textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  successIcon:  { width: '48px', height: '48px', borderRadius: '50%', background: 'var(--pink)', color: 'var(--green)', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, marginBottom: '8px' },
  successTitle: { fontSize: '14px', fontWeight: 600, color: 'var(--green)' },
  successSub:   { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' },
  anotherBtn:   { background: 'none', border: '1.5px solid var(--border)', color: 'var(--text-muted)', fontSize: '11px', padding: '8px 18px', cursor: 'pointer', fontFamily: 'var(--font)', borderRadius: 'var(--radius-pill)', letterSpacing: '0.04em' },
}
