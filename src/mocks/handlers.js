import { http, HttpResponse } from 'msw'
import { searchResultsValid, searchResultsEmpty } from './fixtures/search.js'
import { movieWithProviders, movieNoProviders } from './fixtures/movie.js'
import { genreResultsValid } from './fixtures/genre.js'
import { suggestionsValid } from './fixtures/suggestions.js'
import { providersValid } from './fixtures/providers.js'
import { personSearchValid, personFilmographyValid } from './fixtures/person.js'

// MSW Node mode requires absolute URLs — relative paths don't match in @mswjs/interceptors/node
const BASE = 'http://localhost'

export const handlers = [
  http.get(`${BASE}/api/search`, ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('query')
    if (!query?.trim()) {
      return HttpResponse.json({ error: true, message: 'Missing query parameter', status: 400 }, { status: 400 })
    }
    if (query === 'empty') return HttpResponse.json(searchResultsEmpty)
    if (query === 'error') return HttpResponse.json({ error: true, message: 'TMDB request failed', status: 503 }, { status: 503 })
    return HttpResponse.json(searchResultsValid)
  }),

  http.get(`${BASE}/api/movie/:id`, ({ params }) => {
    if (params.id === '0') {
      return HttpResponse.json({ error: true, message: 'Movie not found', status: 404 }, { status: 404 })
    }
    if (params.id === '999999') return HttpResponse.json(movieNoProviders)
    return HttpResponse.json(movieWithProviders)
  }),

  http.get(`${BASE}/api/genre-top50`, () => {
    return HttpResponse.json(genreResultsValid)
  }),

  http.get(`${BASE}/api/suggestions`, ({ request }) => {
    const url = new URL(request.url)
    const genreIds = url.searchParams.get('genre_ids')
    if (!genreIds) {
      return HttpResponse.json({ error: true, message: 'Missing genre_ids', status: 400 }, { status: 400 })
    }
    return HttpResponse.json(suggestionsValid)
  }),

  http.get(`${BASE}/api/providers`, () => {
    return HttpResponse.json(providersValid)
  }),

  http.get(`${BASE}/api/person/search`, ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('query')
    if (!query?.trim()) {
      return HttpResponse.json({ error: true, message: 'Missing query parameter', status: 400 }, { status: 400 })
    }
    return HttpResponse.json(personSearchValid)
  }),

  http.get(`${BASE}/api/person/:id`, () => {
    return HttpResponse.json(personFilmographyValid)
  })
]
