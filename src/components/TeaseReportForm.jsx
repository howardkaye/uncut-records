import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function lastMonday() {
  const d = new Date()
  const diff = d.getDay() === 0 ? 6 : d.getDay() - 1
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

function newVideo() { return { _id: crypto.randomUUID(), views: '', likes: '', content_theme: '', video_url: '', notes: '' } }
function newAccount() { return { _id: crypto.randomUUID(), account_name: '', videos: [newVideo()] } }

export default function TeaseReportForm({ release, onSubmitted }) {
  const { profile } = useAuth()
  const [periodStart, setPeriodStart] = useState(lastMonday)
  const [periodEnd,   setPeriodEnd]   = useState(() => new Date().toISOString().slice(0, 10))
  const [accounts, setAccounts]       = useState([newAccount()])
  const [saving,  setSaving]          = useState(false)
  const [error,   setError]           = useState(null)

  // ── account helpers ──────────────────────────────────────────
  const addAccount    = () => setAccounts(a => [...a, newAccount()])
  const removeAccount = id => setAccounts(a => a.filter(x => x._id !== id))
  const setAccName    = (id, v) => setAccounts(a => a.map(x => x._id === id ? { ...x, account_name: v } : x))

  // ── video helpers ────────────────────────────────────────────
  const addVideo    = accId => setAccounts(a => a.map(x => x._id === accId ? { ...x, videos: [...x.videos, newVideo()] } : x))
  const removeVideo = (accId, vid) => setAccounts(a => a.map(x => x._id === accId ? { ...x, videos: x.videos.filter(v => v._id !== vid) } : x))
  const setVidField = (accId, vid, field, val) =>
    setAccounts(a => a.map(x => x._id === accId
      ? { ...x, videos: x.videos.map(v => v._id === vid ? { ...v, [field]: val } : v) }
      : x
    ))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const { data: report, error: rErr } = await supabase
        .from('tease_reports')
        .insert({ release_id: release.id, period_start: periodStart, period_end: periodEnd, submitted_by: profile?.id })
        .select().single()
      if (rErr) throw new Error(rErr.message)

      for (const acc of accounts) {
        if (!acc.account_name.trim()) continue
        const { data: accRow, error: aErr } = await supabase
          .from('tease_report_accounts')
          .insert({ report_id: report.report_id, account_name: acc.account_name.trim() })
          .select().single()
        if (aErr) throw new Error(aErr.message)

        const vids = acc.videos
          .filter(v => v.views !== '' || v.likes !== '' || v.content_theme.trim())
          .map(v => ({
            account_id: accRow.account_id,
            views: parseInt(v.views) || 0,
            likes: parseInt(v.likes) || 0,
            content_theme: v.content_theme.trim() || null,
            video_url: v.video_url.trim() || null,
            notes: v.notes.trim() || null,
          }))
        if (vids.length > 0) {
          const { error: vErr } = await supabase.from('tease_report_videos').insert(vids)
          if (vErr) throw new Error(vErr.message)
        }
      }
      onSubmitted?.()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const track = release.track ?? {}

  return (
    <form onSubmit={handleSubmit} style={s.form}>

      {/* Release label */}
      <div style={s.releaseTag}>
        <span style={s.releaseName}>{track.title ?? '—'}</span>
        {track.artist && track.artist !== 'TBC' && <span style={s.releaseArtist}> · {track.artist}</span>}
      </div>

      {/* Period */}
      <div style={s.periodRow}>
        <div style={s.field}>
          <label style={s.label}>period start</label>
          <input type="date" style={s.input} value={periodStart} onChange={e => setPeriodStart(e.target.value)} required />
        </div>
        <div style={s.field}>
          <label style={s.label}>period end</label>
          <input type="date" style={s.input} value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} required />
        </div>
      </div>

      <div style={s.divider} />

      {/* Accounts */}
      {accounts.map(acc => (
        <div key={acc._id} style={s.accBlock}>
          <div style={s.accHead}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>account</label>
              <input style={{ ...s.input, fontWeight: 500 }}
                placeholder="@account_name"
                value={acc.account_name}
                onChange={e => setAccName(acc._id, e.target.value)}
                required />
            </div>
            {accounts.length > 1 && (
              <button type="button" style={s.removeAccBtn} onClick={() => removeAccount(acc._id)}>remove</button>
            )}
          </div>

          {/* Video table header */}
          <div style={s.videoHead}>
            <span style={{ ...s.videoTh, width: 76 }}>views</span>
            <span style={{ ...s.videoTh, width: 70 }}>likes</span>
            <span style={{ ...s.videoTh, flex: 1.4 }}>content theme</span>
            <span style={{ ...s.videoTh, flex: 1.6 }}>video url</span>
            <span style={{ ...s.videoTh, flex: 1 }}>notes</span>
            <span style={{ width: 22 }} />
          </div>

          {/* Video rows */}
          {acc.videos.map(v => (
            <div key={v._id} style={s.videoRow}>
              <input style={{ ...s.input, width: 76 }} type="number" min="0" placeholder="0" value={v.views} onChange={e => setVidField(acc._id, v._id, 'views', e.target.value)} />
              <input style={{ ...s.input, width: 70 }} type="number" min="0" placeholder="0" value={v.likes} onChange={e => setVidField(acc._id, v._id, 'likes', e.target.value)} />
              <input style={{ ...s.input, flex: 1.4 }} placeholder="e.g. relationship angle" value={v.content_theme} onChange={e => setVidField(acc._id, v._id, 'content_theme', e.target.value)} />
              <input style={{ ...s.input, flex: 1.6 }} type="url" placeholder="https://tiktok.com/…" value={v.video_url} onChange={e => setVidField(acc._id, v._id, 'video_url', e.target.value)} />
              <input style={{ ...s.input, flex: 1 }} placeholder="optional" value={v.notes} onChange={e => setVidField(acc._id, v._id, 'notes', e.target.value)} />
              {acc.videos.length > 1 && (
                <button type="button" style={s.removeVidBtn} onClick={() => removeVideo(acc._id, v._id)}>×</button>
              )}
            </div>
          ))}

          <button type="button" style={s.addVidBtn} onClick={() => addVideo(acc._id)}>+ add video</button>
        </div>
      ))}

      <button type="button" style={s.addAccBtn} onClick={addAccount}>+ add account</button>

      <div style={s.divider} />

      {error && <p style={s.error}>{error}</p>}

      <button type="submit" disabled={saving} style={s.submitBtn}>
        {saving ? 'submitting…' : 'submit report'}
      </button>
    </form>
  )
}

const s = {
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },

  releaseTag:   { display: 'flex', alignItems: 'baseline', gap: '4px' },
  releaseName:  { fontSize: '14px', fontWeight: 500, color: 'var(--green)' },
  releaseArtist:{ fontSize: '12px', color: 'var(--text-muted)' },

  periodRow: { display: 'flex', gap: '16px' },
  field:     { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 },
  label:     { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em' },
  input:     { background: 'var(--bg)', border: '1.5px solid var(--border)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' },
  divider:   { height: '1px', background: 'var(--border)' },

  accBlock:     { border: '1.5px solid var(--border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  accHead:      { display: 'flex', gap: '12px', alignItems: 'flex-end' },
  removeAccBtn: { background: 'none', border: '1.5px solid var(--border)', color: 'var(--text-muted)', fontSize: '11px', padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0, letterSpacing: '0.04em', borderRadius: 'var(--radius-pill)' },

  videoHead: { display: 'flex', gap: '8px', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid var(--border)' },
  videoTh:   { fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font)', flexShrink: 0 },
  videoRow:  { display: 'flex', gap: '8px', alignItems: 'center' },
  removeVidBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '16px', cursor: 'pointer', padding: '0', lineHeight: 1, width: 22, flexShrink: 0 },

  addVidBtn: { alignSelf: 'flex-start', background: 'none', border: '1.5px dashed var(--border)', color: 'var(--text-muted)', fontSize: '11px', padding: '5px 14px', cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '0.04em', borderRadius: 'var(--radius-pill)' },
  addAccBtn: { alignSelf: 'flex-start', background: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--green)', fontSize: '12px', padding: '9px 20px', cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '0.04em', borderRadius: 'var(--radius-pill)' },
  submitBtn: { alignSelf: 'flex-start', background: 'var(--pink)', color: 'var(--green)', border: 'none', padding: '12px 28px', fontSize: '12px', letterSpacing: '0.06em', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 500, borderRadius: 'var(--radius-pill)' },
  error:     { fontSize: '11px', color: '#b84040', margin: 0 },
}
