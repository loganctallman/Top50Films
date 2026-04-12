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

  try {
    const url = `${TMDB_BASE}/watch/providers/movie?watch_region=US`
    const tmdbRes = await fetch(url, { headers: tmdbHeaders() })

    if (!tmdbRes.ok) return errorResponse(res, tmdbRes.status, 'TMDB request failed')

    const data = await tmdbRes.json()

    const providers = (data.results || [])
      .map(p => ({
        provider_id: p.provider_id,
        provider_name: p.provider_name,
        logo_path: p.logo_path || null,
        display_priority: p.display_priorities?.US ?? 999
      }))
      .sort((a, b) => a.display_priority - b.display_priority)

    return res.status(200).json({ results: providers })
  } catch {
    return errorResponse(res, 503, 'Upstream request failed')
  }
}
