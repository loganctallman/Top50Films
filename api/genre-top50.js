const TMDB_BASE = 'https://api.themoviedb.org/3'

function errorResponse(res, status, message) {
  return res.status(status).json({ error: true, message, status })
}

function normalizeFilm(movie) {
  return {
    tmdb_id: movie.id,
    title: movie.title,
    year: movie.release_date ? movie.release_date.slice(0, 4) : null,
    poster_path: movie.poster_path || null,
    genre_ids: movie.genre_ids || [],
    vote_average: movie.vote_average || 0,
    vote_count: movie.vote_count || 0,
    watch_providers: []
  }
}

export default async function handler(req, res) {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return errorResponse(res, 500, 'API key not configured')

  const { genre_id } = req.query

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      sort_by: 'vote_average.desc',
      'vote_count.gte': '1000',
      include_adult: 'false',
      page: '1'
    })

    if (genre_id) params.set('with_genres', genre_id)

    const url = `${TMDB_BASE}/discover/movie?${params}`
    const tmdbRes = await fetch(url)

    if (!tmdbRes.ok) return errorResponse(res, tmdbRes.status, 'TMDB request failed')

    const data = await tmdbRes.json()

    return res.status(200).json({
      results: (data.results || []).map(normalizeFilm),
      total_results: data.total_results
    })
  } catch (err) {
    return errorResponse(res, 503, 'Upstream request failed')
  }
}
