import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from './[id].js'
import { tmdbMovieRaw, tmdbMovieRawNoProviders } from '../../src/mocks/fixtures/movie.js'

function mockRes() {
  const res = { _status: null, _body: null }
  res.status = vi.fn((code) => { res._status = code; return res })
  res.json = vi.fn((data) => { res._body = data; return res })
  return res
}

function mockFetch(data, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data)
  })
}

beforeEach(() => {
  process.env.TMDB_API_KEY = 'test-key'
})

afterEach(() => {
  delete process.env.TMDB_API_KEY
  vi.restoreAllMocks()
})

describe('GET /api/movie/:id', () => {
  it('returns 500 when TMDB_API_KEY is missing', async () => {
    delete process.env.TMDB_API_KEY
    const res = mockRes()
    await handler({ query: { id: '238' } }, res)
    expect(res._status).toBe(500)
    expect(res._body.error).toBe(true)
  })

  it('returns 400 when id is missing', async () => {
    const res = mockRes()
    await handler({ query: {} }, res)
    expect(res._status).toBe(400)
  })

  it('returns 404 when TMDB returns 404', async () => {
    mockFetch({}, 404)
    const res = mockRes()
    await handler({ query: { id: '0' } }, res)
    expect(res._status).toBe(404)
    expect(res._body.message).toBe('Movie not found')
  })

  it('returns shaped movie data on success', async () => {
    mockFetch(tmdbMovieRaw)
    const res = mockRes()
    await handler({ query: { id: '238' } }, res)
    expect(res._status).toBe(200)
    const body = res._body
    expect(body.tmdb_id).toBe(238)
    expect(body.title).toBe('The Godfather')
    expect(body.year).toBe('1972')
    expect(body.overview).toBeTruthy()
    expect(Array.isArray(body.genre_ids)).toBe(true)
  })

  it('includes watch providers from flatrate and free tiers', async () => {
    mockFetch(tmdbMovieRaw)
    const res = mockRes()
    await handler({ query: { id: '238' } }, res)
    const providers = res._body.watch_providers
    expect(providers.length).toBeGreaterThan(0)
    const names = providers.map(p => p.provider_name)
    expect(names).toContain('Netflix')
    expect(names).toContain('Tubi TV')
  })

  it('flatrate providers have null watch_link', async () => {
    mockFetch(tmdbMovieRaw)
    const res = mockRes()
    await handler({ query: { id: '238' } }, res)
    const netflix = res._body.watch_providers.find(p => p.provider_name === 'Netflix')
    expect(netflix.streaming_type).toBe('flatrate')
    expect(netflix.watch_link).toBeNull()
  })

  it('free providers get the TMDB watch page link', async () => {
    mockFetch(tmdbMovieRaw)
    const res = mockRes()
    await handler({ query: { id: '238' } }, res)
    const tubi = res._body.watch_providers.find(p => p.provider_name === 'Tubi TV')
    expect(tubi.streaming_type).toBe('free')
    expect(tubi.watch_link).toContain('themoviedb.org')
  })

  it('returns empty watch_providers when no US providers', async () => {
    mockFetch(tmdbMovieRawNoProviders)
    const res = mockRes()
    await handler({ query: { id: '999999' } }, res)
    expect(res._status).toBe(200)
    expect(res._body.watch_providers).toEqual([])
  })

  it('deduplicates providers that appear in multiple tiers', async () => {
    const rawWithDupe = {
      ...tmdbMovieRaw,
      'watch/providers': {
        results: {
          US: {
            link: 'https://example.com',
            flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg' }],
            free: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg' }]  // same provider
          }
        }
      }
    }
    mockFetch(rawWithDupe)
    const res = mockRes()
    await handler({ query: { id: '238' } }, res)
    const netflix = res._body.watch_providers.filter(p => p.provider_id === 8)
    expect(netflix).toHaveLength(1)
  })

  it('returns 503 on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('timeout'))
    const res = mockRes()
    await handler({ query: { id: '238' } }, res)
    expect(res._status).toBe(503)
  })
})
