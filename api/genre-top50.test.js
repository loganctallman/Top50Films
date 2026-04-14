import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from './genre-top50.js'
import { tmdbGenreRaw } from '../src/mocks/fixtures/genre.js'

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

describe('GET /api/genre-top50', () => {
  it('returns 500 when TMDB_API_KEY is missing', async () => {
    delete process.env.TMDB_API_KEY
    const res = mockRes()
    await handler({ query: {} }, res)
    expect(res._status).toBe(500)
    expect(res._body.error).toBe(true)
  })

  it('returns normalized results on success', async () => {
    mockFetch(tmdbGenreRaw)
    const res = mockRes()
    await handler({ query: {} }, res)
    expect(res._status).toBe(200)
    const first = res._body.results[0]
    expect(first.tmdb_id).toBe(238)
    expect(first.title).toBe('The Godfather')
    expect(first.year).toBe('1972')
    expect(first.watch_providers).toEqual([])
  })

  it('includes total_results in response', async () => {
    mockFetch(tmdbGenreRaw)
    const res = mockRes()
    await handler({ query: {} }, res)
    expect(res._body.total_results).toBe(2)
  })

  it('passes genre_id to TMDB when provided', async () => {
    mockFetch(tmdbGenreRaw)
    const res = mockRes()
    await handler({ query: { genre_id: '18' } }, res)
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('with_genres=18')
  })

  it('does not include with_genres param when genre_id is omitted', async () => {
    mockFetch(tmdbGenreRaw)
    const res = mockRes()
    await handler({ query: {} }, res)
    const url = global.fetch.mock.calls[0][0]
    expect(url).not.toContain('with_genres')
  })

  it('passes page param to TMDB (defaults to 1)', async () => {
    mockFetch(tmdbGenreRaw)
    const res = mockRes()
    await handler({ query: {} }, res)
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('page=1')
  })

  it('passes custom page param', async () => {
    mockFetch(tmdbGenreRaw)
    const res = mockRes()
    await handler({ query: { page: '3' } }, res)
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('page=3')
  })

  it('sorts by vote_average descending', async () => {
    mockFetch(tmdbGenreRaw)
    const res = mockRes()
    await handler({ query: {} }, res)
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('sort_by=vote_average.desc')
  })

  it('returns 503 when TMDB returns error', async () => {
    mockFetch({}, 500)
    const res = mockRes()
    await handler({ query: {} }, res)
    expect(res._status).toBe(500)
    expect(res._body.error).toBe(true)
  })

  it('returns 503 on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('timeout'))
    const res = mockRes()
    await handler({ query: {} }, res)
    expect(res._status).toBe(503)
  })
})
