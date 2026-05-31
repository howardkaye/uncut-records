import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import TeaseReportForm from '../components/TeaseReportForm'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import JSZip from 'jszip'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import { DISTRIBUTION_ITEMS, RELEASE_ITEMS, seedChecklistForRelease } from '../lib/seedChecklist'

const STAGES = [
  { key: 'intake',       label: 'Selected' },
  { key: 'pre_release',  label: 'Preparing' },
  { key: 'tease_window', label: 'In Market' },
  { key: 'reporting',    label: 'Reporting' },
]

// § prefix = section header
const GENRES = [
  'Hip-Hop / Rap', 'R&B / Soul', 'Pop', 'Dance / Electronic', 'Afrobeats',
  'Latin', 'Rock', 'Alternative', 'Indie', 'Country', 'Gospel / Christian',
  'Jazz', 'Classical', 'Reggae / Dancehall', 'Funk / Soul', 'Metal',
  'Folk / Singer-Songwriter', 'N/A',
]

// Lookup placeholder / accept / options by label (DISTRIBUTION_ITEMS + RELEASE_ITEMS imported from seedChecklist)
const ITEM_META = {}
;[...DISTRIBUTION_ITEMS, ...RELEASE_ITEMS].forEach(item => {
  if (item.placeholder || item.accept || item.options) {
    ITEM_META[item.label] = { placeholder: item.placeholder, accept: item.accept, options: item.options }
  }
})

// ─────────────────────────────────────────────
// TextValueCell
// ─────────────────────────────────────────────
function TextValueCell({ value, placeholder, onSave }) {
  const [draft, setDraft] = useState(value ?? '')
  const [editing, setEditing] = useState(false)

  useEffect(() => { setDraft(value ?? '') }, [value])

  if (value && !editing) {
    return (
      <div style={s.valueDisplay}>
        <span style={{ flex: 1, fontSize: '11px', color: 'var(--bronze)' }}>{value}</span>
        <button style={s.editValueBtn} onClick={() => setEditing(true)}>edit</button>
      </div>
    )
  }

  return (
    <input
      style={s.valueInput}
      value={draft}
      placeholder={placeholder ?? 'enter value…'}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onSave(draft.trim()); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
      autoFocus={editing}
    />
  )
}

// ─────────────────────────────────────────────
// SelectValueCell
// ─────────────────────────────────────────────
function SelectValueCell({ value, options, onSave }) {
  const isBinary = options.length <= 3

  if (isBinary) {
    return (
      <div style={{ display: 'flex', gap: '6px', marginTop: '5px' }}>
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onSave(value === opt ? null : opt)}
            style={{
              padding: '3px 12px', fontSize: '11px', fontFamily: 'var(--font)',
              letterSpacing: '0.04em', cursor: 'pointer', border: '1px solid',
              background: value === opt ? 'var(--bronze)' : 'var(--surface-2)',
              color: value === opt ? '#fff' : 'var(--text-muted)',
              borderColor: value === opt ? 'var(--bronze)' : 'var(--border)',
            }}>
            {opt}
          </button>
        ))}
      </div>
    )
  }

  return (
    <select
      value={value ?? ''}
      onChange={e => onSave(e.target.value || null)}
      style={{ ...s.valueInput, marginTop: '5px', cursor: 'pointer' }}>
      <option value="">select…</option>
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  )
}

// ─────────────────────────────────────────────
// FileValueCell
// ─────────────────────────────────────────────
function FileValueCell({ item, releaseId, accept, isCoordinator, onUploaded }) {
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `releases/${releaseId}/checklist/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('tracks').upload(path, file, { contentType: file.type })
    if (!error) {
      onUploaded(path)
      // If this is the cover artwork, also store on the release so it can show in the track pool
      if (item.label.toLowerCase().includes('cover artwork')) {
        await supabase.from('releases').update({ artwork_url: path, updated_at: new Date().toISOString() }).eq('id', releaseId)
      }
    }
    setUploading(false)
  }

  async function handleDownload() {
    const { data } = await supabase.storage.from('tracks').createSignedUrl(item.file_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (item.file_path) {
    const filename = item.file_path.split('/').pop().replace(/^[a-f0-9-]{36}\./, 'file.')
    return (
      <div style={s.valueDisplay}>
        <button style={s.fileDownloadBtn} onClick={handleDownload}>↓ {filename}</button>
        {isCoordinator && (
          <label style={s.fileReplaceBtn}>
            <input type="file" accept={accept} style={{ display: 'none' }} onChange={handleUpload} />
            replace
          </label>
        )}
      </div>
    )
  }

  if (!isCoordinator) {
    return <div style={{ fontSize: '11px', color: 'var(--border)', marginTop: '3px' }}>no file uploaded</div>
  }

  return (
    <label style={s.fileUploadBtn}>
      <input type="file" accept={accept} style={{ display: 'none' }} onChange={handleUpload} />
      {uploading ? 'uploading…' : '+ upload file'}
    </label>
  )
}

// ─────────────────────────────────────────────
// ChecklistSection
// ─────────────────────────────────────────────
function ChecklistSection({ releaseId, checklist, label, isCoordinator }) {
  const { profile } = useAuth()
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [newLabel, setNewLabel] = useState('')

  useEffect(() => { fetchItems() }, [releaseId, checklist])

  async function fetchItems() {
    const { data, error } = await supabase
      .from('checklist_items').select('*')
      .eq('release_id', releaseId).eq('checklist', checklist)
      .order('position')

    if (error) console.error('fetchItems error:', error)

    if (!data || data.length === 0) {
      // No items yet — seed then refetch
      const { data: inserted, error: seedErr } = await supabase
        .from('checklist_items')
        .insert(
          (checklist === 'pre_release' ? DISTRIBUTION_ITEMS : RELEASE_ITEMS).map((item, i) => ({
            release_id: releaseId,
            checklist,
            label: item.label,
            field_type: item.type === 'header' ? 'check' : (item.type || 'check'),
            position: i,
          }))
        )
        .select()
      if (seedErr) {
        console.error('Seed insert error:', seedErr)
        setItems([])
      } else {
        setItems(inserted ?? [])
      }
    } else {
      setItems(data)
    }
    setLoading(false)
  }

  async function updateItem(itemId, updates) {
    if ('completed' in updates) {
      const now = new Date().toISOString()
      updates.completed_at  = updates.completed ? now  : null
      updates.completed_by  = updates.completed ? (profile?.id ?? null) : null
    }
    const { error } = await supabase.from('checklist_items').update(updates).eq('id', itemId)
    if (!error) setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i))
  }

  async function addItem(e) {
    e.preventDefault()
    if (!newLabel.trim()) return
    const { data, error } = await supabase
      .from('checklist_items')
      .insert({ release_id: releaseId, checklist, label: newLabel.trim(), position: items.length, field_type: 'check' })
      .select().single()
    if (!error) { setItems(prev => [...prev, data]); setNewLabel('') }
  }

  const checkable = items.filter(i => !i.label.startsWith('§') && !i.not_required)
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

      {loading ? <div style={s.loadingItems}>loading…</div> : (
        <div style={s.checkList}>
          {items.map(item => {
            const isHeader = item.label.startsWith('§')
            if (isHeader) return (
              <div key={item.id} style={s.checkSection}>
                {item.label.replace('§ ', '')}
              </div>
            )

            if (item.not_required) return (
              <div key={item.id} style={{ ...s.checkRow, opacity: 0.45 }}>
                <span style={s.naTag}>N/A</span>
                <span style={{ ...s.checkLabel, flex: 1, textDecoration: 'line-through' }}>
                  {item.label}
                </span>
                {isCoordinator && (
                  <button style={s.naUndoBtn}
                    onClick={() => updateItem(item.id, { not_required: false })}>
                    undo
                  </button>
                )}
              </div>
            )

            const meta = ITEM_META[item.label] ?? {}
            const fieldType = item.field_type ?? 'check'

            return (
              <div key={item.id} style={{ ...s.checkRow, alignItems: 'flex-start', gap: '10px' }}>
                <input type="checkbox"
                  checked={item.completed ?? false}
                  onChange={() => updateItem(item.id, { completed: !item.completed })}
                  style={{ ...s.checkbox, marginTop: '3px', flexShrink: 0 }}
                  disabled={!isCoordinator}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...s.checkLabel, ...(item.completed ? s.checkDone : {}) }}>
                    {item.label}
                  </div>

                  {fieldType === 'text' && isCoordinator && (
                    <TextValueCell
                      value={item.field_value}
                      placeholder={meta.placeholder}
                      onSave={val => updateItem(item.id, {
                        field_value: val || null,
                        ...(val ? { completed: true } : {}),
                      })}
                    />
                  )}
                  {fieldType === 'text' && !isCoordinator && item.field_value && (
                    <div style={{ fontSize: '11px', color: 'var(--bronze)', marginTop: '3px' }}>
                      {item.field_value}
                    </div>
                  )}

                  {fieldType === 'select' && isCoordinator && (
                    <SelectValueCell
                      value={item.field_value}
                      options={meta.options ?? []}
                      onSave={val => updateItem(item.id, {
                        field_value: val || null,
                        ...(val ? { completed: true } : { completed: false }),
                      })}
                    />
                  )}
                  {fieldType === 'select' && !isCoordinator && item.field_value && (
                    <div style={{ fontSize: '11px', color: 'var(--bronze)', marginTop: '3px' }}>
                      {item.field_value}
                    </div>
                  )}

                  {fieldType === 'file' && (
                    <FileValueCell
                      item={item}
                      releaseId={releaseId}
                      accept={meta.accept}
                      isCoordinator={isCoordinator}
                      onUploaded={path => updateItem(item.id, { file_path: path, completed: true })}
                    />
                  )}
                </div>

                {isCoordinator && (
                  <button style={s.naBtn}
                    onClick={() => updateItem(item.id, { not_required: true, completed: false, field_value: null })}>
                    N/A
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {isCoordinator && (
        <form onSubmit={addItem} style={s.addRow}>
          <input style={s.addInput} placeholder="add custom item…"
            value={newLabel} onChange={e => setNewLabel(e.target.value)} />
          <button type="submit" style={s.addItemBtn} disabled={!newLabel.trim()}>+</button>
        </form>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Release Pack helpers
// ─────────────────────────────────────────────
function getFileFolder(label) {
  const l = label.toLowerCase()
  if (l.includes('artwork') || l.includes('cover') || l.includes('social') || l.includes('9:16') || l.includes('square') || l.includes('vertical')) return 'artwork'
  if (l.includes('master') || l.includes('audio') || l.includes('wav') || l.includes('delivered (wav')) return 'audio'
  if (l.includes('agreement') || l.includes('clearance') || l.includes('egnyte')) return 'legal'
  return 'files'
}

function getCleanFilename(label, filePath) {
  const ext = filePath.split('.').pop().toLowerCase()
  const clean = label
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 50)
  return `${clean}.${ext}`
}

function buildWordDoc(release, preItems, postItems, stageName) {
  const track = release.track ?? {}

  const h = (text) => new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, size: 28, font: 'Arial' })],
    spacing: { before: 320, after: 120 },
  })

  const h2 = (text) => new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 20, font: 'Arial', color: '8B6340' })],
    spacing: { before: 240, after: 80 },
  })

  const row = (label, value) => new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20, font: 'Arial' }),
      new TextRun({ text: String(value ?? '—'), size: 20, font: 'Arial' }),
    ],
    spacing: { before: 40, after: 40 },
  })

  const divider = () => new Paragraph({
    children: [new TextRun({ text: '─'.repeat(60), size: 18, color: 'CCCCCC', font: 'Arial' })],
    spacing: { before: 120, after: 120 },
  })

  const blank = () => new Paragraph({ children: [new TextRun('')] })

  // Build checklist paragraphs
  function checklistParagraphs(items) {
    const paras = []
    items.forEach(item => {
      if (item.label.startsWith('§')) {
        paras.push(h2(item.label.replace('§ ', '')))
        return
      }
      const status = item.not_required ? 'N/A' : item.completed ? ' ✓ ' : '   '
      const children = [
        new TextRun({ text: `${status}  `, bold: item.completed, size: 20, font: 'Arial', color: item.completed ? '5a7a4a' : item.not_required ? 'AAAAAA' : '333333' }),
        new TextRun({ text: item.label, size: 20, font: 'Arial', color: item.not_required ? 'AAAAAA' : '333333' }),
      ]
      if (item.field_value) {
        children.push(new TextRun({ text: `  →  ${item.field_value}`, bold: true, size: 20, font: 'Arial', color: '8B6340' }))
      }
      if (item.file_path) {
        const folder = getFileFolder(item.label)
        children.push(new TextRun({ text: `  →  see ${folder}/ folder`, italics: true, size: 20, font: 'Arial', color: '888888' }))
      }
      paras.push(new Paragraph({ children, spacing: { before: 40, after: 40 } }))
    })
    return paras
  }

  const releaseDate = release.release_date
    ? new Date(release.release_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'TBC'

  const children = [
    new Paragraph({
      children: [new TextRun({ text: 'UNCUT RECORDS', bold: true, size: 18, font: 'Arial', color: '8B6340', allCaps: true })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `${track.title ?? '—'}`, bold: true, size: 48, font: 'Arial' })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: track.artist ?? '—', size: 28, font: 'Arial', color: '666666' })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Release Pack · Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, size: 18, font: 'Arial', color: 'AAAAAA' })],
      spacing: { after: 200 },
    }),
    divider(),

    h('Track Details'),
    ...[
      ['Stage',     stageName],
      ['Release Date', releaseDate],
      ['Writers',   track.writers],
      ['Producers', track.producers],
      ['BPM',       track.bpm],
      ['Key',       track.track_key],
      ['Genre',     track.genre],
      ['Explicit',  track.is_explicit != null ? (track.is_explicit ? 'Yes' : 'No') : null],
      ['Ownership', track.ownership === '100_owned' ? '100% Owned' : track.ownership === 'needs_permission' ? 'Needs Permission' : null],
    ].filter(([, v]) => v != null && v !== '').map(([k, v]) => row(k, v)),

    ...(release.notes ? [blank(), row('Notes', release.notes)] : []),

    divider(),
    h('Distribution Checklist'),
    ...checklistParagraphs(preItems),

    divider(),
    h('Marketing Checklist'),
    ...checklistParagraphs(postItems),

    divider(),
    new Paragraph({
      children: [new TextRun({ text: `Uncut Records · Confidential · ${new Date().getFullYear()}`, size: 16, font: 'Arial', color: 'AAAAAA' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
    }),
  ]

  return new Document({
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
      },
      children,
    }]
  })
}

// ─────────────────────────────────────────────
// Release Pack component
// ─────────────────────────────────────────────
function ReleasePack({ release }) {
  const [preItems,  setPreItems]  = useState([])
  const [postItems, setPostItems] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress]   = useState('')

  useEffect(() => {
    async function load() {
      const [pre, post] = await Promise.all([
        supabase.from('checklist_items').select('*')
          .eq('release_id', release.id).eq('checklist', 'pre_release').order('position'),
        supabase.from('checklist_items').select('*')
          .eq('release_id', release.id).eq('checklist', 'post_release').order('position'),
      ])
      setPreItems(pre.data ?? [])
      setPostItems(post.data ?? [])
      setLoading(false)
    }
    load()
  }, [release.id])

  async function handleDownload() {
    setDownloading(true)
    const trackTitle = release.track?.title ?? 'Release'
    const stageName  = STAGES.find(st => st.key === release.stage)?.label ?? ''

    try {
      setProgress('Building Word document…')
      const doc = buildWordDoc(release, preItems, postItems, stageName)
      const docBlob = await Packer.toBlob(doc)

      setProgress('Creating ZIP…')
      const zip = new JSZip()
      zip.file('Release Pack.docx', docBlob)

      // Fetch and organise uploaded files
      const allItems = [...preItems, ...postItems].filter(i => i.file_path && !i.not_required)
      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i]
        setProgress(`Downloading files… (${i + 1}/${allItems.length})`)
        const { data } = await supabase.storage.from('tracks').createSignedUrl(item.file_path, 300)
        if (data?.signedUrl) {
          try {
            const resp = await fetch(data.signedUrl)
            const blob = await resp.blob()
            const folder   = getFileFolder(item.label)
            const filename = getCleanFilename(item.label, item.file_path)
            zip.folder(folder).file(filename, blob)
          } catch (_) { /* skip files that can't be fetched */ }
        }
      }

      setProgress('Compressing…')
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${trackTitle} - Release Pack.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Release pack error:', err)
    }

    setDownloading(false)
    setProgress('')
  }

  if (loading) return <div style={s.loading}>loading release pack…</div>

  const track = release.track ?? {}
  const fileItems = [...preItems, ...postItems].filter(i => i.file_path && !i.not_required)
  const textItems = [...preItems, ...postItems].filter(i => i.field_value && !i.not_required)

  return (
    <div style={pk.page}>
      <div style={pk.toolbar}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' }}>
            {track.title ?? '—'} — Release Pack
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {fileItems.length} file{fileItems.length !== 1 ? 's' : ''} · {textItems.length} text value{textItems.length !== 1 ? 's' : ''} · Word doc included
          </div>
        </div>
        <button style={{ ...pk.downloadBtn, opacity: downloading ? 0.7 : 1 }}
          onClick={handleDownload} disabled={downloading}>
          {downloading ? progress || 'preparing…' : '↓ Download ZIP'}
        </button>
      </div>

      <div style={pk.doc}>
        {/* ZIP contents preview */}
        <div style={pk.previewSection}>
          <div style={pk.previewTitle}>What's included in the ZIP</div>

          <div style={pk.fileTree}>
            <div style={pk.treeItem}>
              <span style={pk.treeIcon}>📄</span>
              <span style={pk.treeName}>Release Pack.docx</span>
              <span style={pk.treeDesc}>Track details, ISRC, splits, all text data, checklist status</span>
            </div>

            {['audio', 'artwork', 'legal', 'files'].map(folder => {
              const folderItems = fileItems.filter(i => getFileFolder(i.label) === folder)
              if (folderItems.length === 0) return null
              return (
                <div key={folder}>
                  <div style={pk.treeFolder}>
                    <span style={pk.treeIcon}>📁</span>
                    <span style={{ ...pk.treeName, fontWeight: 500 }}>{folder}/</span>
                  </div>
                  {folderItems.map(item => (
                    <div key={item.id} style={{ ...pk.treeItem, paddingLeft: '40px' }}>
                      <span style={pk.treeIcon}>📎</span>
                      <span style={pk.treeName}>{getCleanFilename(item.label, item.file_path)}</span>
                    </div>
                  ))}
                </div>
              )
            })}

            {fileItems.length === 0 && (
              <div style={{ ...pk.treeItem, color: 'var(--text-muted)' }}>
                <span style={pk.treeIcon}>—</span>
                <span>No files uploaded yet. Upload files via the checklist to include them here.</span>
              </div>
            )}
          </div>
        </div>

        {/* Text values preview */}
        {textItems.length > 0 && (
          <div style={pk.previewSection}>
            <div style={pk.previewTitle}>Text values in the Word doc</div>
            <div style={pk.valueList}>
              {textItems.map(item => (
                <div key={item.id} style={pk.valueRow}>
                  <span style={pk.valueLabel}>{item.label}</span>
                  <span style={pk.valueVal}>{item.field_value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Tease Window Log
// ─────────────────────────────────────────────
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
          <textarea style={s.logInput} placeholder="log an update…" value={content}
            onChange={e => setContent(e.target.value)} rows={2} />
          <button type="submit" style={s.logSubmit} disabled={saving || !content.trim()}>
            {saving ? 'logging…' : 'add entry'}
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


// ─────────────────────────────────────────────
// Assets Panel
// ─────────────────────────────────────────────
function AssetsPanel({ release, isCoordinator }) {
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
  }

  async function download(path) {
    const { data, error } = await supabase.storage.from('tracks').createSignedUrl(path, 3600)
    if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const assets = [
    { key: 'track',      label: 'Track file', path: release.track?.file_url,  field: null },
    { key: 'artwork_url', label: 'Artwork',    path: localRelease.artwork_url, field: 'artwork_url', folder: 'artwork', accept: '.jpg,.jpeg,.png' },
    { key: 'lyrics_url',  label: 'Lyrics',     path: localRelease.lyrics_url,  field: 'lyrics_url',  folder: 'lyrics',  accept: '.pdf,.txt,.docx' },
  ]

  return (
    <div style={s.metaCard}>
      <div style={{ ...s.metaKey, marginBottom: '12px' }}>ASSETS</div>
      {assets.map(asset => (
        <div key={asset.key} style={s.assetRow}>
          <span style={s.assetLabel}>{asset.label}</span>
          {asset.path ? (
            <button style={s.assetDownload} onClick={() => download(asset.path)}>↓ download</button>
          ) : isCoordinator && asset.field ? (
            <label style={s.assetUpload}>
              <input type="file" accept={asset.accept} style={{ display: 'none' }}
                onChange={e => { const f = e.target.files[0]; if (f) uploadAsset(f, asset.field, asset.folder) }} />
              {uploading === asset.field ? 'uploading…' : '+ upload'}
            </label>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--border)' }}>not uploaded</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Performance Tab
// ─────────────────────────────────────────────
const PLATFORMS = ['Spotify','Apple Music','YouTube Music','Amazon Music','Deezer','TikTok','Other']

function PerformanceTab({ releaseId, isCoordinator }) {
  const { profile } = useAuth()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({
    report_date: new Date().toISOString().slice(0, 10),
    streams: '', tiktok_uses: '', tiktok_views: '', notes: '',
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
      release_id: releaseId, report_date: form.report_date, platform: 'TikTok',
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
  const totalTopViews = rows.reduce((a, r) => a + (r.streams || 0), 0)
  const totalUses     = rows.reduce((a, r) => a + (r.tiktok_uses || 0), 0)
  const totalViews    = rows.reduce((a, r) => a + (r.tiktok_views || 0), 0)

  return (
    <>
      <div style={{ display: 'flex', gap: '12px' }}>
        {[['Sound Uses', fmt(totalUses)], ['Sound Views', fmt(totalViews)], ['Top Video Views', fmt(totalTopViews)]].map(([label, value]) => (
          <div key={label} style={s.statCard}>
            <div style={s.statValue}>{value}</div>
            <div style={s.statLabel}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'contents' }}>
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionTitle}>Performance Log</span>
            <span style={s.progress}>{rows.length} entries</span>
          </div>
          {loading ? <div style={s.loadingItems}>loading…</div> : rows.length === 0
            ? <div style={s.loadingItems}>no data yet</div>
            : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['date','sound uses','sound views','top vid views','notes'].map(h => (
                  <th key={h} style={{ ...s.th, position: 'static' }}>{h}</th>
                ))}</tr></thead>
                <tbody>{rows.map((row, i) => (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)' }}>
                    <td style={s.td}>{new Date(row.report_date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' })}</td>
                    <td style={s.td}>{row.tiktok_uses?.toLocaleString() ?? '—'}</td>
                    <td style={s.td}>{row.tiktok_views?.toLocaleString() ?? '—'}</td>
                    <td style={s.td}>{row.streams?.toLocaleString() ?? '—'}</td>
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
                  { label: 'sound uses', type: 'number', key: 'tiktok_uses', placeholder: '0' },
                  { label: 'sound views', type: 'number', key: 'tiktok_views', placeholder: '0' },
                  { label: 'top video views', type: 'number', key: 'streams', placeholder: '0' },
                ].map(f => (
                  <div key={f.key}>
                    <div style={s.metaKey}>{f.label}</div>
                    <input style={s.metaInput} type={f.type} placeholder={f.placeholder}
                      value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={s.metaKey}>notes</div>
                  <input style={s.metaInput} placeholder="e.g. UGC spike, viral video…"
                    value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
              {error && <p style={{ fontSize: '11px', color: '#b84040', marginTop: '8px' }}>{error}</p>}
              <button type="submit" disabled={saving}
                style={{ ...s.stageBtn, ...s.stageBtnAdvance, marginTop: '14px', border: 'none' }}>
                {saving ? 'saving…' : 'save entry'}
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────
// Content Creator Brief (shown in Preparing stage)
// ─────────────────────────────────────────────
function ContentCreatorBrief({ release }) {
  const [email, setEmail]   = useState('')
  const [sending, setSending] = useState(false)

  const track = release.track ?? {}

  async function handleSend() {
    if (!email.trim()) return
    setSending(true)

    let trackLine = ''
    if (track.file_url) {
      const { data } = await supabase.storage.from('tracks').createSignedUrl(track.file_url, 60 * 60 * 24 * 7)
      if (data?.signedUrl) trackLine = `\nTrack download (7-day link):\n${data.signedUrl}`
    }

    let artworkLine = ''
    if (release.artwork_url) {
      const { data } = await supabase.storage.from('tracks').createSignedUrl(release.artwork_url, 60 * 60 * 24 * 7)
      if (data?.signedUrl) artworkLine = `\nArtwork (7-day link):\n${data.signedUrl}`
    }

    const subject = encodeURIComponent(`Brief: ${track.title ?? 'Track'} — ${track.artist ?? 'Artist'}`)
    const body = encodeURIComponent(
      `Hi,\n\nHere are the details for the upcoming track:\n\n` +
      `Track: ${track.title ?? '—'}\n` +
      `Artist: ${track.artist ?? '—'}\n` +
      (track.bpm       ? `BPM: ${track.bpm}\n`       : '') +
      (track.track_key ? `Key: ${track.track_key}\n` : '') +
      `${trackLine}${artworkLine}\n\n` +
      `Let me know if you need anything else.\n\nUncut Records`
    )

    window.location.href = `mailto:${encodeURIComponent(email.trim())}?subject=${subject}&body=${body}`
    setSending(false)
  }

  return (
    <div style={{ ...s.section, borderColor: 'var(--bronze-dim)', background: '#fdf8f2' }}>
      <div style={s.sectionHeader}>
        <span style={{ ...s.sectionTitle, color: 'var(--bronze)' }}>Send to Content Creator</span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.6 }}>
        Send the track name, artist, audio file, and artwork to your content creator so they can prepare for In Market. Email opens in your mail app — edit before sending.
      </p>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          style={{ ...s.addInput, flex: 1 }}
          type="email"
          placeholder="content creator email…"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
        />
        <button
          style={{ background: 'var(--bronze)', color: '#fff', border: 'none', padding: '8px 16px', fontSize: '11px', letterSpacing: '0.06em', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0, opacity: !email.trim() ? 0.5 : 1 }}
          onClick={handleSend}
          disabled={!email.trim() || sending}>
          {sending ? 'opening…' : '↗ send brief'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Release Confirm Flow (shown in In Market stage)
// ─────────────────────────────────────────────
function ReleaseConfirmFlow({ release, onDecision }) {
  const [decisionChecked, setDecisionChecked] = useState(false)
  const [downloaded,      setDownloaded]      = useState(false)
  const [downloading,     setDownloading]     = useState(false)
  const [dlProgress,      setDlProgress]      = useState('')
  const [confirmingRelease, setConfirmingRelease] = useState(false)
  const [confirmingReturn,  setConfirmingReturn]  = useState(false)
  const [preItems,  setPreItems]  = useState([])
  const [postItems, setPostItems] = useState([])

  useEffect(() => {
    if (!decisionChecked) return
    Promise.all([
      supabase.from('checklist_items').select('*').eq('release_id', release.id).eq('checklist', 'pre_release').order('position'),
      supabase.from('checklist_items').select('*').eq('release_id', release.id).eq('checklist', 'post_release').order('position'),
    ]).then(([pre, post]) => {
      setPreItems(pre.data ?? [])
      setPostItems(post.data ?? [])
    })
  }, [decisionChecked, release.id])

  if (release.friday_decision) {
    return (
      <div style={{ ...s.section, borderColor: release.friday_decision === 'release' ? '#a8c898' : 'var(--border)' }}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Release Confirmation</span>
          <span style={{ fontSize: '11px', padding: '2px 8px', border: '1px solid',
            color: release.friday_decision === 'release' ? '#5a7a4a' : 'var(--text-muted)',
            borderColor: release.friday_decision === 'release' ? '#a8c898' : 'var(--border)',
            background: release.friday_decision === 'release' ? '#f0f5ec' : 'var(--surface-2)',
          }}>
            {release.friday_decision === 'release' ? '✓ released' : '✕ returned to pool'}
          </span>
        </div>
      </div>
    )
  }

  async function handleExport() {
    setDownloading(true)
    const trackTitle = release.track?.title ?? 'Release'
    const stageName  = STAGES.find(st => st.key === release.stage)?.label ?? ''
    try {
      setDlProgress('Building document…')
      const doc = buildWordDoc(release, preItems, postItems, stageName)
      const docBlob = await Packer.toBlob(doc)
      setDlProgress('Creating ZIP…')
      const zip = new JSZip()
      zip.file('Release Pack.docx', docBlob)
      const allItems = [...preItems, ...postItems].filter(i => i.file_path && !i.not_required)
      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i]
        setDlProgress(`Files… (${i + 1}/${allItems.length})`)
        const { data } = await supabase.storage.from('tracks').createSignedUrl(item.file_path, 300)
        if (data?.signedUrl) {
          try {
            const blob = await (await fetch(data.signedUrl)).blob()
            zip.folder(getFileFolder(item.label)).file(getCleanFilename(item.label, item.file_path), blob)
          } catch (_) {}
        }
      }
      setDlProgress('Compressing…')
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a'); a.href = url
      a.download = `${trackTitle} - Co-Brand Pack.zip`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setDownloaded(true)
    } catch (err) { console.error(err) }
    setDownloading(false); setDlProgress('')
  }

  return (
    <div style={{ ...s.section, borderColor: 'var(--bronze-dim)', background: '#fdf8f2' }}>
      <div style={s.sectionHeader}>
        <span style={{ ...s.sectionTitle, color: 'var(--bronze)' }}>Release Confirmation</span>
      </div>

      {/* Step 1 */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: '16px' }}>
        <input type="checkbox" checked={decisionChecked} onChange={() => setDecisionChecked(p => !p)}
          style={{ accentColor: 'var(--bronze)', marginTop: '2px', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.4, fontWeight: 500 }}>
          Release decision made — track is getting traction
        </span>
      </label>

      {/* Step 2 */}
      {decisionChecked && (
        <div style={{ marginBottom: '16px', paddingLeft: '22px', borderLeft: '2px solid var(--bronze-dim)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.5 }}>
            Export the full release pack — Word doc + all files — ready to submit to the Co-Brand portal.
          </div>
          <button
            style={{ background: downloaded ? 'var(--surface-2)' : 'var(--bronze)', color: downloaded ? 'var(--text-muted)' : '#fff', border: downloaded ? '1px solid var(--border)' : 'none', padding: '9px 16px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '0.04em', opacity: downloading ? 0.7 : 1 }}
            onClick={handleExport} disabled={downloading}>
            {downloading ? (dlProgress || 'preparing…') : downloaded ? '↓ Re-export Co-Brand Pack' : '↓ Export Co-Brand Release Pack'}
          </button>
        </div>
      )}

      {/* Step 3 */}
      {downloaded && (
        <div style={{ paddingLeft: '22px', borderLeft: '2px solid #a8c898' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
            Submit the pack to Co-Brand, then confirm below. The release moves straight to Reporting.
          </div>
          {!confirmingRelease ? (
            <button style={{ background: '#5a7a4a', color: '#fff', border: 'none', padding: '10px 20px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '0.04em' }}
              onClick={() => setConfirmingRelease(true)}>
              Confirm release →
            </button>
          ) : (
            <div style={{ padding: '12px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '12px', marginBottom: '10px', color: 'var(--text)', lineHeight: 1.5 }}>
                Co-Brand pack submitted and ready. Track will move straight to Reporting.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ background: 'var(--bronze)', color: '#fff', border: 'none', padding: '9px 16px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)' }}
                  onClick={() => onDecision('release')}>Confirm</button>
                <button style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '9px 14px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)' }}
                  onClick={() => setConfirmingRelease(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Return to pool */}
      <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
        {!confirmingReturn ? (
          <button style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font)', padding: 0 }}
            onClick={() => setConfirmingReturn(true)}>
            No traction — return track to pool
          </button>
        ) : (
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.5 }}>
              Track returns to the uncleared pool. This cannot be undone easily.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ background: '#b84040', color: '#fff', border: 'none', padding: '6px 12px', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font)' }}
                onClick={() => onDecision('return_to_pool')}>return to pool</button>
              <button style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '6px 12px', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font)' }}
                onClick={() => setConfirmingReturn(false)}>cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// nextMonday helper
// ─────────────────────────────────────────────
function nextMonday() {
  const d = new Date()
  const day = d.getDay()
  const add = day === 1 ? 0 : day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + add)
  return d.toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────
// Main ReleaseDetail
// ─────────────────────────────────────────────
export default function ReleaseDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [release, setRelease] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPrepareConfirm, setShowPrepareConfirm] = useState(false)
  const isCoordinator = !profile || profile.role === 'coordinator'
  const isContent     = profile?.role === 'content'

  useEffect(() => { fetchRelease() }, [id])

  async function fetchRelease() {
    const { data } = await supabase
      .from('releases').select('*, track:tracks(*)')
      .eq('id', id).single()
    if (data) setRelease(data)
    setLoading(false)
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
      updates.stage = 'reporting' // Skip Released — Co-Brand handles distribution, go straight to Reporting
    } else {
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

  if (loading) return <div style={s.loading}>loading release…</div>
  if (!release) return <div style={s.loading}>release not found</div>

  // ── Content role: simplified form-only view ──
  if (isContent) {
    if (release.stage !== 'tease_window') return <Navigate to="/" replace />
    const track = release.track ?? {}
    return (
      <div style={{ minHeight: 'calc(100vh - 60px)', background: '#fff' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Tease Window Report</div>
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--green)' }}>
            {track.title ?? '—'}{track.artist && track.artist !== 'TBC' ? ` · ${track.artist}` : ''}
          </div>
        </div>
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 24px' }}>
          <TeaseReportForm release={release} onSubmitted={() => {}} />
        </div>
      </div>
    )
  }

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
              onClick={() => {
                if (release.stage === 'intake') { setShowPrepareConfirm(true) }
                else { moveStage(STAGES[stageIdx + 1].key) }
              }}>
              Move to {STAGES[stageIdx + 1].label} →
            </button>
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

      {showPrepareConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(42,37,32,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
          onClick={e => e.target === e.currentTarget && setShowPrepareConfirm(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '32px', maxWidth: '380px', width: '90%' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>Start preparing this release?</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
              Moving <span style={{ color: 'var(--text)', fontWeight: 500 }}>{release.track?.title ?? 'this track'}</span> to <strong>Preparing</strong> means active work begins — distribution checklist, artwork, rights. Ready to go?
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                style={{ flex: 1, background: 'var(--bronze)', color: '#fff', border: 'none', padding: '10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font)', letterSpacing: '0.04em' }}
                onClick={() => { moveStage('pre_release'); setShowPrepareConfirm(false) }}>
                Yes, start preparing
              </button>
              <button
                style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '10px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' }}
                onClick={() => setShowPrepareConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={s.body}>
          <div style={s.main}>
            {release && (
              <>
                <ChecklistSection releaseId={id} checklist="pre_release" label="Distribution Checklist" isCoordinator={isCoordinator} />
                {(release.stage === 'tease_window' || release.stage === 'reporting') && (
                  <ChecklistSection releaseId={id} checklist="post_release" label="Marketing Checklist" isCoordinator={isCoordinator} />
                )}
                {release.stage === 'tease_window' && (
                  <>
                    <ReleaseConfirmFlow release={release} onDecision={handleFridayDecision} />
                    <TeaseWindowLog releaseId={id} isCoordinator={isCoordinator || isContent} />
                    <div style={s.section}>
                      <div style={s.sectionHeader}>
                        <span style={s.sectionTitle}>Submit Tease Report</span>
                      </div>
                      <TeaseReportForm release={release} onSubmitted={() => {}} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div style={s.sidebar}>
            <div style={s.metaCard}>
              <div style={s.metaTitle}>{release.track?.title ?? '—'}</div>
              <div style={s.metaArtist}>
                {release.track?.artist === 'TBC'
                  ? <span style={{ color: 'var(--text-muted)' }}>Artist TBC</span>
                  : release.track?.artist}
              </div>

              <div style={s.metaDivider} />

              {[
                { key: 'writer(s)',   val: release.track?.writers },
                { key: 'producer(s)', val: release.track?.producers },
                { key: 'ownership',   val: release.track?.ownership === '100_owned' ? '100% owned' : release.track?.ownership === 'needs_permission' ? 'needs permission' : null },
                { key: 'bpm',         val: release.track?.bpm },
                { key: 'key',         val: release.track?.track_key },
                { key: 'length',      val: release.track?.track_length },
                { key: 'genre',       val: release.track?.genre },
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
                    placeholder="internal notes…" />
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

            <div style={{ marginTop: '16px' }}>
              <AssetsPanel release={release} isCoordinator={isCoordinator} />
            </div>
          </div>
        </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
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
  checkRow:      { display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--border)' },
  checkbox:      { accentColor: 'var(--bronze)', width: '13px', height: '13px', cursor: 'pointer', flexShrink: 0 },
  checkLabel:    { fontSize: '12px', color: 'var(--text)', lineHeight: 1.4 },
  checkDone:     { color: 'var(--text-muted)', textDecoration: 'line-through' },
  loadingItems:  { fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' },
  addRow:        { display: 'flex', gap: '6px', marginTop: '12px' },
  addInput:      { flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', padding: '7px 10px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none' },
  addItemBtn:    { background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '7px 12px', fontSize: '14px', cursor: 'pointer', color: 'var(--text-muted)' },

  // N/A controls
  naTag:     { fontSize: '9px', letterSpacing: '0.08em', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '1px 5px', flexShrink: 0 },
  naUndoBtn: { fontSize: '10px', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '1px 6px', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 },
  naBtn:     { fontSize: '9px', letterSpacing: '0.06em', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '2px 6px', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0, opacity: 0.6 },

  // Value cells
  valueDisplay:   { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' },
  valueInput:     { marginTop: '4px', width: '100%', background: 'var(--bg)', border: '1px solid var(--bronze-dim)', padding: '5px 8px', fontSize: '11px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none' },
  editValueBtn:   { fontSize: '10px', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '1px 6px', cursor: 'pointer', fontFamily: 'var(--font)', flexShrink: 0 },
  fileDownloadBtn:{ fontSize: '10px', background: 'none', border: '1px solid var(--border)', color: 'var(--bronze)', padding: '2px 8px', cursor: 'pointer', fontFamily: 'var(--font)' },
  fileReplaceBtn: { fontSize: '10px', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '2px 8px', cursor: 'pointer', fontFamily: 'var(--font)' },
  fileUploadBtn:  { marginTop: '4px', display: 'inline-block', fontSize: '10px', background: 'var(--bg)', border: '1px dashed var(--border)', color: 'var(--text-muted)', padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font)' },

  // Tease log
  logForm:       { marginBottom: '16px' },
  logTypeRow:    { display: 'flex', gap: '4px', marginBottom: '8px' },
  typeBtn:       { background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '4px 10px', fontSize: '10px', letterSpacing: '0.05em', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font)' },
  typeBtnActive: { background: 'var(--bronze)', color: '#fff', borderColor: 'var(--bronze)' },
  logInput:      { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none', resize: 'vertical' },
  logSubmit:     { marginTop: '6px', background: 'var(--bronze)', color: '#fff', border: 'none', padding: '8px 16px', fontSize: '11px', letterSpacing: '0.06em', cursor: 'pointer', fontFamily: 'var(--font)' },
  logList:       { display: 'flex', flexDirection: 'column', gap: '8px' },
  logEntry:      { background: 'var(--bg)', border: '1px solid var(--border)', padding: '10px 12px' },
  logEntryHeader:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' },
  logType:       { fontSize: '10px', letterSpacing: '0.06em', color: 'var(--bronze)', textTransform: 'uppercase' },
  logMeta:       { fontSize: '10px', color: 'var(--text-muted)' },
  logContent:    { fontSize: '12px', color: 'var(--text)', lineHeight: 1.5 },

  // Decision
  decisionBtn: { padding: '10px 16px', border: 'none', fontSize: '12px', letterSpacing: '0.05em', cursor: 'pointer', fontFamily: 'var(--font)' },

  // Sidebar meta
  metaCard:    { background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px' },
  metaTitle:   { fontSize: '14px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' },
  metaArtist:  { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' },
  metaDivider: { height: '1px', background: 'var(--border)', margin: '14px 0' },
  metaRow:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px', gap: '8px' },
  metaKey:     { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', flexShrink: 0 },
  metaVal:     { fontSize: '12px', color: 'var(--text)', textAlign: 'right' },
  metaInput:   { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', padding: '8px 10px', fontSize: '12px', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none' },
  assetRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' },
  assetLabel:  { fontSize: '11px', color: 'var(--text)', letterSpacing: '0.04em' },
  assetDownload:{ background: 'none', border: '1px solid var(--border)', color: 'var(--bronze)', padding: '3px 8px', fontSize: '10px', cursor: 'pointer', fontFamily: 'var(--font)' },
  assetUpload: { background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '3px 8px', fontSize: '10px', cursor: 'pointer', fontFamily: 'var(--font)' },

  // Performance
  statCard:  { flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 20px' },
  statValue: { fontSize: '22px', fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '4px' },
  statLabel: { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' },
  th: { fontSize: '10px', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'left', padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase' },
  td: { fontSize: '12px', padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text)' },
}

// Release Pack styles
const pk = {
  page:        { display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 48px)' },
  toolbar:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' },
  downloadBtn: { background: 'var(--bronze)', color: '#fff', border: 'none', padding: '10px 20px', fontSize: '12px', letterSpacing: '0.06em', cursor: 'pointer', fontFamily: 'var(--font)' },
  doc:         { maxWidth: '680px', margin: '0 auto', padding: '40px 24px 60px', display: 'flex', flexDirection: 'column', gap: '24px' },

  previewSection: { background: 'var(--surface)', border: '1px solid var(--border)', padding: '24px' },
  previewTitle:   { fontSize: '11px', letterSpacing: '0.1em', fontWeight: 500, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px' },

  fileTree:   { display: 'flex', flexDirection: 'column', gap: '2px' },
  treeFolder: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', marginTop: '8px' },
  treeItem:   { display: 'flex', alignItems: 'baseline', gap: '8px', padding: '5px 0', borderBottom: '1px solid var(--border)' },
  treeIcon:   { fontSize: '13px', flexShrink: 0 },
  treeName:   { fontSize: '12px', color: 'var(--text)', fontFamily: 'var(--font)' },
  treeDesc:   { fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' },

  valueList: { display: 'flex', flexDirection: 'column', gap: '1px' },
  valueRow:  { display: 'flex', alignItems: 'baseline', gap: '12px', padding: '7px 0', borderBottom: '1px solid var(--border)' },
  valueLabel:{ fontSize: '11px', color: 'var(--text-muted)', flex: '0 0 280px' },
  valueVal:  { fontSize: '12px', color: 'var(--bronze)', fontWeight: 500 },
}
