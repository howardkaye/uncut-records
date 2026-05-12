import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import WaveSurfer from 'wavesurfer.js'
import MusicTempo from 'music-tempo'
import { seedChecklistForRelease } from '../lib/seedChecklist'

async function detectBPM(file) {
  return new Promise((resolve) => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) { resolve(null); return }
    const ctx = new AudioCtx()
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const buffer = await ctx.decodeAudioData(e.target.result)
        const audioData = []
        if (buffer.numberOfChannels >= 2) {
          const ch1 = buffer.getChannelData(0)
          const ch2 = buffer.getChannelData(1)
          for (let i = 0; i < ch1.length; i++) audioData.push((ch1[i] + ch2[i]) / 2)
        } else {
          const ch = buffer.getChannelData(0)
          for (let i = 0; i < ch.length; i++) audioData.push(ch[i])
        }
        const mt = new MusicTempo(audioData)
        resolve(Math.round(mt.tempo))
      } catch (_) { resolve(null) }
      finally { ctx.close() }
    }
    reader.onerror = () => resolve(null)
    reader.readAsArrayBuffer(file)
  })
}

const KEYS = [
  'C major','C# major','D major','D# major','E major','F major',
  'F# major','G major','G# major','A major','A# major','B major',
  'C minor','C# minor','D minor','D# minor','E minor','F minor',
  'F# minor','G minor','G# minor','A minor','A# minor','B minor',
]

const GENRES = [
  'Electronic','Hip-Hop','R&B','Pop','Dance','House','Techno',
  'Drum & Bass','Afrobeats','Reggaeton','Latin','Rock','Indie','Other',
]

function ArtworkThumb({ path }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!path) return
    supabase.storage.from('tracks').createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl)
    })
  }, [path])
  return (
    <div style={{ width: 34, height: 34, flexShrink: 0, background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      {url && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </div>
  )
}

function fmtTime(s) {
  if (!s && s !== 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function TrackPlayer({ path, label }) {
  const containerRef = useRef(null)
  const wsRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!path) return
    let destroyed = false
    supabase.storage.from('tracks').createSignedUrl(path, 3600).then(({ data }) => {
      if (destroyed || !data?.signedUrl || !containerRef.current) return
      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: '#d4cec5',
        progressColor: '#a0723a',
        cursorColor: '#a0723a',
        height: 52,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
      })
      ws.load(data.signedUrl)
      ws.on('ready', () => { if (!destroyed) { setReady(true); setLoading(false); setDuration(ws.getDuration()) } })
      ws.on('timeupdate', t => { if (!destroyed) setCurrentTime(t) })
      ws.on('finish', () => { if (!destroyed) setPlaying(false) })
      wsRef.current = ws
    })
    return () => {
      destroyed = true
      if (wsRef.current) { wsRef.current.destroy(); wsRef.current = null }
    }
  }, [path])

  function togglePlay() {
    if (!wsRef.current || !ready) return
    wsRef.current.playPause()
    setPlaying(p => !p)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 24px', borderTop: '1px solid var(--border)', background: '#faf8f5' }}>
      {label && (
        <span style={{ fontSize: '10px', letterSpacing: '0.06em', color: 'var(--bronze)', textTransform: 'uppercase', minWidth: '80px', fontWeight: 500 }}>
          {label}
        </span>
      )}
      <button
        onClick={togglePlay}
        disabled={!ready}
        style={{
          background: ready ? 'var(--bronze)' : 'var(--surface-2)',
          border: 'none', color: ready ? '#fff' : 'var(--border)',
          width: '32px', height: '32px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: ready ? 'pointer' : 'default',
          fontSize: '12px', flexShrink: 0, fontFamily: 'var(--font)',
        }}
      >
        {loading ? '·' : playing ? '⏸' : '▶'}
      </button>
      <div ref={containerRef} style={{ flex: 1, minWidth: 0 }} />
      <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, minWidth: '80px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {fmtTime(currentTime)} / {fmtTime(duration)}
      </span>
    </div>
  )
}

// ─── TrackFormModal (handles both Add and Edit) ───────────────────────────────
function TrackFormModal({ onClose, onSaved, initialTrack }) {
  const { profile } = useAuth()
  const isEdit = !!initialTrack

  const [form, setForm] = useState({
    title:           initialTrack?.title           ?? '',
    artist:          initialTrack?.artist          ?? '',
    featured_artist: initialTrack?.featured_artist ?? '',
    writers:         initialTrack?.writers         ?? '',
    splits:          initialTrack?.splits          ?? '',
    producers:       initialTrack?.producers       ?? '',
    ownership:       initialTrack?.ownership       ?? 'needs_permission',
    bpm:             initialTrack?.bpm             != null ? String(initialTrack.bpm) : '',
    track_key:       initialTrack?.track_key       ?? '',
    track_length:    initialTrack?.track_length    ?? '',
    genre:           initialTrack?.genre           ?? '',
    is_explicit:     initialTrack?.is_explicit     ?? false,
    notes:           initialTrack?.notes           ?? '',
    contact_info:    initialTrack?.contact_info    ?? profile?.full_name ?? '',
  })

  const [file, setFile]             = useState(null) // new main file (if replacing)
  const [instrumental, setInstrumental] = useState(null) // new instrumental
  const [tiktokAudio, setTiktokAudio]   = useState(null) // new tiktok audio
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function uploadFile(fileObj, folder) {
    const ext = fileObj.name.split('.').pop()
    const path = `${folder}/${crypto.randomUUID()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('tracks').upload(path, fileObj, { contentType: fileObj.type })
    if (uploadErr) throw new Error(uploadErr.message || uploadErr.error || 'Upload failed')
    return path
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.writers.trim()) return
    setSaving(true); setError(null)

    try {
      let file_url          = initialTrack?.file_url          ?? null
      let instrumental_url  = initialTrack?.instrumental_url  ?? null
      let tiktok_audio_url  = initialTrack?.tiktok_audio_url  ?? null

      if (file)         file_url         = await uploadFile(file, 'uncleared')
      if (instrumental) instrumental_url = await uploadFile(instrumental, 'uncleared/instrumental')
      if (tiktokAudio)  tiktok_audio_url = await uploadFile(tiktokAudio, 'uncleared/tiktok')

      const payload = {
        title:           form.title.trim(),
        artist:          form.artist.trim() || 'TBC',
        featured_artist: form.featured_artist.trim() || null,
        writers:         form.writers.trim(),
        splits:          form.splits.trim() || null,
        producers:       form.producers.trim() || null,
        ownership:       form.ownership,
        bpm:             form.bpm ? parseInt(form.bpm) : null,
        track_key:       form.track_key || null,
        track_length:    form.track_length.trim() || null,
        genre:           form.genre || null,
        is_explicit:     form.is_explicit,
        notes:           form.notes.trim() || null,
        contact_info:    form.contact_info.trim() || null,
        file_url,
        instrumental_url,
        tiktok_audio_url,
      }

      if (isEdit) {
        const { data, error: updateErr } = await supabase
          .from('tracks').update(payload).eq('id', initialTrack.id).select().single()
        if (updateErr) throw new Error(updateErr.message)
        onSaved(data)
      } else {
        payload.submitted_by = profile?.id
        const { data, error: insertErr } = await supabase.from('tracks').insert(payload).select().single()
        if (insertErr) throw new Error(insertErr.message)
        onSaved(data)
      }
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{isEdit ? 'edit track' : 'add track'}</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={s.modalForm}>

          {/* ── Audio files ── */}
          <label style={s.label}>
            track file <span style={{ color: 'var(--text-muted)' }}>(WAV)</span>
            {isEdit && initialTrack?.file_url && <span style={{ color: 'var(--bronze)', marginLeft: '6px' }}>✓ uploaded — choose new to replace</span>}
          </label>
          <label style={s.fileBtn}>
            <input type="file" accept=".wav,.mp3,.aiff,.flac" style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files[0]
                if (!f) return
                setFile(f)
                if (!form.title.trim()) {
                  const name = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
                  set('title', name)
                }
                const audio = new Audio()
                const url = URL.createObjectURL(f)
                audio.onloadedmetadata = () => {
                  URL.revokeObjectURL(url)
                  const total = Math.round(audio.duration)
                  const m = Math.floor(total / 60)
                  const sec = total % 60
                  set('track_length', `${m}:${sec.toString().padStart(2, '0')}`)
                }
                audio.onerror = () => URL.revokeObjectURL(url)
                audio.src = url
                set('bpm', '')
                detectBPM(f).then(bpm => { if (bpm) set('bpm', String(bpm)) })
              }} />
            {file ? file.name : '+ choose file'}
          </label>

          <label style={{ ...s.label, marginTop: '10px' }}>
            instrumental <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
            {isEdit && initialTrack?.instrumental_url && <span style={{ color: 'var(--bronze)', marginLeft: '6px' }}>✓ uploaded — choose new to replace</span>}
          </label>
          <label style={s.fileBtn}>
            <input type="file" accept=".wav,.mp3,.aiff,.flac" style={{ display: 'none' }}
              onChange={e => setInstrumental(e.target.files[0])} />
            {instrumental ? instrumental.name : '+ choose file'}
          </label>

          <label style={{ ...s.label, marginTop: '10px' }}>
            tiktok audio <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
            {isEdit && initialTrack?.tiktok_audio_url && <span style={{ color: 'var(--bronze)', marginLeft: '6px' }}>✓ uploaded — choose new to replace</span>}
          </label>
          <label style={s.fileBtn}>
            <input type="file" accept=".wav,.mp3,.aiff,.flac" style={{ display: 'none' }}
              onChange={e => setTiktokAudio(e.target.files[0])} />
            {tiktokAudio ? tiktokAudio.name : '+ choose file'}
          </label>

          <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0' }} />

          {/* ── Metadata ── */}
          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0 12px' }} />
          <div style={{ fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Track info</div>
          <div style={s.formGrid}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={s.label}>track title *</label>
              <input style={s.input} value={form.title} onChange={e => set('title', e.target.value)} required />
            </div>
            <div>
              <label style={s.label}>artist name</label>
              <input style={s.input} placeholder="TBC if unknown" value={form.artist} onChange={e => set('artist', e.target.value)} />
            </div>
            <div>
              <label style={s.label}>featured artist <span style={{ color: 'var(--text-muted)' }}>(if any)</span></label>
              <input style={s.input} placeholder="Leave blank if none" value={form.featured_artist} onChange={e => set('featured_artist', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={s.label}>writer(s) — full legal names *</label>
              <input style={s.input} placeholder="e.g. John Smith, Jane Doe" value={form.writers} onChange={e => set('writers', e.target.value)} required />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={s.label}>songwriter splits <span style={{ color: 'var(--text-muted)' }}>(leave blank if unknown)</span></label>
              <input style={s.input} placeholder="e.g. 50/50 or 70/30 John Smith / Jane Doe" value={form.splits} onChange={e => set('splits', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={s.label}>producer(s) <span style={{ color: 'var(--text-muted)' }}>(leave blank if unknown)</span></label>
              <input style={s.input} placeholder="e.g. Mike Johnson" value={form.producers} onChange={e => set('producers', e.target.value)} />
            </div>
            <div>
              <label style={s.label}>bpm {file && !form.bpm && <span style={{ color: 'var(--bronze)', fontSize: '10px' }}>detecting…</span>}</label>
              <input style={s.input} type="number" value={form.bpm} onChange={e => set('bpm', e.target.value)} placeholder="auto-detected" />
            </div>
            <div>
              <label style={s.label}>key</label>
              <select style={s.input} value={form.track_key} onChange={e => set('track_key', e.target.value)}>
                <option value="">—</option>
                {KEYS.map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>length</label>
              <input style={s.input} placeholder="3:24" value={form.track_length} onChange={e => set('track_length', e.target.value)} />
            </div>
            <div>
              <label style={s.label}>genre</label>
              <select style={s.input} value={form.genre} onChange={e => set('genre', e.target.value)}>
                <option value="">—</option>
                {GENRES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <label style={{ ...s.label, marginTop: '12px' }}>ownership</label>
          <div style={s.toggleRow}>
            {['needs_permission', '100_owned'].map(o => (
              <button key={o} type="button"
                style={{ ...s.toggleBtn, ...(form.ownership === o ? s.toggleBtnActive : {}) }}
                onClick={() => set('ownership', o)}>
                {o === '100_owned' ? '100% owned' : 'needs permission'}
              </button>
            ))}
          </div>

          <label style={{ ...s.label, marginTop: '14px' }}>explicit?</label>
          <div style={s.toggleRow}>
            {[['yes', true], ['no', false]].map(([lbl, val]) => (
              <button key={lbl} type="button"
                style={{ ...s.toggleBtn, ...(form.is_explicit === val ? s.toggleBtnActive : {}) }}
                onClick={() => set('is_explicit', val)}>
                {lbl}
              </button>
            ))}
          </div>

          <label style={{ ...s.label, marginTop: '10px' }}>contact info</label>
          <input style={s.input} placeholder="Who submitted this?" value={form.contact_info} onChange={e => set('contact_info', e.target.value)} />

          <label style={{ ...s.label, marginTop: '10px' }}>notes</label>
          <textarea style={{ ...s.input, minHeight: '60px', resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} />

          {error && <p style={s.error}>{error}</p>}
          <button type="submit" disabled={saving} style={s.submitBtn}>
            {saving ? 'saving...' : isEdit ? 'save changes' : 'add track'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function TrackPool() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [tracks, setTracks]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [genreFilter, setGenreFilter] = useState('all')
  const [showModal, setShowModal]     = useState(false)
  const [editTrack, setEditTrack]     = useState(null)
  const [sending, setSending]           = useState(null)
  const [pipelineConfirm, setPipelineConfirm] = useState(null)
  const [deleting, setDeleting]         = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [playingId, setPlayingId]       = useState(null)
  const isCoordinator = !profile || profile.role === 'coordinator'

  useEffect(() => { fetchTracks() }, [])

  async function fetchTracks() {
    const { data } = await supabase.from('tracks').select('*, releases(id, artwork_url)').order('created_at', { ascending: false })
    setTracks(data ?? [])
    setLoading(false)
  }

  async function sendToPipeline(track) {
    setSending(track.id)
    setPipelineConfirm(null)
    const { error: trackErr } = await supabase.from('tracks').update({ cleared: true }).eq('id', track.id)
    if (trackErr) { setSending(null); return }
    const { data: release } = await supabase.from('releases')
      .insert({ track_id: track.id, stage: 'intake', coordinator_id: profile?.id })
      .select('id').single()
    // Seed checklist items immediately so they're ready when the gate modal opens
    if (release) await seedChecklistForRelease(release.id)
    setSending(null)
    setTracks(prev => prev.map(t => t.id === track.id ? { ...t, cleared: true } : t))
    if (release) navigate(`/pipeline`)
  }

  async function deleteTrack(track) {
    setDeleting(track.id)
    setConfirmDeleteId(null)
    if (playingId === track.id) setPlayingId(null)

    const { data: releases } = await supabase.from('releases').select('id').eq('track_id', track.id)
    const ids = releases?.map(r => r.id) ?? []
    if (ids.length > 0) {
      await supabase.from('performance_data').delete().in('release_id', ids)
      await supabase.from('tease_window_logs').delete().in('release_id', ids)
      await supabase.from('checklist_items').delete().in('release_id', ids)
      await supabase.from('releases').delete().in('id', ids)
    }
    if (track.file_url)         await supabase.storage.from('tracks').remove([track.file_url])
    if (track.instrumental_url) await supabase.storage.from('tracks').remove([track.instrumental_url])
    if (track.tiktok_audio_url) await supabase.storage.from('tracks').remove([track.tiktok_audio_url])
    await supabase.from('tracks').delete().eq('id', track.id)
    setTracks(prev => prev.filter(t => t.id !== track.id))
    setDeleting(null)
  }

  async function download(path) {
    const { data } = await supabase.storage.from('tracks').createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const genres = ['all', ...Array.from(new Set(tracks.map(t => t.genre).filter(Boolean)))]

  const isInPipeline = t => t.cleared || (Array.isArray(t.releases) && t.releases.length > 0)

  const filtered = tracks.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !q || [t.title, t.artist, t.writers, t.genre, t.bpm?.toString(), t.track_key]
      .some(v => v?.toLowerCase().includes(q))
    const matchGenre = genreFilter === 'all' || t.genre === genreFilter
    return matchSearch && matchGenre
  })

  if (loading) return <div style={s.loading}>loading tracks...</div>

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.pageTitle}>TRACK POOL</span>
        <div style={s.headerRight}>
          <input style={s.search} placeholder="search..." value={search} onChange={e => setSearch(e.target.value)} />
          <select style={s.filter} value={genreFilter} onChange={e => setGenreFilter(e.target.value)}>
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          {isCoordinator && (
            <button style={s.addBtn} onClick={() => setShowModal(true)}>+ add track</button>
          )}
        </div>
      </div>

      <div style={s.tableWrap}>
        <div style={s.tableHead}>
          <div style={{ ...s.th, flex: '0 0 50px' }} />
          <div style={{ ...s.th, flex: '2 1 180px' }}>title</div>
          <div style={{ ...s.th, flex: '1 1 110px' }}>artist</div>
          <div style={{ ...s.th, flex: '2 1 160px' }}>writers</div>
          <div style={{ ...s.th, flex: '0 0 110px' }}>ownership</div>
          <div style={{ ...s.th, flex: '0 0 100px' }}>bpm / key</div>
          <div style={{ ...s.th, flex: '0 0 80px' }}>genre</div>
          <div style={{ ...s.th, flex: '0 0 40px' }}>exp</div>
          <div style={{ ...s.th, flex: '0 0 80px' }}>audio</div>
          <div style={{ ...s.th, flex: '0 0 160px' }}>pipeline</div>
          {isCoordinator && <div style={{ ...s.th, flex: '0 0 60px' }} />}
        </div>

        <div style={s.tableBody}>
          {filtered.length === 0 && <div style={s.empty}>no tracks found</div>}

          {/* ── Available tracks ── */}
          {filtered.filter(t => !isInPipeline(t)).length > 0 && (
            <div style={s.sectionLabel}>available — {filtered.filter(t => !isInPipeline(t)).length} track{filtered.filter(t => !isInPipeline(t)).length !== 1 ? 's' : ''}</div>
          )}
          {filtered.filter(t => !isInPipeline(t)).map(track => (
            <div key={track.id} style={{ opacity: deleting === track.id ? 0.4 : 1 }}>
              <div style={s.row}>
                <div style={{ ...s.td, flex: '0 0 50px', justifyContent: 'center' }}>
                  <ArtworkThumb path={track.releases?.find(r => r.artwork_url)?.artwork_url ?? null} />
                </div>
                <div style={{ ...s.td, flex: '2 1 180px', fontWeight: 500 }}>{track.title}</div>
                <div style={{ ...s.td, flex: '1 1 110px', color: track.artist === 'TBC' ? 'var(--text-muted)' : 'var(--text)' }}>
                  {track.artist ?? '—'}
                </div>
                <div style={{ ...s.td, flex: '2 1 160px', color: 'var(--text-muted)', fontSize: '11px' }}>
                  {track.writers ?? '—'}
                </div>
                <div style={{ ...s.td, flex: '0 0 110px' }}>
                  <span style={{
                    fontSize: '10px', padding: '2px 6px', letterSpacing: '0.04em',
                    background: track.ownership === '100_owned' ? '#eaf2e8' : '#f5ede0',
                    color: track.ownership === '100_owned' ? '#4a7a3a' : 'var(--bronze)',
                    border: `1px solid ${track.ownership === '100_owned' ? '#b8d8b0' : 'var(--bronze-dim)'}`,
                  }}>
                    {track.ownership === '100_owned' ? '100% owned' : 'needs perm'}
                  </span>
                </div>
                <div style={{ ...s.td, flex: '0 0 100px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {[track.bpm, track.track_key].filter(Boolean).join(' / ') || '—'}
                </div>
                <div style={{ ...s.td, flex: '0 0 80px', fontSize: '11px' }}>{track.genre ?? '—'}</div>
                <div style={{ ...s.td, flex: '0 0 40px', justifyContent: 'center' }}>
                  {track.is_explicit
                    ? <span style={{ fontSize: '10px', background: '#2a2520', color: '#fff', padding: '1px 5px', letterSpacing: '0.04em' }}>E</span>
                    : <span style={{ fontSize: '10px', color: 'var(--border)' }}>—</span>}
                </div>
                <div style={{ ...s.td, flex: '0 0 80px', gap: '5px' }}>
                  {track.file_url && (
                    <button
                      style={{ ...s.audioBtn, background: playingId === track.id ? 'var(--bronze)' : 'var(--surface-2)', color: playingId === track.id ? '#fff' : 'var(--text-muted)' }}
                      onClick={() => setPlayingId(playingId === track.id ? null : track.id)}
                      title="Play"
                    >
                      {playingId === track.id ? '⏹' : '▶'}
                    </button>
                  )}
                  {track.file_url && (
                    <button style={s.audioBtn} onClick={() => download(track.file_url)} title="Download">↓</button>
                  )}
                </div>
                <div style={{ ...s.td, flex: '0 0 160px', overflow: 'visible' }}>
                  {isInPipeline(track)
                    ? <span style={s.inPipelineTag}>✓ in pipeline</span>
                    : isCoordinator
                      ? <button style={s.pipelineBtn}
                          disabled={sending === track.id}
                          onClick={() => setPipelineConfirm(track)}>
                          {sending === track.id ? '…' : '→ send to pipeline'}
                        </button>
                      : <span style={{ fontSize: '11px', color: 'var(--border)' }}>—</span>
                  }
                </div>
                {isCoordinator && (
                  <div style={{ ...s.td, flex: '0 0 60px', justifyContent: 'center', gap: '4px' }}>
                    {confirmDeleteId === track.id ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button style={{ ...s.actionBtn, background: '#b84040', color: '#fff', border: 'none' }}
                          onClick={() => deleteTrack(track)}>yes</button>
                        <button style={s.actionBtn}
                          onClick={() => setConfirmDeleteId(null)}>no</button>
                      </div>
                    ) : (
                      <>
                        <button style={s.iconBtn} onClick={() => setEditTrack(track)} title="Edit track">✎</button>
                        <button style={s.iconBtn} onClick={() => setConfirmDeleteId(track.id)}
                          disabled={deleting === track.id} title="Delete track">×</button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {playingId === track.id && (
                <div style={s.playerPanel}>
                  <TrackPlayer
                    path={track.file_url}
                    label={track.instrumental_url || track.tiktok_audio_url ? 'Song' : null}
                  />
                  {track.instrumental_url && (
                    <TrackPlayer path={track.instrumental_url} label="Instrumental" />
                  )}
                  {track.tiktok_audio_url && (
                    <TrackPlayer path={track.tiktok_audio_url} label="TikTok" />
                  )}
                </div>
              )}
            </div>
          ))}

          {/* ── In pipeline tracks ── */}
          {filtered.filter(t => isInPipeline(t)).length > 0 && (
            <div style={s.sectionLabel}>in pipeline — {filtered.filter(t => isInPipeline(t)).length} track{filtered.filter(t => isInPipeline(t)).length !== 1 ? 's' : ''}</div>
          )}
          {filtered.filter(t => isInPipeline(t)).map(track => (
            <div key={track.id} style={{ opacity: deleting === track.id ? 0.4 : 0.55 }}>
              <div style={{ ...s.row, background: 'var(--surface)' }}>
                <div style={{ ...s.td, flex: '0 0 50px', justifyContent: 'center' }}>
                  <ArtworkThumb path={track.releases?.find(r => r.artwork_url)?.artwork_url ?? null} />
                </div>
                <div style={{ ...s.td, flex: '2 1 180px', fontWeight: 500 }}>{track.title}</div>
                <div style={{ ...s.td, flex: '1 1 110px', color: 'var(--text-muted)' }}>{track.artist ?? '—'}</div>
                <div style={{ ...s.td, flex: '2 1 160px', color: 'var(--text-muted)', fontSize: '11px' }}>{track.writers ?? '—'}</div>
                <div style={{ ...s.td, flex: '0 0 110px' }}>
                  <span style={{ fontSize: '10px', padding: '2px 6px', letterSpacing: '0.04em',
                    background: track.ownership === '100_owned' ? 'rgba(90,122,74,0.15)' : 'rgba(184,64,64,0.1)',
                    color: track.ownership === '100_owned' ? '#5a7a4a' : '#b84040',
                    border: `1px solid ${track.ownership === '100_owned' ? 'rgba(90,122,74,0.3)' : 'rgba(184,64,64,0.2)'}` }}>
                    {track.ownership === '100_owned' ? '100% owned' : 'needs permission'}
                  </span>
                </div>
                <div style={{ ...s.td, flex: '0 0 100px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {track.bpm ? `${track.bpm} BPM` : '—'}{track.track_key ? ` · ${track.track_key}` : ''}
                </div>
                <div style={{ ...s.td, flex: '0 0 80px', fontSize: '11px' }}>{track.genre ?? '—'}</div>
                <div style={{ ...s.td, flex: '0 0 40px', justifyContent: 'center' }}>
                  {track.is_explicit ? <span style={{ fontSize: '10px', background: '#1a1a1a', color: '#fff', padding: '1px 4px', letterSpacing: '0.04em' }}>E</span> : null}
                </div>
                <div style={{ ...s.td, flex: '0 0 80px', gap: '5px' }}>
                  {track.file_url && <button style={s.audioBtn} onClick={() => setPlayingId(playingId === track.id ? null : track.id)}>{playingId === track.id ? '⏹' : '▶'}</button>}
                </div>
                <div style={{ ...s.td, flex: '0 0 160px', overflow: 'visible' }}>
                  <span style={s.inPipelineTag}>✓ in pipeline</span>
                </div>
                {isCoordinator && (
                  <div style={{ ...s.td, flex: '0 0 60px', justifyContent: 'center', gap: '4px' }}>
                    <button style={s.iconBtn} onClick={() => setEditTrack(track)} title="Edit track">✎</button>
                  </div>
                )}
              </div>
              {playingId === track.id && (
                <div style={s.playerPanel}>
                  <TrackPlayer path={track.file_url} label={track.instrumental_url || track.tiktok_audio_url ? 'Song' : null} />
                  {track.instrumental_url && <TrackPlayer path={track.instrumental_url} label="Instrumental" />}
                  {track.tiktok_audio_url && <TrackPlayer path={track.tiktok_audio_url} label="TikTok" />}
                </div>
              )}
            </div>
          ))}

        </div>
      </div>

      <div style={s.footer}>
        {filtered.filter(t => !isInPipeline(t)).length} available · {filtered.filter(t => isInPipeline(t)).length} in pipeline
      </div>

      {showModal && (
        <TrackFormModal
          onClose={() => setShowModal(false)}
          onSaved={t => setTracks(prev => [t, ...prev])}
        />
      )}

      {editTrack && (
        <TrackFormModal
          initialTrack={editTrack}
          onClose={() => setEditTrack(null)}
          onSaved={updated => {
            setTracks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
            setEditTrack(null)
          }}
        />
      )}

      {pipelineConfirm && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setPipelineConfirm(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '32px', maxWidth: '380px', width: '100%', marginTop: '80px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px', letterSpacing: '0.02em' }}>
              Send to pipeline?
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{pipelineConfirm.title}</span>
              {pipelineConfirm.artist && pipelineConfirm.artist !== 'TBC' ? ` by ${pipelineConfirm.artist}` : ''} will be marked as selected and added to the pipeline.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                style={{ flex: 1, background: 'var(--bronze)', color: '#fff', border: 'none', padding: '10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '0.04em' }}
                onClick={() => sendToPipeline(pipelineConfirm)}>
                Yes, send to pipeline
              </button>
              <button
                style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '10px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}
                onClick={() => setPipelineConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page:        { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', overflow: 'hidden' },
  loading:     { padding: '48px 24px', color: 'var(--text-muted)', fontSize: '12px' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', gap: '12px' },
  pageTitle:   { fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 500 },
  headerRight: { display: 'flex', gap: '8px', alignItems: 'center' },
  search:      { background: 'var(--surface)', border: '1px solid var(--border)', padding: '7px 12px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none', width: '180px' },
  filter:      { background: 'var(--surface)', border: '1px solid var(--border)', padding: '7px 10px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none' },
  addBtn:      { background: 'var(--bronze)', color: '#fff', border: 'none', padding: '7px 14px', fontSize: '12px', letterSpacing: '0.05em', cursor: 'pointer', fontFamily: 'var(--font)' },
  tableWrap:   { flex: 1, overflow: 'auto' },
  tableHead:   { display: 'flex', padding: '0 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 },
  th:          { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', padding: '10px 8px', borderRight: '1px solid var(--border)' },
  tableBody:   { padding: '0 24px' },
  row:         { display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', minHeight: '44px' },
  td:          { fontSize: '12px', color: 'var(--text)', padding: '8px', display: 'flex', alignItems: 'center', overflow: 'hidden' },
  empty:       { padding: '40px 8px', color: 'var(--text-muted)', fontSize: '12px' },
  footer:      { padding: '10px 24px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface)' },
  audioBtn:    { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '3px 7px', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font)' },
  iconBtn:     { background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font)', padding: 0 },
  actionBtn:   { background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '2px 6px', fontSize: '10px', cursor: 'pointer', fontFamily: 'var(--font)' },
  pipelineBtn: { background: 'none', border: '1px solid var(--border)', color: 'var(--bronze)', padding: '4px 8px', fontSize: '10px', letterSpacing: '0.04em', cursor: 'pointer', fontFamily: 'var(--font)', whiteSpace: 'nowrap' },
  inPipelineTag: { fontSize: '10px', letterSpacing: '0.04em', color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '2px 6px', whiteSpace: 'nowrap' },
  sectionLabel:  { fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '10px 24px 6px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontWeight: 500 },
  playerPanel: { borderBottom: '1px solid var(--border)', background: '#faf8f5' },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(42,37,32,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 200, overflowY: 'auto', padding: '40px 24px' },
  modal:       { background: 'var(--surface)', border: '1px solid var(--border)', width: '100%', maxWidth: '520px', padding: '32px' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' },
  modalTitle:  { fontSize: '12px', letterSpacing: '0.08em', fontWeight: 500 },
  closeBtn:    { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', padding: 0 },
  modalForm:   { display: 'flex', flexDirection: 'column', gap: '4px' },
  formGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  label:       { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em', marginTop: '8px', display: 'block' },
  input:       { background: 'var(--bg)', border: '1px solid var(--border)', padding: '8px 10px', color: 'var(--text)', outline: 'none', width: '100%', fontFamily: 'var(--font)', fontSize: '12px' },
  toggleRow:   { display: 'flex', gap: '6px', marginTop: '4px' },
  toggleBtn:   { background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '6px 12px', fontSize: '11px', letterSpacing: '0.04em', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' },
  toggleBtnActive: { background: 'var(--bronze)', color: '#fff', borderColor: 'var(--bronze)' },
  fileBtn:     { background: 'var(--bg)', border: '1px dashed var(--border)', padding: '10px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', display: 'block', marginTop: '4px', textAlign: 'center', fontFamily: 'var(--font)' },
  error:       { fontSize: '11px', color: '#b84040', marginTop: '6px' },
  submitBtn:   { marginTop: '20px', background: 'var(--bronze)', color: '#fff', border: 'none', padding: '11px', letterSpacing: '0.06em', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)' },
}
