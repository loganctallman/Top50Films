import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from './suggestions.js'

// Raw TMDB discover response for suggestions (10+ items to test slice)
const tmdbSuggestionsRaw = {
  results: Array.from({ length: 15 }, (_, i) => ({
    id: 100 + i,
    title: `Film ${i}`,
    release_date: '2000-01-01',
    poster_path: `/p${i}.jpg`,
    genre_ids: [18],
    vote_average: 8.0 - i * 0.1,
    vote_count: 5000
  }))
}

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

describe('GET /api/suggestions', () => {
  it('returns 500 when TMDB_API_KEY is missing', async () => {
    delete process.env.TMDB_API_KEY
    const res = mockRes()
    await handler({ query: { genre_ids: '18,80' } }, res)
    expect(res._status).toBe(500)
  })

  it('returns 400 when genre_ids is missing', async () => {
    const res = mockRes()
    await handler({ query: {} }, res)
    expect(res._status).toBe(400)
    expect(res._body.error).toBe(true)
  })

  it('returns at most 10 results (sliced)', async () => {
    mockFetch(tmdbSuggestionsRaw)
    const res = mockRes()
    await handler({ query: { genre_ids: '18,80' } }, res)
    expect(res._status).toBe(200)
    expect(res._body.results.length).toBeLessThanOrEqual(10)
  })

  it('returns normalized film shape', async () => {
    mockFetch(tmdbSuggestionsRaw)
    const res = mockRes()
    await handler({ query: { genre_ids: '18' } }, res)
    const first = res._body.results[0]
    expect(first.tmdb_id).toBe(100)
    expect(first.title).toBe('Film 0')
    expect(first.year).toBe('2000')
    expect(first.watch_providers).toEqual([])
  })

  it('passes genre_ids to TMDB URL', async () => {
    mockFetch(tmdbSuggestionsRaw)
    const res = mockRes()
    await handler({ query: { genre_ids: '18,80' } }, res)
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('with_genres=18%2C80')
  })

  it('sorts by popularity descending', async () => {
    mockFetch(tmdbSuggestionsRaw)
    const res = mockRes()
    await handler({ query: { genre_ids: '18' } }, res)
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('sort_by=popularity.desc')
  })

  it('returns 503 when TMDB returns error', async () => {
    mockFetch({}, 503)
    const res = mockRes()
    await handler({ query: { genre_ids: '18' } }, res)
    expect(res._status).toBe(503)
    expect(res._body.error).toBe(true)
  })

  it('returns 503 on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'))
    const res = mockRes()
    await handler({ query: { genre_ids: '18' } }, res)
    expect(res._status).toBe(503)
  })
})
