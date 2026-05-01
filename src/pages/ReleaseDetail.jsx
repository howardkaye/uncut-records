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

const PRE_DEFAULTS = [
  'Artwork confirmed',
  'ISRC registered',
  'Metadata submitted to Co-Brand',
  'Pre-save link live',
  'Pitch to DSPs sent',
  'Social assets ready',
  'Release date confirmed with Co-Brand',
]

const POST_DEFAULTS = [
  'Confirmed live on all DSPs',
  'Tease window assets posted',
  'Performance monitoring active',
  'First week report drafted',
  'Spend recorded',
]

function ChecklistSection({ releaseId, checklist, label, isCoordinator }) {
  const { profile } = useAuth()
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding]     = useState(false)

  useEffect(() => { fetchItems() }, [releaseId, checklist])

  async function fetchItems() {
    const { data } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('release_id', releaseId)
      .eq('checklist', checklist)
      .order('position')
    setItems(data ?? [])
    setLoading(false)
  }

  async function toggle(item) {
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
      .select()
      .single()
    if (!error) { setItems(prev => [...prev, data]); setNewLabel('') }
  }

  const done  = items.filter(i => i.completed).length
  const total = items.length

  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        <span style={s.sectionTitle}>{label}</span>
        <span style={s.progress}>{done}/{total}</span>
      </div>

      {total > 0 && (
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      )}

      {loading ? (
        <div style={s.loadingItems}>loading...</div>
      ) : (
        <div style={s.checkList}>
          {items.map(item => (
            <label key={item.id} style={s.checkRow}>
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => toggle(item)}
                style={s.checkbox}
                disabled={!isCoordinator}
              />
              <span style={{ ...s.checkLabel, ...(item.completed ? s.checkDone : {}) }}>
                {item.label}
              </span>
            </label>
          ))}
        </div>
      )}

      {isCoordinator && (
        <form onSubmit={addItem} style={s.addRow}>
          <input
            style={s.addInput}
            placeholder="add item..."
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
          />
          <button type="submit" style={s.addItemBtn} disabled={!newLabel.trim()}>+</button>
        </form>
      )}
    </div>
  )
}

function TeaseWindowLog({ releaseId, isCoordinator }) {
  const { profile } = useAuth()
  const [logs, setLogs]     = useState([])
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
      .select('*, logger:logged_by(full_name, email)')
      .single()
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
            {['general', 'post', 'metric', 'note'].map(t => (
              <button
                key={t} type="button"
                style={{ ...s.typeBtn, ...(logType === t ? s.typeBtnActive : {}) }}
                onClick={() => setLogType(t)}
              >{t}</button>
            ))}
          </div>
          <textarea
            style={s.logInput}
            placeholder="log an update..."
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={2}
          />
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
                  {' · '}
                  {log.logger?.full_name ?? log.logger?.email ?? 'unknown'}
                </span>
              </div>
              <p style={s.logContent}>{log.content}</p>
            </div>
          ))
        }
      </div>
    </div>
  )
}

const PLATFORMS = ['Spotify', 'Apple Music', 'YouTube Music', 'Amazon Music', 'Deezer', 'TikTok', 'Other']

function PerformanceTab({ releaseId, isCoordinator }) {
  const { profile } = useAuth()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({
    report_date: new Date().toISOString().slice(0, 10),
    platform: 'Spotify',
    streams: '',
    tiktok_uses: '',
    tiktok_views: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  useEffect(() => { fetchData() }, [releaseId])

  async function fetchData() {
    const { data } = await supabase
      .from('performance_data')
      .select('*')
      .eq('release_id', releaseId)
      .order('report_date', { ascending: false })
    setRows(data ?? [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true); setError(null)
    const payload = {
      release_id:   releaseId,
      report_date:  form.report_date,
      platform:     form.platform,
      streams:      parseInt(form.streams)     || 0,
      tiktok_uses:  parseInt(form.tiktok_uses) || 0,
      tiktok_views: parseInt(form.tiktok_views)|| 0,
      notes:        form.notes.trim() || null,
      recorded_by:  profile?.id,
    }
    const { data, error } = await supabase.from('performance_data').insert(payload).select().single()
    if (error) { setError(error.message) }
    else { setRows(prev => [data, ...prev]); setForm(f => ({ ...f, streams: '', tiktok_uses: '', tiktok_views: '', notes: '' })) }
    setSaving(false)
  }

  const totalStreams = rows.reduce((a, r) => a + (r.streams || 0), 0)
  const totalTikTokUses  = rows.reduce((a, r) => a + (r.tiktok_uses || 0), 0)
  const totalTikTokViews = rows.reduce((a, r) => a + (r.tiktok_views || 0), 0)
  const fmt = n => n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n)

  return (
    <div style={s.body}>
      <div style={s.main}>
        {/* Summary stats */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { label: 'Total Streams',    value: fmt(totalStreams) },
            { label: 'TikTok Uses',      value: fmt(totalTikTokUses) },
            { label: 'TikTok Views',     value: fmt(totalTikTokViews) },
          ].map(stat => (
            <div key={stat.label} style={s.statCard}>
              <div style={s.statValue}>{stat.value}</div>
              <div style={s.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Data table */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionTitle}>Performance Log</span>
            <span style={s.progress}>{rows.length} entries</span>
          </div>
          {loading ? (
            <div style={s.loadingItems}>loading...</div>
          ) : rows.length === 0 ? (
            <div style={s.loadingItems}>no data yet — add an entry below</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['date', 'platform', 'streams', 'tt uses', 'tt views', 'notes'].map(h => (
                    <th key={h} style={{ ...s.th, position: 'static' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)' }}>
                    <td style={s.td}>
                      {new Date(row.report_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td style={s.td}>{row.platform}</td>
                    <td style={{ ...s.td, fontVariantNumeric: 'tabular-nums' }}>{row.streams?.toLocaleString() ?? '—'}</td>
                    <td style={{ ...s.td, fontVariantNumeric: 'tabular-nums' }}>{row.tiktok_uses?.toLocaleString() ?? '—'}</td>
                    <td style={{ ...s.td, fontVariantNumeric: 'tabular-nums' }}>{row.tiktok_views?.toLocaleString() ?? '—'}</td>
                    <td style={{ ...s.td, color: 'var(--text-muted)' }}>{row.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Entry form */}
        {isCoordinator && (
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionTitle}>Add Entry</span>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={s.metaKey}>date</div>
                  <input style={s.metaInput} type="date" value={form.report_date}
                    onChange={e => setForm(f => ({ ...f, report_date: e.target.value }))} required />
                </div>
                <div>
                  <div style={s.metaKey}>platform</div>
                  <select style={s.metaInput} value={form.platform}
                    onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                    {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <div style={s.metaKey}>streams</div>
                  <input style={s.metaInput} type="number" min="0" placeholder="0" value={form.streams}
                    onChange={e => setForm(f => ({ ...f, streams: e.target.value }))} />
                </div>
                <div>
                  <div style={s.metaKey}>TikTok uses</div>
                  <input style={s.metaInput} type="number" min="0" placeholder="0" value={form.tiktok_uses}
                    onChange={e => setForm(f => ({ ...f, tiktok_uses: e.target.value }))} />
                </div>
                <div>
                  <div style={s.metaKey}>TikTok views</div>
                  <input style={s.metaInput} type="number" min="0" placeholder="0" value={form.tiktok_views}
                    onChange={e => setForm(f => ({ ...f, tiktok_views: e.target.value }))} />
                </div>
                <div>
                  <div style={s.metaKey}>notes (optional)</div>
                  <input style={s.metaInput} placeholder="e.g. playlist add" value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              {error && <p style={{ fontSize: '11px', color: '#b84040', marginTop: '8px' }}>{error}</p>}
              <button type="submit" disabled={saving} style={{ ...s.stageBtnAdvance, ...s.stageBtn, marginTop: '14px', border: 'none' }}>
                {saving ? 'saving...' : 'save entry'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Sidebar stays same as overview */}
      <div style={s.sidebar} />
    </div>
  )
}

export default function ReleaseDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [release, setRelease]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [seeded, setSeeded]     = useState(false)
  const [tab, setTab]           = useState('overview')
  const isCoordinator = !profile || profile.role === 'coordinator'

  useEffect(() => { fetchRelease() }, [id])

  async function fetchRelease() {
    const { data } = await supabase
      .from('releases')
      .select('*, track:tracks(*)')
      .eq('id', id)
      .single()
    if (data) { setRelease(data); seedChecklists(data) }
    setLoading(false)
  }

  async function seedChecklists(rel) {
    const { count } = await supabase
      .from('checklist_items')
      .select('id', { count: 'exact', head: true })
      .eq('release_id', rel.id)
    if (count > 0) { setSeeded(true); return }

    const items = [
      ...PRE_DEFAULTS.map((label, i) => ({ release_id: rel.id, checklist: 'pre_release', label, position: i })),
      ...POST_DEFAULTS.map((label, i) => ({ release_id: rel.id, checklist: 'post_release', label, position: i })),
    ]
    await supabase.from('checklist_items').insert(items)
    setSeeded(true)
  }

  async function moveStage(newStage) {
    const { error } = await supabase
      .from('releases')
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) setRelease(prev => ({ ...prev, stage: newStage }))
  }

  async function saveDate(date) {
    const { error } = await supabase
      .from('releases')
      .update({ release_date: date || null, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) setRelease(prev => ({ ...prev, release_date: date }))
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
          {isCoordinator && stageIdx < STAGES.length - 1 && (
            <button style={{ ...s.stageBtn, ...s.stageBtnAdvance }} onClick={() => moveStage(STAGES[stageIdx + 1].key)}>
              Move to {STAGES[stageIdx + 1].label} →
            </button>
          )}
        </div>
      </div>

      {/* Stage timeline */}
      <div style={s.timeline}>
        {STAGES.map((st, i) => {
          const isPast    = i < stageIdx
          const isCurrent = i === stageIdx
          return (
            <div key={st.key} style={s.timelineStep}>
              <div style={{
                ...s.timelineDot,
                ...(isCurrent ? s.dotCurrent : isPast ? s.dotPast : s.dotFuture),
              }} />
              <span style={{
                ...s.timelineLabel,
                color: isCurrent ? 'var(--bronze)' : isPast ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: isCurrent ? 500 : 400,
              }}>
                {st.label}
              </span>
              {i < STAGES.length - 1 && (
                <div style={{ ...s.timelineLine, background: isPast ? 'var(--bronze-dim)' : 'var(--border)' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {['overview', 'performance'].map(t => (
          <button
            key={t}
            style={{ ...s.tabBtn, ...(tab === t ? s.tabActive : {}) }}
            onClick={() => setTab(t)}
          >{t}</button>
        ))}
      </div>

      {/* Performance tab */}
      {tab === 'performance' && (
        <PerformanceTab releaseId={id} isCoordinator={isCoordinator} />
      )}

      {/* Overview tab */}
      {tab === 'overview' && (
      <div style={s.body}>
        {/* Left: checklists + tease log */}
        <div style={s.main}>
          {seeded && (
            <>
              <ChecklistSection
                releaseId={id}
                checklist="pre_release"
                label="Pre-release Checklist"
                isCoordinator={isCoordinator}
              />
              <ChecklistSection
                releaseId={id}
                checklist="post_release"
                label="Post-release Checklist"
                isCoordinator={isCoordinator}
              />
              {release.stage === 'tease_window' && (
                <TeaseWindowLog releaseId={id} isCoordinator={isCoordinator} />
              )}
            </>
          )}
        </div>

        {/* Right: metadata */}
        <div style={s.sidebar}>
          <div style={s.metaCard}>
            <div style={s.metaTitle}>{release.track?.title ?? '—'}</div>
            <div style={s.metaArtist}>{release.track?.artist ?? '—'}</div>

            <div style={s.metaDivider} />

            <div style={s.metaRow}>
              <span style={s.metaKey}>stage</span>
              <span style={s.metaVal}>{STAGES.find(st => st.key === release.stage)?.label}</span>
            </div>

            <div style={s.metaRow}>
              <span style={s.metaKey}>cleared</span>
              <span style={{ ...s.metaVal, color: release.track?.cleared ? 'var(--bronze)' : 'var(--text-muted)' }}>
                {release.track?.cleared ? 'yes' : 'no'}
              </span>
            </div>

            <div style={s.metaDivider} />

            <div style={s.metaKey}>release date</div>
            {isCoordinator ? (
              <input
                type="date"
                style={s.metaInput}
                value={release.release_date ?? ''}
                onChange={e => saveDate(e.target.value)}
              />
            ) : (
              <div style={s.metaVal}>
                {release.release_date
                  ? new Date(release.release_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '—'}
              </div>
            )}

            <div style={{ ...s.metaKey, marginTop: '16px' }}>notes</div>
            {isCoordinator ? (
              <textarea
                style={{ ...s.metaInput, minHeight: '80px', resize: 'vertical' }}
                value={release.notes ?? ''}
                onChange={e => setRelease(prev => ({ ...prev, notes: e.target.value }))}
                onBlur={e => saveNotes(e.target.value)}
                placeholder="internal notes..."
              />
            ) : (
              <div style={{ ...s.metaVal, color: 'var(--text-muted)' }}>{release.notes || '—'}</div>
            )}

            <div style={s.metaDivider} />
            <div style={{ ...s.metaRow }}>
              <span style={s.metaKey}>created</span>
              <span style={s.metaVal}>
                {new Date(release.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
              </span>
            </div>
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

  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
  },
  back: { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em' },
  topBarRight:   { display: 'flex', gap: '8px' },
  stageBtn:      { background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '6px 12px', fontSize: '11px', letterSpacing: '0.05em', cursor: 'pointer', color: 'var(--text-muted)' },
  stageBtnAdvance: { background: 'var(--bronze)', color: '#fff', borderColor: 'var(--bronze)' },

  timeline: {
    display: 'flex', alignItems: 'center', padding: '16px 24px',
    borderBottom: '1px solid var(--border)', background: 'var(--bg)', overflowX: 'auto',
  },
  timelineStep:  { display: 'flex', alignItems: 'center', flexShrink: 0 },
  timelineDot:   { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  dotCurrent:    { background: 'var(--bronze)', boxShadow: '0 0 0 3px #f5ede0' },
  dotPast:       { background: 'var(--bronze-dim)' },
  dotFuture:     { background: 'var(--border)' },
  timelineLabel: { fontSize: '11px', letterSpacing: '0.06em', margin: '0 8px', whiteSpace: 'nowrap' },
  timelineLine:  { width: '40px', height: '1px', flexShrink: 0 },

  tabBar: {
    display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 24px',
  },
  tabBtn: {
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    padding: '10px 16px', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--text-muted)',
    cursor: 'pointer', marginBottom: '-1px', fontFamily: 'var(--font)',
  },
  tabActive: { color: 'var(--bronze)', borderBottomColor: 'var(--bronze)' },

  statCard:  {
    flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 20px',
  },
  statValue: { fontSize: '22px', fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '4px' },
  statLabel: { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' },

  th: {
    fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 500,
    textAlign: 'left', padding: '8px 12px', background: 'var(--surface)',
    borderBottom: '1px solid var(--border)', textTransform: 'uppercase',
  },
  td: { fontSize: '12px', padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text)' },

  body:    { display: 'flex', flex: 1, gap: '0', alignItems: 'flex-start' },
  main:    { flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 },
  sidebar: { width: '280px', flexShrink: 0, padding: '24px', borderLeft: '1px solid var(--border)' },

  section: { background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' },
  sectionTitle:  { fontSize: '11px', letterSpacing: '0.1em', fontWeight: 500, textTransform: 'uppercase' },
  progress:      { fontSize: '11px', color: 'var(--text-muted)' },

  progressBar:  { height: '2px', background: 'var(--surface-2)', marginBottom: '16px', borderRadius: '1px' },
  progressFill: { height: '100%', background: 'var(--bronze)', borderRadius: '1px', transition: 'width 0.3s' },

  checkList:    { display: 'flex', flexDirection: 'column', gap: '2px' },
  checkRow:     { display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)' },
  checkbox:     { accentColor: 'var(--bronze)', width: '13px', height: '13px', cursor: 'pointer', flexShrink: 0 },
  checkLabel:   { fontSize: '12px', color: 'var(--text)', userSelect: 'none' },
  checkDone:    { color: 'var(--text-muted)', textDecoration: 'line-through' },
  loadingItems: { fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' },

  addRow:    { display: 'flex', gap: '6px', marginTop: '12px' },
  addInput:  { flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', padding: '7px 10px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none' },
  addItemBtn: { background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '7px 12px', fontSize: '14px', cursor: 'pointer', color: 'var(--text-muted)' },

  logForm:     { marginBottom: '16px' },
  logTypeRow:  { display: 'flex', gap: '4px', marginBottom: '8px' },
  typeBtn:     { background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '4px 10px', fontSize: '10px', letterSpacing: '0.05em', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' },
  typeBtnActive: { background: 'var(--bronze)', color: '#fff', borderColor: 'var(--bronze)' },
  logInput:    { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none', resize: 'vertical' },
  logSubmit:   { marginTop: '6px', background: 'var(--bronze)', color: '#fff', border: 'none', padding: '8px 16px', fontSize: '11px', letterSpacing: '0.06em', cursor: 'pointer', fontFamily: 'var(--font)' },

  logList:        { display: 'flex', flexDirection: 'column', gap: '8px' },
  logEntry:       { background: 'var(--bg)', border: '1px solid var(--border)', padding: '10px 12px' },
  logEntryHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' },
  logType:        { fontSize: '10px', letterSpacing: '0.06em', color: 'var(--bronze)', textTransform: 'uppercase' },
  logMeta:        { fontSize: '10px', color: 'var(--text-muted)' },
  logContent:     { fontSize: '12px', color: 'var(--text)', lineHeight: 1.5 },

  metaCard:    { background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px' },
  metaTitle:   { fontSize: '14px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' },
  metaArtist:  { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' },
  metaDivider: { height: '1px', background: 'var(--border)', margin: '14px 0' },
  metaRow:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  metaKey:     { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' },
  metaVal:     { fontSize: '12px', color: 'var(--text)' },
  metaInput:   {
    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
    padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none',
  },
}
