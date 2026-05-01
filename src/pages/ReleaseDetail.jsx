import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const STAGES = [
  { key: 'intake',       label: 'Intake' },
  { key: 'pre_release',  label: 'Pre-release' },
  { key: 'tease_window', label: 'Tease Window' },
  { key: 'released',     label: 'Released' },
  { key: 'reporting',    label: 'Reporting' },
]

// § prefix = section header (non-checkable divider)
const DISTRIBUTION_ITEMS = [
  '§ TRACK & METADATA',
  'Final master audio file delivered (WAV, 44.1kHz / 16-bit minimum)',
  'Master quality-checked: no clipping, no artefacts, correct fade',
  'Track title confirmed and spelled correctly',
  'Artist name confirmed (or chosen from stockpile if no act name exists)',
  'Primary artist vs featured artist distinction confirmed',
  'Writer(s) confirmed and full legal names recorded',
  'Producer(s) confirmed and full legal names recorded',
  'Songwriter splits confirmed and agreed',
  'ISRC code assigned or requested from Co-Brand',
  'Genre and sub-genre confirmed (as per DSP taxonomy)',
  'BPM recorded',
  'Key recorded',
  'Language of lyrics confirmed',
  'Explicit or clean? Advisory tag confirmed',
  'Parental advisory version needed? If so, clean edit delivered',
  '§ RIGHTS & LEGAL',
  'Writer agreement signed and filed in Egnyte',
  'Master ownership confirmed (Uncut Records)',
  'Publishing ownership confirmed (writer retains)',
  'No sample clearance issues confirmed by writer/producer',
  'If samples present: clearance documentation obtained and filed',
  'Copyright year confirmed',
  'Label name for DSP credit confirmed (Uncut Records)',
  '§ ARTWORK',
  'Cover artwork delivered as 3000×3000px JPEG or PNG (RGB)',
  'Artwork contains no third-party logos or copyrighted imagery',
  'Artwork contains no URLs, social handles, or pricing',
  'Track title and artist name on artwork match metadata exactly',
  'Artwork approved internally before submission',
  '§ DSP SUBMISSION VIA CO-BRAND',
  'All files uploaded to Co-Brand within required lead time',
  'Release date set in Co-Brand dashboard',
  'Pre-save / pre-add link generated (if available via Co-Brand)',
  'DSP targets confirmed: Spotify, Apple Music, TikTok, YouTube Music, Amazon, Deezer',
  'Spotify for Artists profile claimed or confirmed for artist',
  'Apple Music for Artists profile confirmed',
  'Submission confirmed by Co-Brand (receipt or dashboard confirmation)',
  'DISCO entry updated: track moved from uncleared to cleared folder post-agreement',
]

const MARKETING_ITEMS = [
  '§ ARTIST IDENTITY',
  'Artist name confirmed (or chosen from stockpile)',
  'Artist social accounts required? TBC with Matt before first release',
  '§ ARTWORK',
  'Cover artwork finalised and approved',
  'Square and vertical (9:16) versions cut for TikTok and Instagram',
  'Track title and artist name on artwork match metadata exactly',
  '§ TEASE WINDOW CONTENT',
  'Monday confirmed as ground zero for this release',
  'LST briefed: song, start date, and target (50–100 videos on the sound)',
  'Interns and Flowstate briefed for volume content support',
  'Spearhead content created by LST: trend-aware posts designed to move',
  'Volume content live via interns and Flowstate (AI aesthetic clips, boiler room visuals, DJ footage)',
  'Each post has unique caption and minimum 10% visual variation (TikTok algorithm requirement)',
  'Content monitored daily: sound uses, UGC, comments asking for track ID',
  'LST identifies best performing post and flags when traction is building',
  '§ RELEASE DECISION',
  'Check: are people using the sound organically?',
  'Check: are comments asking "what is this track / what is this sound?"',
  'If YES to either: trigger release and activate scale spend',
  'If NO: do not release. Track returns to pool.',
  '§ SCALE SCENARIO (TRACK REACTING)',
  '£50 behind best performing TikTok post identified by LST',
  'TikTok boost activated via platform (if going through SoundOn) or paid boost',
  '£100 Instagram ad campaign launched on reactive content for one week',
  'Ads manager monitoring spend vs click-through rate vs stream growth',
  'If click-through strong and streams keeping pace: scale Instagram spend to up to £400/day',
  'Influencer budget activated: right connects sourced for this track',
  'PR outreach initiated: one-sheet or press release sent to contacts',
  'Spotify editorial pitch submitted (minimum 7 days pre-release via Spotify for Artists)',
  '§ RELEASE DAY',
  'Release live confirmation checked across Spotify, Apple Music, TikTok',
  'Release day post live on all active social channels',
  'Smart link / streaming link updated in bio and any pinned posts',
  'Any press or playlist placements shared across channels',
  '§ POST-RELEASE',
  'Ongoing content: minimum posting cadence maintained post-release',
  'Streams monitored weekly: Spotify for Artists, Apple Music for Artists',
  'TikTok sound usage monitored: organic UGC tracked',
  'Paid spend performance reviewed: spend vs stream growth ratio tracked',
  'Weekly report compiled and shared with owners',
]

function nextMonday() {
  const d = new Date()
  const day = d.getDay() // 0=Sun 1=Mon...
  const add = day === 1 ? 0 : day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + add)
  return d.toISOString().slice(0, 10)
}

function ChecklistSection({ releaseId, checklist, label, isCoordinator }) {
  const { profile } = useAuth()
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [newLabel, setNewLabel] = useState('')

  useEffect(() => { fetchItems() }, [releaseId, checklist])

  async function fetchItems() {
    const { data } = await supabase
      .from('checklist_items').select('*')
      .eq('release_id', releaseId).eq('checklist', checklist)
      .order('position')
    setItems(data ?? [])
    setLoading(false)
  }

  async function toggle(item) {
    if (item.label.startsWith('§')) return
    const now = new Date().toISOString()
    const update = item.completed
      ? { completed: false, completed_at: null, completed_by: null }
      : { completed: true, completed_at: now, completed_by: profile?.id ?? null }
    const { error } = await supabase.from('checklist_items').update(update).eq('id', item.id)
    if (!error) setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...update } : i))
  }

  async function addItem(e) {
    e.preventDefault()
    if (!newLabel.trim()) return
    const pos = items.length
    const { data, error } = await supabase
      .from('checklist_items')
      .insert({ release_id: releaseId, checklist, label: newLabel.trim(), position: pos })
      .select().single()
    if (!error) { setItems(prev => [...prev, data]); setNewLabel('') }
  }

  const checkable = items.filter(i => !i.label.startsWith('§'))
  const done  = checkable.filter(i => i.completed).length
  const total = checkable.length

  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        <span style={s.sectionTitle}>{label}</span>
        <span style={s.progress}>{done}/{total}</span>
      </div>

      {total > 0 && (
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${(done / total) * 100}%` }} />
        </div>
      )}

      {loading ? <div style={s.loadingItems}>loading...</div> : (
        <div style={s.checkList}>
          {items.map(item => {
            const isHeader = item.label.startsWith('§')
            if (isHeader) return (
              <div key={item.id} style={s.checkSection}>
                {item.label.replace('§ ', '')}
              </div>
            )
            return (
              <label key={item.id} style={s.checkRow}>
                <input type="checkbox" checked={item.completed}
                  onChange={() => toggle(item)} style={s.checkbox}
                  disabled={!isCoordinator} />
                <span style={{ ...s.checkLabel, ...(item.completed ? s.checkDone : {}) }}>
                  {item.label}
                </span>
              </label>
            )
          })}
        </div>
      )}

      {isCoordinator && (
        <form onSubmit={addItem} style={s.addRow}>
          <input style={s.addInput} placeholder="add custom item..." value={newLabel}
            onChange={e => setNewLabel(e.target.value)} />
          <button type="submit" style={s.addItemBtn} disabled={!newLabel.trim()}>+</button>
        </form>
      )}
    </div>
  )
}

function TeaseWindowLog({ releaseId, isCoordinator }) {
  const { profile } = useAuth()
  const [logs, setLogs]       = useState([])
  const [content, setContent] = useState('')
  const [logType, setLogType] = useState('general')
  const [saving, setSaving]   = useState(false)

  useEffect(() => { fetchLogs() }, [releaseId])

  async function fetchLogs() {
    const { data } = await supabase
      .from('tease_window_logs')
      .select('*, logger:logged_by(full_name, email)')
      .eq('release_id', releaseId)
      .order('logged_at', { ascending: false })
    setLogs(data ?? [])
  }

  async function addLog(e) {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('tease_window_logs')
      .insert({ release_id: releaseId, log_type: logType, content: content.trim(), logged_by: profile?.id })
      .select('*, logger:logged_by(full_name, email)').single()
    if (!error) { setLogs(prev => [data, ...prev]); setContent('') }
    setSaving(false)
  }

  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        <span style={{ ...s.sectionTitle, color: 'var(--bronze)' }}>Tease Window Log</span>
        <span style={s.progress}>{logs.length} entries</span>
      </div>
      {isCoordinator && (
        <form onSubmit={addLog} style={s.logForm}>
          <div style={s.logTypeRow}>
            {['general','post','metric','note'].map(t => (
              <button key={t} type="button"
                style={{ ...s.typeBtn, ...(logType === t ? s.typeBtnActive : {}) }}
                onClick={() => setLogType(t)}>{t}</button>
            ))}
          </div>
          <textarea style={s.logInput} placeholder="log an update..." value={content}
            onChange={e => setContent(e.target.value)} rows={2} />
          <button type="submit" style={s.logSubmit} disabled={saving || !content.trim()}>
            {saving ? 'logging...' : 'add entry'}
          </button>
        </form>
      )}
      <div style={s.logList}>
        {logs.length === 0
          ? <div style={s.loadingItems}>no entries yet</div>
          : logs.map(log => (
            <div key={log.id} style={s.logEntry}>
              <div style={s.logEntryHeader}>
                <span style={s.logType}>{log.log_type}</span>
                <span style={s.logMeta}>
                  {new Date(log.logged_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {' · '}{log.logger?.full_name ?? log.logger?.email ?? 'unknown'}
                </span>
              </div>
              <p style={s.logContent}>{log.content}</p>
            </div>
          ))}
      </div>
    </div>
  )
}

function ReleaseDecision({ release, onDecision }) {
  const [confirming, setConfirming] = useState(null)

  if (release.friday_decision) {
    return (
      <div style={{ ...s.section, borderColor: release.friday_decision === 'release' ? '#a8c898' : 'var(--border)' }}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Release Decision</span>
          <span style={{
            fontSize: '11px', padding: '2px 8px', border: '1px solid',
            color: release.friday_decision === 'release' ? '#5a7a4a' : 'var(--text-muted)',
            borderColor: release.friday_decision === 'release' ? '#a8c898' : 'var(--border)',
            background: release.friday_decision === 'release' ? '#f0f5ec' : 'var(--surface-2)',
          }}>
            {release.friday_decision === 'release' ? '✓ releasing' : '✕ returned to pool'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...s.section, borderColor: 'var(--bronze-dim)', background: '#fdf8f2' }}>
      <div style={s.sectionHeader}>
        <span style={{ ...s.sectionTitle, color: 'var(--bronze)' }}>Release Decision</span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.6 }}>
        Is the track getting traction? Sound being used organically, comments asking what it is?
        Make this call whenever the signal is clear — doesn't have to wait until Friday.
      </p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          style={{ ...s.decisionBtn, background: '#5a7a4a', color: '#fff', flex: 1 }}
          onClick={() => setConfirming('release')}
        >
          Yes — release it →
        </button>
        <button
          style={{ ...s.decisionBtn, background: 'var(--surface-2)', color: 'var(--text-muted)', flex: 1 }}
          onClick={() => setConfirming('return_to_pool')}
        >
          No — return to pool
        </button>
      </div>

      {confirming && (
        <div style={{ marginTop: '12px', padding: '12px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '12px', marginBottom: '10px' }}>
            {confirming === 'release'
              ? 'Confirm: move to Released and trigger Co-Brand distribution.'
              : 'Confirm: track returns to the uncleared pool. This cannot be undone easily.'}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...s.decisionBtn, background: 'var(--bronze)', color: '#fff' }}
              onClick={() => { onDecision(confirming); setConfirming(null) }}>confirm</button>
            <button style={{ ...s.decisionBtn, background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              onClick={() => setConfirming(null)}>cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AssetsPanel({ release, isCoordinator }) {
  const [artworkFile, setArtworkFile]   = useState(null)
  const [lyricsFile, setLyricsFile]     = useState(null)
  const [uploading, setUploading]       = useState(null)
  const [localRelease, setLocalRelease] = useState(release)

  useEffect(() => { setLocalRelease(release) }, [release])

  async function uploadAsset(file, field, folder) {
    if (!file) return
    setUploading(field)
    const ext = file.name.split('.').pop()
    const path = `${folder}/${release.id}/${crypto.randomUUID()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('tracks').upload(path, file, { contentType: file.type })
    if (uploadErr) { setUploading(null); return }
    await supabase.from('releases').update({ [field]: path, updated_at: new Date().toISOString() }).eq('id', release.id)
    setLocalRelease(prev => ({ ...prev, [field]: path }))
    setUploading(null)
    if (field === 'artwork_url') setArtworkFile(null)
    if (field === 'lyrics_url') setLyricsFile(null)
  }

  async function download(path, label) {
    const { data, error } = await supabase.storage.from('tracks').createSignedUrl(path, 3600)
    if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const assets = [
    { key: 'track',      label: 'Track file',  path: release.track?.file_url,         field: null },
    { key: 'artwork_url', label: 'Artwork',     path: localRelease.artwork_url,         field: 'artwork_url', folder: 'artwork', accept: '.jpg,.jpeg,.png' },
    { key: 'lyrics_url',  label: 'Lyrics',      path: localRelease.lyrics_url,          field: 'lyrics_url',  folder: 'lyrics',  accept: '.pdf,.txt,.docx' },
  ]

  return (
    <div style={s.metaCard}>
      <div style={{ ...s.metaKey, marginBottom: '12px' }}>ASSETS</div>
      {assets.map(asset => (
        <div key={asset.key} style={s.assetRow}>
          <span style={s.assetLabel}>{asset.label}</span>
          {asset.path ? (
            <button style={s.assetDownload} onClick={() => download(asset.path, asset.label)}>↓ download</button>
          ) : isCoordinator && asset.field ? (
            <label style={s.assetUpload}>
              <input type="file" accept={asset.accept} style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files[0]
                  if (f) uploadAsset(f, asset.field, asset.folder)
                }} />
              {uploading === asset.field ? 'uploading...' : '+ upload'}
            </label>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--border)' }}>not uploaded</span>
          )}
        </div>
      ))}
    </div>
  )
}

const PLATFORMS = ['Spotify','Apple Music','YouTube Music','Amazon Music','Deezer','TikTok','Other']

function PerformanceTab({ releaseId, isCoordinator }) {
  const { profile } = useAuth()
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]     = useState({
    report_date: new Date().toISOString().slice(0, 10),
    platform: 'Spotify', streams: '', tiktok_uses: '', tiktok_views: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  useEffect(() => { fetchData() }, [releaseId])

  async function fetchData() {
    const { data } = await supabase.from('performance_data').select('*')
      .eq('release_id', releaseId).order('report_date', { ascending: false })
    setRows(data ?? []); setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError(null)
    const payload = {
      release_id: releaseId, report_date: form.report_date, platform: form.platform,
      streams: parseInt(form.streams) || 0, tiktok_uses: parseInt(form.tiktok_uses) || 0,
      tiktok_views: parseInt(form.tiktok_views) || 0, notes: form.notes.trim() || null,
      recorded_by: profile?.id,
    }
    const { data, error } = await supabase.from('performance_data').insert(payload).select().single()
    if (error) setError(error.message)
    else { setRows(prev => [data, ...prev]); setForm(f => ({ ...f, streams: '', tiktok_uses: '', tiktok_views: '', notes: '' })) }
    setSaving(false)
  }

  const fmt = n => n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n || 0)
  const totalStreams = rows.reduce((a, r) => a + (r.streams || 0), 0)
  const totalUses    = rows.reduce((a, r) => a + (r.tiktok_uses || 0), 0)
  const totalViews   = rows.reduce((a, r) => a + (r.tiktok_views || 0), 0)

  return (
    <div style={s.body}>
      <div style={s.main}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {[['Total Streams', fmt(totalStreams)], ['TikTok Uses', fmt(totalUses)], ['TikTok Views', fmt(totalViews)]].map(([label, value]) => (
            <div key={label} style={s.statCard}>
              <div style={s.statValue}>{value}</div>
              <div style={s.statLabel}>{label}</div>
            </div>
          ))}
        </div>
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionTitle}>Performance Log</span>
            <span style={s.progress}>{rows.length} entries</span>
          </div>
          {loading ? <div style={s.loadingItems}>loading...</div> : rows.length === 0
            ? <div style={s.loadingItems}>no data yet</div>
            : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['date','platform','streams','tt uses','tt views','notes'].map(h => (
                  <th key={h} style={{ ...s.th, position: 'static' }}>{h}</th>
                ))}</tr></thead>
                <tbody>{rows.map((row, i) => (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)' }}>
                    <td style={s.td}>{new Date(row.report_date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' })}</td>
                    <td style={s.td}>{row.platform}</td>
                    <td style={s.td}>{row.streams?.toLocaleString() ?? '—'}</td>
                    <td style={s.td}>{row.tiktok_uses?.toLocaleString() ?? '—'}</td>
                    <td style={s.td}>{row.tiktok_views?.toLocaleString() ?? '—'}</td>
                    <td style={{ ...s.td, color: 'var(--text-muted)' }}>{row.notes ?? '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
          }
        </div>
        {isCoordinator && (
          <div style={s.section}>
            <div style={s.sectionHeader}><span style={s.sectionTitle}>Add Entry</span></div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'date', type: 'date', key: 'report_date' },
                  { label: 'streams', type: 'number', key: 'streams', placeholder: '0' },
                  { label: 'TikTok uses', type: 'number', key: 'tiktok_uses', placeholder: '0' },
                  { label: 'TikTok views', type: 'number', key: 'tiktok_views', placeholder: '0' },
                ].map(f => (
                  <div key={f.key}>
                    <div style={s.metaKey}>{f.label}</div>
                    <input style={s.metaInput} type={f.type} placeholder={f.placeholder}
                      value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <div style={s.metaKey}>platform</div>
                  <select style={s.metaInput} value={form.platform}
                    onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}>
                    {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <div style={s.metaKey}>notes</div>
                  <input style={s.metaInput} placeholder="e.g. playlist add"
                    value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
              {error && <p style={{ fontSize: '11px', color: '#b84040', marginTop: '8px' }}>{error}</p>}
              <button type="submit" disabled={saving}
                style={{ ...s.stageBtn, ...s.stageBtnAdvance, marginTop: '14px', border: 'none' }}>
                {saving ? 'saving...' : 'save entry'}
              </button>
            </form>
          </div>
        )}
      </div>
      <div style={s.sidebar} />
    </div>
  )
}

export default function ReleaseDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [release, setRelease] = useState(null)
  const [loading, setLoading] = useState(true)
  const [seeded, setSeeded]   = useState(false)
  const [tab, setTab]         = useState('overview')
  const isCoordinator = !profile || profile.role === 'coordinator'
  const isContent     = profile?.role === 'content'

  useEffect(() => { fetchRelease() }, [id])

  async function fetchRelease() {
    const { data } = await supabase
      .from('releases').select('*, track:tracks(*)')
      .eq('id', id).single()
    if (data) { setRelease(data); seedChecklists(data) }
    setLoading(false)
  }

  async function seedChecklists(rel) {
    const { count } = await supabase
      .from('checklist_items').select('id', { count: 'exact', head: true })
      .eq('release_id', rel.id)
    if (count > 0) { setSeeded(true); return }
    const items = [
      ...DISTRIBUTION_ITEMS.map((label, i) => ({ release_id: rel.id, checklist: 'pre_release', label, position: i })),
      ...MARKETING_ITEMS.map((label, i) => ({ release_id: rel.id, checklist: 'post_release', label, position: i })),
    ]
    await supabase.from('checklist_items').insert(items)
    setSeeded(true)
  }

  async function moveStage(newStage) {
    const updates = { stage: newStage, updated_at: new Date().toISOString() }
    if (newStage === 'tease_window' && !release.tease_start_date) {
      updates.tease_start_date = nextMonday()
    }
    const { error } = await supabase.from('releases').update(updates).eq('id', id)
    if (!error) setRelease(prev => ({ ...prev, ...updates }))
  }

  async function handleFridayDecision(decision) {
    const updates = { friday_decision: decision, updated_at: new Date().toISOString() }
    if (decision === 'release') {
      updates.stage = 'released'
    } else {
      // Return to pool: unset cleared on the track, move release back to intake
      updates.stage = 'intake'
      await supabase.from('tracks').update({ cleared: false }).eq('id', release.track_id)
    }
    const { error } = await supabase.from('releases').update(updates).eq('id', id)
    if (!error) setRelease(prev => ({ ...prev, ...updates }))
  }

  async function saveDate(date) {
    await supabase.from('releases').update({ release_date: date || null, updated_at: new Date().toISOString() }).eq('id', id)
    setRelease(prev => ({ ...prev, release_date: date }))
  }

  async function saveNotes(notes) {
    await supabase.from('releases').update({ notes, updated_at: new Date().toISOString() }).eq('id', id)
    setRelease(prev => ({ ...prev, notes }))
  }

  if (loading) return <div style={s.loading}>loading release...</div>
  if (!release) return <div style={s.loading}>release not found</div>

  const stageIdx = STAGES.findIndex(st => st.key === release.stage)

  return (
    <div style={s.page}>
      {/* Top bar */}
      <div style={s.topBar}>
        <Link to="/releases" style={s.back}>← releases</Link>
        <div style={s.topBarRight}>
          {isCoordinator && stageIdx > 0 && (
            <button style={s.stageBtn} onClick={() => moveStage(STAGES[stageIdx - 1].key)}>
              ← {STAGES[stageIdx - 1].label}
            </button>
          )}
          {isCoordinator && stageIdx < STAGES.length - 1 && release.stage !== 'tease_window' && (
            <button style={{ ...s.stageBtn, ...s.stageBtnAdvance }}
              onClick={() => moveStage(STAGES[stageIdx + 1].key)}>
              Move to {STAGES[stageIdx + 1].label} →
            </button>
          )}
          {isCoordinator && release.stage === 'tease_window' && !release.friday_decision && (
            <span style={{ fontSize: '11px', color: 'var(--bronze)', letterSpacing: '0.06em' }}>
              release decision required before advancing
            </span>
          )}
        </div>
      </div>

      {/* Stage timeline */}
      <div style={s.timeline}>
        {STAGES.map((st, i) => {
          const isPast = i < stageIdx; const isCurrent = i === stageIdx
          return (
            <div key={st.key} style={s.timelineStep}>
              <div style={{ ...s.timelineDot, ...(isCurrent ? s.dotCurrent : isPast ? s.dotPast : s.dotFuture) }} />
              <span style={{ ...s.timelineLabel, color: isCurrent ? 'var(--bronze)' : isPast ? 'var(--text)' : 'var(--text-muted)', fontWeight: isCurrent ? 500 : 400 }}>
                {st.label}
              </span>
              {i < STAGES.length - 1 && <div style={{ ...s.timelineLine, background: isPast ? 'var(--bronze-dim)' : 'var(--border)' }} />}
            </div>
          )
        })}
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {['overview', 'performance'].map(t => (
          <button key={t} style={{ ...s.tabBtn, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'performance' && <PerformanceTab releaseId={id} isCoordinator={isCoordinator} />}

      {tab === 'overview' && (
        <div style={s.body}>
          <div style={s.main}>
            {seeded && (
              <>
                <ChecklistSection releaseId={id} checklist="pre_release" label="Distribution Checklist" isCoordinator={isCoordinator} />
                <ChecklistSection releaseId={id} checklist="post_release" label="Marketing Checklist" isCoordinator={isCoordinator} />
                {release.stage === 'tease_window' && (
                  <>
                    <ReleaseDecision release={release} onDecision={handleFridayDecision} />
                    <TeaseWindowLog releaseId={id} isCoordinator={isCoordinator || isContent} />
                  </>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div style={s.sidebar}>
            {/* Track metadata */}
            <div style={s.metaCard}>
              <div style={s.metaTitle}>{release.track?.title ?? '—'}</div>
              <div style={s.metaArtist}>{release.track?.artist === 'TBC' ? <span style={{ color: 'var(--text-muted)' }}>Artist TBC</span> : release.track?.artist}</div>

              <div style={s.metaDivider} />

              {[
                { key: 'writer(s)', val: release.track?.writers },
                { key: 'producer(s)', val: release.track?.producers },
                { key: 'ownership', val: release.track?.ownership === '100_owned' ? '100% owned' : release.track?.ownership === 'needs_permission' ? 'needs permission' : null },
                { key: 'bpm', val: release.track?.bpm },
                { key: 'key', val: release.track?.track_key },
                { key: 'length', val: release.track?.track_length },
                { key: 'genre', val: release.track?.genre },
              ].filter(r => r.val).map(r => (
                <div key={r.key} style={s.metaRow}>
                  <span style={s.metaKey}>{r.key}</span>
                  <span style={s.metaVal}>{r.val}</span>
                </div>
              ))}

              <div style={s.metaRow}>
                <span style={s.metaKey}>cleared</span>
                <span style={{ ...s.metaVal, color: release.track?.cleared ? 'var(--bronze)' : 'var(--text-muted)' }}>
                  {release.track?.cleared ? 'yes' : 'no'}
                </span>
              </div>

              <div style={s.metaDivider} />

              <div style={s.metaRow}>
                <span style={s.metaKey}>stage</span>
                <span style={s.metaVal}>{STAGES.find(st => st.key === release.stage)?.label}</span>
              </div>

              {release.tease_start_date && (
                <div style={s.metaRow}>
                  <span style={s.metaKey}>tease start</span>
                  <span style={{ ...s.metaVal, color: 'var(--bronze)' }}>
                    {new Date(release.tease_start_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )}

              <div style={s.metaDivider} />

              <div style={s.metaKey}>release date</div>
              {isCoordinator ? (
                <input type="date" style={s.metaInput} value={release.release_date ?? ''}
                  onChange={e => saveDate(e.target.value)} />
              ) : (
                <div style={s.metaVal}>
                  {release.release_date
                    ? new Date(release.release_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '—'}
                </div>
              )}

              {isCoordinator && (
                <>
                  <div style={{ ...s.metaKey, marginTop: '16px' }}>notes</div>
                  <textarea style={{ ...s.metaInput, minHeight: '80px', resize: 'vertical' }}
                    value={release.notes ?? ''}
                    onChange={e => setRelease(prev => ({ ...prev, notes: e.target.value }))}
                    onBlur={e => saveNotes(e.target.value)}
                    placeholder="internal notes..." />
                </>
              )}

              <div style={s.metaDivider} />
              <div style={s.metaRow}>
                <span style={s.metaKey}>created</span>
                <span style={s.metaVal}>
                  {new Date(release.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Assets */}
            <div style={{ marginTop: '16px' }}>
              <AssetsPanel release={release} isCoordinator={isCoordinator} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page:    { display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 48px)' },
  loading: { padding: '48px 24px', color: 'var(--text-muted)', fontSize: '12px' },
  topBar:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' },
  back:    { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em' },
  topBarRight: { display: 'flex', gap: '8px', alignItems: 'center' },
  stageBtn: { background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '6px 12px', fontSize: '11px', letterSpacing: '0.05em', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' },
  stageBtnAdvance: { background: 'var(--bronze)', color: '#fff', borderColor: 'var(--bronze)' },
  timeline: { display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', overflowX: 'auto' },
  timelineStep:  { display: 'flex', alignItems: 'center', flexShrink: 0 },
  timelineDot:   { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  dotCurrent:    { background: 'var(--bronze)', boxShadow: '0 0 0 3px #f5ede0' },
  dotPast:       { background: 'var(--bronze-dim)' },
  dotFuture:     { background: 'var(--border)' },
  timelineLabel: { fontSize: '11px', letterSpacing: '0.06em', margin: '0 8px', whiteSpace: 'nowrap' },
  timelineLine:  { width: '40px', height: '1px', flexShrink: 0 },
  tabBar:   { display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 24px' },
  tabBtn:   { background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '10px 16px', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '-1px', fontFamily: 'var(--font)' },
  tabActive: { color: 'var(--bronze)', borderBottomColor: 'var(--bronze)' },
  body:    { display: 'flex', flex: 1, alignItems: 'flex-start' },
  main:    { flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 },
  sidebar: { width: '280px', flexShrink: 0, padding: '24px', borderLeft: '1px solid var(--border)' },
  section: { background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' },
  sectionTitle:  { fontSize: '11px', letterSpacing: '0.1em', fontWeight: 500, textTransform: 'uppercase' },
  progress:      { fontSize: '11px', color: 'var(--text-muted)' },
  progressBar:   { height: '2px', background: 'var(--surface-2)', marginBottom: '16px', borderRadius: '1px' },
  progressFill:  { height: '100%', background: 'var(--bronze)', borderRadius: '1px', transition: 'width 0.3s' },
  checkList:     { display: 'flex', flexDirection: 'column', gap: '1px' },
  checkSection:  { fontSize: '10px', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '10px 0 4px', borderBottom: '1px solid var(--border)', marginTop: '6px', fontWeight: 500 },
  checkRow:      { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '6px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)' },
  checkbox:      { accentColor: 'var(--bronze)', width: '13px', height: '13px', cursor: 'pointer', flexShrink: 0, marginTop: '2px' },
  checkLabel:    { fontSize: '12px', color: 'var(--text)', userSelect: 'none', lineHeight: 1.4 },
  checkDone:     { color: 'var(--text-muted)', textDecoration: 'line-through' },
  loadingItems:  { fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' },
  addRow:        { display: 'flex', gap: '6px', marginTop: '12px' },
  addInput:      { flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', padding: '7px 10px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none' },
  addItemBtn:    { background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '7px 12px', fontSize: '14px', cursor: 'pointer', color: 'var(--text-muted)' },
  logForm:       { marginBottom: '16px' },
  logTypeRow:    { display: 'flex', gap: '4px', marginBottom: '8px' },
  typeBtn:       { background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '4px 10px', fontSize: '10px', letterSpacing: '0.05em', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' },
  typeBtnActive: { background: 'var(--bronze)', color: '#fff', borderColor: 'var(--bronze)' },
  logInput:      { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none', resize: 'vertical' },
  logSubmit:     { marginTop: '6px', background: 'var(--bronze)', color: '#fff', border: 'none', padding: '8px 16px', fontSize: '11px', letterSpacing: '0.06em', cursor: 'pointer', fontFamily: 'var(--font)' },
  logList:       { display: 'flex', flexDirection: 'column', gap: '8px' },
  logEntry:      { background: 'var(--bg)', border: '1px solid var(--border)', padding: '10px 12px' },
  logEntryHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' },
  logType:       { fontSize: '10px', letterSpacing: '0.06em', color: 'var(--bronze)', textTransform: 'uppercase' },
  logMeta:       { fontSize: '10px', color: 'var(--text-muted)' },
  logContent:    { fontSize: '12px', color: 'var(--text)', lineHeight: 1.5 },
  decisionBtn:   { padding: '10px 16px', border: 'none', fontSize: '12px', letterSpacing: '0.05em', cursor: 'pointer', fontFamily: 'var(--font)' },
  metaCard:      { background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px' },
  metaTitle:     { fontSize: '14px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' },
  metaArtist:    { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' },
  metaDivider:   { height: '1px', background: 'var(--border)', margin: '14px 0' },
  metaRow:       { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px', gap: '8px' },
  metaKey:       { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', flexShrink: 0 },
  metaVal:       { fontSize: '12px', color: 'var(--text)', textAlign: 'right' },
  metaInput:     { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none' },
  assetRow:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' },
  assetLabel:    { fontSize: '11px', color: 'var(--text)', letterSpacing: '0.04em' },
  assetDownload: { background: 'none', border: '1px solid var(--border)', color: 'var(--bronze)', padding: '3px 8px', fontSize: '10px', cursor: 'pointer', fontFamily: 'var(--font)' },
  assetUpload:   { background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '3px 8px', fontSize: '10px', cursor: 'pointer', fontFamily: 'var(--font)' },
  statCard:      { flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 20px' },
  statValue:     { fontSize: '22px', fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '4px' },
  statLabel:     { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' },
  th:  { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'left', padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase' },
  td:  { fontSize: '12px', padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text)' },
}
