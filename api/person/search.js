const TMDB_BASE = 'https://api.themoviedb.org/3'

function errorResponse(res, status, message) {
  return res.status(status).json({ error: true, message, status })
}

function tmdbHeaders() {
  return {
    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
    accept: 'application/json'
  }
}

export default async function handler(req, res) {
  if (!process.env.TMDB_API_KEY) return errorResponse(res, 500, 'API key not configured')

  const { query } = req.query
  if (!query?.trim()) return errorResponse(res, 400, 'Missing query parameter')

  try {
    const url = `${TMDB_BASE}/search/person?query=${encodeURIComponent(query)}&include_adult=false`
    const tmdbRes = await fetch(url, { headers: tmdbHeaders() })

    if (!tmdbRes.ok) return errorResponse(res, tmdbRes.status, 'TMDB request failed')

    const data = await tmdbRes.json()

    return res.status(200).json({
      results: (data.results || []).map(p => ({
        id: p.id,
        name: p.name,
        known_for_department: p.known_for_department || 'Unknown'
      }))
    })
  } catch {
    return errorResponse(res, 503, 'Upstream request failed')
  }
}
