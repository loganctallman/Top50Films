const BASE = '/api'

async function request(path) {
  const res = await fetch(`${BASE}${path}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.message || 'Request failed')
    err.status = res.status
    err.isApiError = true
    throw err
  }
  return body
}

export const apiService = {
  search(query, page = 1) {
    return request(`/search?query=${encodeURIComponent(query)}&page=${page}`)
  },

  movie(id) {
    return request(`/movie/${id}`)
  },

  genreTop50(genre_id) {
    const q = genre_id ? `?genre_id=${genre_id}` : ''
    return request(`/genre-top50${q}`)
  },

  providers() {
    return request('/providers')
  },

  suggestions(genre_ids) {
    return request(`/suggestions?genre_ids=${genre_ids.join(',')}`)
  }
}
