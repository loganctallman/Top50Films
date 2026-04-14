import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from './search.js'
import { tmdbSearchRaw, tmdbSearchRawEmpty } from '../src/mocks/fixtures/search.js'

function mockRes() {
  const res = { _status: null, _body: null }
  res.status = vi.fn((code) => { res._status = code; return res })
  res.json = vi.fn((data) => { res._body = data; return res })
  return res
}

function mockReq(query = {}) {
  return { query }
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

describe('GET /api/search', () => {
  it('returns 500 when TMDB_API_KEY is missing', async () => {
    delete process.env.TMDB_API_KEY
    const res = mockRes()
    await handler(mockReq({ query: 'batman' }), res)
    expect(res._status).toBe(500)
    expect(res._body.error).toBe(true)
  })

  it('returns 400 when query param is missing', async () => {
    const res = mockRes()
    await handler(mockReq({}), res)
    expect(res._status).toBe(400)
    expect(res._body.error).toBe(true)
  })

  it('returns 400 when query is blank', async () => {
    const res = mockRes()
    await handler(mockReq({ query: '   ' }), res)
    expect(res._status).toBe(400)
  })

  it('returns normalized results on success', async () => {
    mockFetch(tmdbSearchRaw)
    const res = mockRes()
    await handler(mockReq({ query: 'godfather' }), res)
    expect(res._status).toBe(200)
    const body = res._body
    expect(body.results).toHaveLength(2)
    const first = body.results[0]
    expect(first.tmdb_id).toBe(238)
    expect(first.title).toBe('The Godfather')
    expect(first.year).toBe('1972')
    expect(first.watch_providers).toEqual([])
  })

  it('returns pagination metadata', async () => {
    mockFetch(tmdbSearchRaw)
    const res = mockRes()
    await handler(mockReq({ query: 'godfather' }), res)
    expect(res._body.total_results).toBe(2)
    expect(res._body.total_pages).toBe(1)
    expect(res._body.page).toBe(1)
  })

  it('returns empty results for zero-result search', async () => {
    mockFetch(tmdbSearchRawEmpty)
    const res = mockRes()
    await handler(mockReq({ query: 'xyznotafilm' }), res)
    expect(res._status).toBe(200)
    expect(res._body.results).toEqual([])
  })

  it('passes the page param to TMDB', async () => {
    mockFetch(tmdbSearchRaw)
    const res = mockRes()
    await handler(mockReq({ query: 'godfather', page: '2' }), res)
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('page=2')
  })

  it('returns 503 when TMDB is not ok', async () => {
    mockFetch({}, 500)
    const res = mockRes()
    await handler(mockReq({ query: 'godfather' }), res)
    expect(res._status).toBe(500)
    expect(res._body.error).toBe(true)
  })

  it('returns 503 on fetch network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    const res = mockRes()
    await handler(mockReq({ query: 'godfather' }), res)
    expect(res._status).toBe(503)
    expect(res._body.error).toBe(true)
  })

  it('encodes the query in the TMDB URL (spaces percent-encoded)', async () => {
    mockFetch(tmdbSearchRaw)
    const res = mockRes()
    await handler(mockReq({ query: 'the godfather' }), res)
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('the%20godfather')
    expect(url).not.toContain(' ')
  })

  it('sends Authorization header with API key', async () => {
    mockFetch(tmdbSearchRaw)
    const res = mockRes()
    await handler(mockReq({ query: 'godfather' }), res)
    const opts = global.fetch.mock.calls[0][1]
    expect(opts.headers.Authorization).toBe('Bearer test-key')
  })
})
