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
  if (!process.env.TMDB_API_KEY) return errorResponse(res, 500, 'API key not configured')

  const { id } = req.query
  if (!id) return errorResponse(res, 400, 'Missing person id')

  try {
    const url = `${TMDB_BASE}/person/${id}/movie_credits`
    const tmdbRes = await fetch(url, { headers: tmdbHeaders() })

    if (tmdbRes.status === 404) return errorResponse(res, 404, 'Person not found')
    if (!tmdbRes.ok) return errorResponse(res, tmdbRes.status, 'TMDB request failed')

    const data = await tmdbRes.json()

    // Combine acting credits and directing credits, deduplicate by tmdb_id
    const seen = new Set()
    const films = [
      ...(data.cast || []),
      ...(data.crew || []).filter(c => c.job === 'Director')
    ]
      .filter(m => {
        if (!m.id || !m.title || seen.has(m.id)) return false
        seen.add(m.id)
        return true
      })
      .map(normalizeFilm)
      .sort((a, b) => b.vote_average - a.vote_average)

    return res.status(200).json({ results: films, total_results: films.length })
  } catch {
    return errorResponse(res, 503, 'Upstream request failed')
  }
}
