import { useEffect, useState } from 'react'

const TYPE_CONFIG = {
  release: { label: 'Release',  color: '#8B6340', bg: '#f5ede0', border: '#d4a96a' },
  tease:   { label: 'Tease',    color: '#5c7a3e', bg: '#eef4e8', border: '#9abb7a' },
  content: { label: 'Content',  color: '#3a5f8a', bg: '#e8f0f8', border: '#7aa3cc' },
  ads:     { label: 'Ads',      color: '#6b4a8a', bg: '#f2ecf8', border: '#b08acc' },
  other:   { label: 'Other',    color: '#777',    bg: '#f0f0f0', border: '#ccc'    },
}

const DAYS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function isoToLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Build 6-row grid of day strings (ISO) for a given month, Mon-Sun
function buildGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  // Monday = 0, Sunday = 6
  const startOffset = (firstDay.getDay() + 6) % 7
  const days = []
  const cursor = new Date(firstDay)
  cursor.setDate(1 - startOffset)
  for (let i = 0; i < 42; i++) {
    days.push(toISO(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function shortName(event) {
  if (event.trackName) return event.trackName
  // Strip emoji and long prefixes for display
  return event.name
    .replace(/^[^\w\s]*\s*/, '')
    .replace(/\s+—\s+.*$/, '')
    .replace(/\s+[-–]\s+.*$/, '')
    .trim()
    .substring(0, 22)
}

export default function Calendar() {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [tooltip, setTooltip] = useState(null) // { event, x, y }
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetch('/api/asana-calendar')
      .then(r => r.json())
      .then(({ data, error }) => {
        if (error) setError(error)
        else setEvents(data ?? [])
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const grid    = buildGrid(year, month)
  const todayISO = toISO(today)

  const visibleEvents = filter === 'all' ? events : events.filter(e => e.type === filter)

  const byDate = {}
  visibleEvents.forEach(e => {
    if (!byDate[e.due_on]) byDate[e.due_on] = []
    byDate[e.due_on].push(e)
  })

  // Upcoming list: next 30 days
  const upcoming = events
    .filter(e => e.due_on >= todayISO && !e.completed)
    .slice(0, 10)

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.pageTitle}>CALENDAR</div>
          <div style={s.pageSubtitle}>Uncut Teases & Releases — from Asana</div>
        </div>
        <div style={s.headerRight}>
          {/* Type filters */}
          <div style={s.filters}>
            {['all', 'release', 'tease', 'content', 'ads'].map(f => (
              <button
                key={f}
                style={{ ...s.filterBtn, ...(filter === f ? { background: 'var(--surface-2)', color: 'var(--text)', fontWeight: 500 } : {}) }}
                onClick={() => setFilter(f)}>
                {f === 'all' ? 'all' : TYPE_CONFIG[f].label.toLowerCase()}
              </button>
            ))}
          </div>
          {/* Month nav */}
          <div style={s.monthNav}>
            <button style={s.navBtn} onClick={prevMonth}>‹</button>
            <span style={s.monthLabel}>{MONTHS[month]} {year}</span>
            <button style={s.navBtn} onClick={nextMonth}>›</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={s.empty}>loading calendar…</div>
      ) : error ? (
        <div style={{ ...s.empty, color: '#b84040' }}>
          {error.includes('ASANA_PAT') ? 'Asana not connected — add ASANA_PAT in Vercel settings' : `Error: ${error}`}
        </div>
      ) : (
        <div style={s.body}>
          {/* Calendar grid */}
          <div style={s.calendarWrap}>
            {/* Day headers */}
            <div style={s.dayHeaders}>
              {DAYS.map(d => (
                <div key={d} style={s.dayHeader}>{d}</div>
              ))}
            </div>

            {/* Grid */}
            <div style={s.grid}>
              {grid.map(iso => {
                const cellMonth = parseInt(iso.split('-')[1]) - 1
                const isCurrentMonth = cellMonth === month
                const isToday = iso === todayISO
                const dayEvents = byDate[iso] ?? []
                const dayNum = parseInt(iso.split('-')[2])

                return (
                  <div
                    key={iso}
                    style={{
                      ...s.cell,
                      ...(isToday ? s.cellToday : {}),
                      ...(!isCurrentMonth ? s.cellFaded : {}),
                    }}>
                    <div style={{ ...s.dayNum, ...(isToday ? s.dayNumToday : {}) }}>{dayNum}</div>
                    <div style={s.eventList}>
                      {dayEvents.map(ev => {
                        const cfg = TYPE_CONFIG[ev.type] ?? TYPE_CONFIG.other
                        return (
                          <div
                            key={ev.gid}
                            style={{
                              ...s.pill,
                              background: cfg.bg,
                              borderColor: cfg.border,
                              color: cfg.color,
                              opacity: ev.completed ? 0.45 : 1,
                              textDecoration: ev.completed ? 'line-through' : 'none',
                            }}
                            title={ev.name}
                            onMouseEnter={e => setTooltip({ event: ev, x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setTooltip(null)}>
                            {shortName(ev)}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Upcoming sidebar */}
          <div style={s.sidebar}>
            <div style={s.sidebarTitle}>Upcoming</div>
            {upcoming.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '8px 0' }}>nothing upcoming</div>
            ) : upcoming.map(ev => {
              const cfg = TYPE_CONFIG[ev.type] ?? TYPE_CONFIG.other
              const d = isoToLocal(ev.due_on)
              const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              return (
                <div key={ev.gid} style={s.upcomingItem}>
                  <div style={{ ...s.upcomingDot, background: cfg.border }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.upcomingName}>{ev.trackName ?? shortName(ev)}</div>
                    <div style={s.upcomingMeta}>
                      <span style={{ color: cfg.color }}>{cfg.label}</span>
                      <span style={{ color: 'var(--text-muted)' }}> · {label}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div style={{ ...s.tooltip, top: tooltip.y + 10, left: tooltip.x + 10 }}>
          <div style={{ fontWeight: 500, marginBottom: '2px' }}>{tooltip.event.name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            {TYPE_CONFIG[tooltip.event.type]?.label} · {tooltip.event.due_on}
            {tooltip.event.completed && ' · completed'}
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page:   { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 24px 12px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '12px', flexShrink: 0 },
  pageTitle:    { fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 500 },
  pageSubtitle: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', letterSpacing: '0.04em' },
  headerRight:  { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },

  filters:    { display: 'flex', border: '1px solid var(--border)', overflow: 'hidden' },
  filterBtn:  { background: 'var(--surface)', border: 'none', borderRight: '1px solid var(--border)', padding: '6px 11px', fontSize: '11px', letterSpacing: '0.05em', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font)' },

  monthNav:   { display: 'flex', alignItems: 'center', gap: '8px' },
  navBtn:     { background: 'var(--surface)', border: '1px solid var(--border)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'var(--text)', fontFamily: 'var(--font)' },
  monthLabel: { fontSize: '13px', fontWeight: 500, color: 'var(--text)', minWidth: '130px', textAlign: 'center' },

  empty: { padding: '48px 24px', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.06em' },

  body:        { display: 'flex', flex: 1, overflow: 'hidden', gap: '0' },
  calendarWrap: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' },

  dayHeaders: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  dayHeader:  { padding: '8px 10px', fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 500, textAlign: 'center' },

  grid:      { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', flex: 1, overflow: 'hidden' },
  cell:      { borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '6px 6px 4px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '2px', minHeight: 0 },
  cellToday: { background: '#fdf8f2' },
  cellFaded: { background: 'var(--bg)', opacity: 0.4 },

  dayNum:      { fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1, marginBottom: '3px', flexShrink: 0 },
  dayNumToday: { color: 'var(--bronze)', fontWeight: 600 },

  eventList: { display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', flex: 1 },
  pill:      { fontSize: '10px', padding: '2px 5px', border: '1px solid', borderRadius: '2px', cursor: 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4, letterSpacing: '0.02em' },

  sidebar:       { width: '220px', flexShrink: 0, overflowY: 'auto', padding: '16px' },
  sidebarTitle:  { fontSize: '10px', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 500 },
  upcomingItem:  { display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' },
  upcomingDot:   { width: '6px', height: '6px', borderRadius: '50%', marginTop: '4px', flexShrink: 0 },
  upcomingName:  { fontSize: '12px', color: 'var(--text)', fontWeight: 500, lineHeight: 1.3, marginBottom: '2px' },
  upcomingMeta:  { fontSize: '10px', letterSpacing: '0.04em' },

  tooltip: { position: 'fixed', background: 'var(--surface)', border: '1px solid var(--border)', padding: '8px 12px', fontSize: '11px', color: 'var(--text)', zIndex: 500, maxWidth: '260px', pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
}
