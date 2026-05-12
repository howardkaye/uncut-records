// Vercel serverless function — returns all events from Asana Uncut Teases & Releases calendar

const ASANA_PROJECT_ID = '1214751918771224'

function classifyTask(name, section) {
  if (name.includes('TEASE —') || name.includes('TEASE—'))   return 'tease'
  if (name.includes('RELEASE —') || name.includes('RELEASE—')) return 'release'
  if (name.includes('📱') || section === 'Content Catch-Ups') return 'content'
  if (name.includes('📊') || section === 'Ads Team Updates')  return 'ads'
  return 'other'
}

function parseTrackName(name) {
  const teaseMatch   = name.match(/TEASE\s+[—-]\s+(.+)$/)
  const releaseMatch = name.match(/RELEASE\s+[—-]\s+(.+)$/)
  return (teaseMatch || releaseMatch)?.[1]?.trim() ?? null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const pat = process.env.ASANA_PAT
  if (!pat) return res.status(500).json({ error: 'ASANA_PAT not configured' })

  try {
    const url = `https://app.asana.com/api/1.0/tasks?project=${ASANA_PROJECT_ID}&opt_fields=name,due_on,completed,memberships.section.name&limit=100`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${pat}`, Accept: 'application/json' },
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: `Asana error ${response.status}` })
    }

    const { data: tasks } = await response.json()

    const events = tasks
      .filter(t => t.due_on)
      .map(t => {
        const section = t.memberships?.[0]?.section?.name ?? ''
        const type = classifyTask(t.name, section)
        return {
          gid:       t.gid,
          name:      t.name,
          due_on:    t.due_on,
          completed: t.completed,
          type,
          trackName: parseTrackName(t.name),
          section,
        }
      })
      .sort((a, b) => a.due_on.localeCompare(b.due_on))

    return res.status(200).json({ data: events })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
