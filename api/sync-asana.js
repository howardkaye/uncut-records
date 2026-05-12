// Vercel serverless function — fetches Uncut Teases & Releases from Asana
// Returns parsed tease and release dates keyed by track name

const ASANA_PROJECT_ID = '1214751918771224'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const pat = process.env.ASANA_PAT
  if (!pat) {
    return res.status(500).json({ error: 'ASANA_PAT environment variable not set' })
  }

  try {
    const url = `https://app.asana.com/api/1.0/tasks?project=${ASANA_PROJECT_ID}&opt_fields=name,due_on,completed,memberships.section.name&limit=100`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${pat}`, Accept: 'application/json' },
    })

    if (!response.ok) {
      const text = await response.text()
      return res.status(response.status).json({ error: `Asana API error: ${text}` })
    }

    const { data: tasks } = await response.json()

    // Build map: trackName (lowercase) → { teaseDate, releaseDate, trackName }
    const map = {}

    for (const task of tasks) {
      if (!task.due_on) continue
      const section = task.memberships?.[0]?.section?.name

      if (section === 'Teases' && task.name.includes('TEASE — ')) {
        const trackName = task.name.replace(/.*TEASE\s+—\s+/, '').trim()
        const key = trackName.toLowerCase()
        if (!map[key]) map[key] = { trackName }
        map[key].teaseDate = task.due_on
      } else if (section === 'Releases' && task.name.includes('RELEASE — ')) {
        const trackName = task.name.replace(/.*RELEASE\s+—\s+/, '').trim()
        const key = trackName.toLowerCase()
        if (!map[key]) map[key] = { trackName }
        map[key].releaseDate = task.due_on
      }
    }

    return res.status(200).json({ data: Object.values(map) })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
