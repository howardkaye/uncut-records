import { supabase } from './supabase'

export const DISTRIBUTION_ITEMS = [
  { label: '§ AUDIO', type: 'header' },
  { label: 'Master quality-checked: no clipping, no artefacts, correct fade', type: 'check' },
  { label: '§ ARTWORK', type: 'header' },
  { label: 'Cover artwork delivered as 3000×3000px JPEG or PNG (RGB)', type: 'file', accept: '.jpg,.jpeg,.png' },
  { label: 'Artwork approved internally before submission', type: 'check' },
  { label: '§ RIGHTS & LEGAL', type: 'header' },
  { label: 'Writer agreement signed and filed', type: 'file', accept: '.pdf,.docx' },
  { label: 'Master ownership confirmed (Uncut Records)', type: 'check' },
  { label: 'Publishing ownership confirmed (writer retains)', type: 'check' },
  { label: 'No sample clearance issues confirmed', type: 'check' },
  { label: 'Copyright year confirmed', type: 'text', placeholder: 'e.g. 2026' },
]

export const RELEASE_ITEMS = [
  { label: '§ RELEASE DAY', type: 'header' },
  { label: 'Release live confirmation checked across Spotify, Apple Music, TikTok', type: 'check' },
  { label: 'Release day post live on all active social channels', type: 'check' },
  { label: 'Smart link / streaming link updated in bio and any pinned posts', type: 'text', placeholder: 'https://…' },
  { label: 'Any press or playlist placements shared across channels', type: 'check' },
  { label: '§ POST-RELEASE', type: 'header' },
  { label: 'Ongoing content: minimum posting cadence maintained post-release', type: 'check' },
  { label: 'Streams monitored weekly: Spotify for Artists, Apple Music for Artists', type: 'check' },
  { label: 'TikTok sound usage monitored: organic UGC tracked', type: 'check' },
  { label: 'Paid spend performance reviewed: spend vs stream growth ratio tracked', type: 'check' },
  { label: 'Weekly report compiled and shared with owners', type: 'check' },
]

/**
 * Seeds checklist items for a release if they don't already exist.
 * Safe to call multiple times — skips if already seeded.
 */
export async function seedChecklistForRelease(releaseId) {
  const [preRes, relRes] = await Promise.all([
    supabase.from('checklist_items').select('id', { count: 'exact', head: true })
      .eq('release_id', releaseId).eq('checklist', 'pre_release'),
    supabase.from('checklist_items').select('id', { count: 'exact', head: true })
      .eq('release_id', releaseId).eq('checklist', 'post_release'),
  ])

  const toInsert = []

  if (!preRes.count) {
    DISTRIBUTION_ITEMS.forEach((item, i) => toInsert.push({
      release_id: releaseId,
      checklist: 'pre_release',
      label: item.label,
      field_type: item.type === 'header' ? 'check' : (item.type || 'check'),
      position: i,
    }))
  }

  if (!relRes.count) {
    RELEASE_ITEMS.forEach((item, i) => toInsert.push({
      release_id: releaseId,
      checklist: 'post_release',
      label: item.label,
      field_type: item.type === 'header' ? 'check' : (item.type || 'check'),
      position: i,
    }))
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('checklist_items').insert(toInsert)
    if (error) console.error('Checklist seed failed:', error.message)
  }
}
