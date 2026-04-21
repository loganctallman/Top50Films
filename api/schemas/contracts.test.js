/**
 * API Contract Tests
 *
 * Two concerns:
 *  1. Handler output — each handler is invoked with realistic mocked TMDB data
 *     and its response body is validated against the JSON Schema for that endpoint.
 *     Catches regressions where a handler stops returning a required field.
 *
 *  2. Fixture drift — the MSW/Playwright fixtures in tests/e2e/helpers.js are
 *     validated against the same schemas. Catches mock data drifting out of sync
 *     with the real handler contract over time.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validate, SCHEMAS } from './validate.js'
import { fixtures } from '../../tests/e2e/helpers.js'

import providersHandler    from '../providers.js'
import genreTop50Handler   from '../genre-top50.js'
import searchHandler       from '../search.js'
import suggestionsHandler  from '../suggestions.js'
import movieHandler        from '../movie/[id].js'
import personSearchHandler from '../person/search.js'
import personIdHandler     from '../person/[id].js'

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

function mockRes() {
  const res = { _status: null, _body: null }
  res.status = vi.fn(code => { res._status = code; return res })
  res.json   = vi.fn(data  => { res._body  = data; return res })
  return res
}

function mockFetch(data, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data)
  })
}

beforeEach(() => { process.env.TMDB_API_KEY = 'test-key' })
afterEach(() => { delete process.env.TMDB_API_KEY; vi.restoreAllMocks() })

// ---------------------------------------------------------------------------
// Realistic raw TMDB payloads (what TMDB actually returns before normalisation)
// ---------------------------------------------------------------------------

const TMDB_FILM = {
  id: 238,
  title: 'The Godfather',
  release_date: '1972-03-24',
  poster_path: '/3bhkrj58Vtu7enYsLlegkKXKHKY.jpg',
  genre_ids: [18, 80],
  vote_average: 9.2,
  vote_count: 18000
}

const TMDB_MOVIE_LIST = { results: [TMDB_FILM], total_results: 1, total_pages: 1, page: 1 }

const TMDB_MOVIE_DETAIL = {
  id: 238,
  title: 'The Godfather',
  release_date: '1972-03-24',
  poster_path: '/3bhkrj58Vtu7enYsLlegkKXKHKY.jpg',
  genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }],
  vote_average: 9.2,
  vote_count: 18000,
  overview: 'The aging patriarch of an organized crime dynasty.',
  'watch/providers': {
    results: {
      US: {
        link: 'https://www.themoviedb.org/movie/238/watch',
        flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' }],
        free: [],
        ads: []
      }
    }
  }
}

const TMDB_PROVIDERS = {
  results: [
    { provider_id: 8,  provider_name: 'Netflix',       logo_path: '/netflix.jpg', display_priorities: { US: 1 } },
    { provider_id: 9,  provider_name: 'Amazon Prime',   logo_path: '/amazon.jpg',  display_priorities: { US: 2 } }
  ]
}

const TMDB_PERSON_SEARCH = {
  results: [{ id: 1032, name: 'Francis Ford Coppola', known_for_department: 'Directing' }]
}

const TMDB_PERSON_CREDITS = {
  cast: [TMDB_FILM],
  crew: [{
    id: 239, title: 'The Godfather Part II', release_date: '1974-12-18',
    poster_path: '/path2.jpg', genre_ids: [18, 80], vote_average: 9.0,
    vote_count: 11000, job: 'Director'
  }]
}

// ---------------------------------------------------------------------------
// 1. Handler output contract
// ---------------------------------------------------------------------------

describe('Handler output — schema compliance', () => {
  it('GET /api/providers response matches providers-response schema', async () => {
    mockFetch(TMDB_PROVIDERS)
    const res = mockRes()
    await providersHandler({ query: {} }, res)
    expect(res._status).toBe(200)
    expect(() => validate(SCHEMAS.PROVIDERS, res._body)).not.toThrow()
  })

  it('GET /api/genre-top50 response matches genre-top50-response schema', async () => {
    mockFetch(TMDB_MOVIE_LIST)
    const res = mockRes()
    await genreTop50Handler({ query: {} }, res)
    expect(res._status).toBe(200)
    expect(() => validate(SCHEMAS.GENRE_TOP50, res._body)).not.toThrow()
  })

  it('GET /api/search response matches search-response schema', async () => {
    mockFetch(TMDB_MOVIE_LIST)
    const res = mockRes()
    await searchHandler({ query: { query: 'godfather' } }, res)
    expect(res._status).toBe(200)
    expect(() => validate(SCHEMAS.SEARCH, res._body)).not.toThrow()
  })

  it('GET /api/suggestions response matches suggestions-response schema', async () => {
    mockFetch(TMDB_MOVIE_LIST)
    const res = mockRes()
    await suggestionsHandler({ query: { genre_ids: '18' } }, res)
    expect(res._status).toBe(200)
    expect(() => validate(SCHEMAS.SUGGESTIONS, res._body)).not.toThrow()
  })

  it('GET /api/movie/:id response matches movie-response schema', async () => {
    mockFetch(TMDB_MOVIE_DETAIL)
    const res = mockRes()
    await movieHandler({ query: { id: '238' } }, res)
    expect(res._status).toBe(200)
    expect(() => validate(SCHEMAS.MOVIE, res._body)).not.toThrow()
  })

  it('GET /api/person/search response matches person-search-response schema', async () => {
    mockFetch(TMDB_PERSON_SEARCH)
    const res = mockRes()
    await personSearchHandler({ query: { query: 'coppola' } }, res)
    expect(res._status).toBe(200)
    expect(() => validate(SCHEMAS.PERSON_SEARCH, res._body)).not.toThrow()
  })

  it('GET /api/person/:id response matches person-filmography-response schema', async () => {
    mockFetch(TMDB_PERSON_CREDITS)
    const res = mockRes()
    await personIdHandler({ query: { id: '1032' } }, res)
    expect(res._status).toBe(200)
    expect(() => validate(SCHEMAS.PERSON_FILMOGRAPHY, res._body)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// 2. Fixture drift detection
// ---------------------------------------------------------------------------

describe('E2E fixture drift — fixtures satisfy handler schemas', () => {
  it('fixtures.providers satisfies providers-response schema', () => {
    expect(() => validate(SCHEMAS.PROVIDERS, fixtures.providers)).not.toThrow()
  })

  it('fixtures.searchResults satisfies search-response schema', () => {
    expect(() => validate(SCHEMAS.SEARCH, fixtures.searchResults)).not.toThrow()
  })

  it('fixtures.movieWithProviders satisfies movie-response schema', () => {
    expect(() => validate(SCHEMAS.MOVIE, fixtures.movieWithProviders)).not.toThrow()
  })

  it('fixtures.personSearch satisfies person-search-response schema', () => {
    expect(() => validate(SCHEMAS.PERSON_SEARCH, fixtures.personSearch)).not.toThrow()
  })

  it('fixtures.personFilmography satisfies person-filmography-response schema', () => {
    expect(() => validate(SCHEMAS.PERSON_FILMOGRAPHY, fixtures.personFilmography)).not.toThrow()
  })
})
