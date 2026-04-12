const TMDB_BASE = 'https://api.themoviedb.org/3'

function errorResponse(res, status, message) {
  return res.status(status).json({ error: true, message, status })
}

export default async function handler(req, res) {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return errorResponse(res, 500, 'API key not configured')

  try {
    // Get streaming providers available in the US, sorted by display priority
    const url = `${TMDB_BASE}/watch/providers/movie?api_key=${apiKey}&watch_region=US`
    const tmdbRes = await fetch(url)

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
  } catch (err) {
    return errorResponse(res, 503, 'Upstream request failed')
  }
}
