import { supabase } from './supabase'

export const DISTRIBUTION_ITEMS = [
  { label: '§ AUDIO', type: 'header' },
  { label: 'Track signed off — quality checked, no clipping or artefacts', type: 'check' },
  { label: '§ ARTWORK', type: 'header' },
  { label: 'Cover artwork uploaded (3000×3000 JPEG or PNG)', type: 'file', accept: '.jpg,.jpeg,.png' },
  { label: 'Artwork approved', type: 'check' },
  { label: '§ RIGHTS', type: 'header' },
  { label: 'Writer agreement signed and filed', type: 'file', accept: '.pdf,.docx' },
  { label: 'Rights and ownership cleared', type: 'check' },
  { label: '§ DISTRIBUTION', type: 'header' },
  { label: 'Submitted to Co-Brand', type: 'check' },
]

export async function seedChecklistForRelease(releaseId) {
  const { count } = await supabase
    .from('checklist_items')
    .select('id', { count: 'exact', head: true })
    .eq('release_id', releaseId)
    .eq('checklist', 'pre_release')

  if (count) return

  const { error } = await supabase.from('checklist_items').insert(
    DISTRIBUTION_ITEMS.map((item, i) => ({
      release_id: releaseId,
      checklist: 'pre_release',
      label: item.label,
      field_type: item.type === 'header' ? 'check' : (item.type || 'check'),
      position: i,
    }))
  )
  if (error) console.error('Checklist seed failed:', error.message)
}
