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

  const { id } = req.query
  if (!id) return errorResponse(res, 400, 'Missing movie id')

  try {
    const url = `${TMDB_BASE}/movie/${id}?append_to_response=watch%2Fproviders`
    const tmdbRes = await fetch(url, { headers: tmdbHeaders() })

    if (tmdbRes.status === 404) return errorResponse(res, 404, 'Movie not found')
    if (!tmdbRes.ok) return errorResponse(res, tmdbRes.status, 'TMDB request failed')

    const data = await tmdbRes.json()

    const us = data['watch/providers']?.results?.US || {}

    // Combine subscription (flatrate), free, and ad-supported tiers
    // Deduplicate by provider_id in case a service appears in multiple tiers
    const seen = new Set()
    const watch_providers = ['flatrate', 'free', 'ads']
      .flatMap(type => (us[type] || []).map(p => ({ ...p, streaming_type: type })))
      .filter(p => {
        if (seen.has(p.provider_id)) return false
        seen.add(p.provider_id)
        return true
      })
      .map(p => ({
        provider_id: p.provider_id,
        provider_name: p.provider_name,
        logo_path: p.logo_path || null,
        streaming_type: p.streaming_type
      }))

    return res.status(200).json({
      tmdb_id: data.id,
      title: data.title,
      year: data.release_date ? data.release_date.slice(0, 4) : null,
      poster_path: data.poster_path || null,
      genre_ids: (data.genres || []).map(g => g.id),
      vote_average: data.vote_average || 0,
      overview: data.overview || '',
      watch_providers
    })
  } catch {
    return errorResponse(res, 503, 'Upstream request failed')
  }
}
