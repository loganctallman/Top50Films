const TMDB_BASE = 'https://api.themoviedb.org/3'

function errorResponse(res, status, message) {
  return res.status(status).json({ error: true, message, status })
}

export default async function handler(req, res) {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return errorResponse(res, 500, 'API key not configured')

  const { id } = req.query
  if (!id) return errorResponse(res, 400, 'Missing movie id')

  try {
    const url = `${TMDB_BASE}/movie/${id}?api_key=${apiKey}&append_to_response=watch%2Fproviders`
    const tmdbRes = await fetch(url)

    if (tmdbRes.status === 404) return errorResponse(res, 404, 'Movie not found')
    if (!tmdbRes.ok) return errorResponse(res, tmdbRes.status, 'TMDB request failed')

    const data = await tmdbRes.json()

    // Extract US flatrate (subscription streaming) providers
    const watchProvidersRaw = data['watch/providers']
    const usProviders = watchProvidersRaw?.results?.US?.flatrate || []

    const watch_providers = usProviders.map(p => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_path: p.logo_path || null
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
  } catch (err) {
    return errorResponse(res, 503, 'Upstream request failed')
  }
}
