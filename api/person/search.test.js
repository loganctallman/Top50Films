import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from './search.js'
import { tmdbPersonSearchRaw } from '../../src/mocks/fixtures/person.js'

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

describe('GET /api/person/search', () => {
  it('returns 500 when TMDB_API_KEY is missing', async () => {
    delete process.env.TMDB_API_KEY
    const res = mockRes()
    await handler({ query: { query: 'coppola' } }, res)
    expect(res._status).toBe(500)
  })

  it('returns 400 when query is missing', async () => {
    const res = mockRes()
    await handler({ query: {} }, res)
    expect(res._status).toBe(400)
    expect(res._body.error).toBe(true)
  })

  it('returns 400 when query is blank', async () => {
    const res = mockRes()
    await handler({ query: { query: '   ' } }, res)
    expect(res._status).toBe(400)
  })

  it('returns shaped person results on success', async () => {
    mockFetch(tmdbPersonSearchRaw)
    const res = mockRes()
    await handler({ query: { query: 'coppola' } }, res)
    expect(res._status).toBe(200)
    expect(res._body.results).toHaveLength(2)
    const first = res._body.results[0]
    expect(first.id).toBe(1032)
    expect(first.name).toBe('Francis Ford Coppola')
    expect(first.known_for_department).toBe('Directing')
  })

  it('only exposes id, name, known_for_department fields', async () => {
    mockFetch(tmdbPersonSearchRaw)
    const res = mockRes()
    await handler({ query: { query: 'coppola' } }, res)
    const person = res._body.results[0]
    expect(Object.keys(person)).toEqual(['id', 'name', 'known_for_department'])
  })

  it('defaults known_for_department to "Unknown" when absent', async () => {
    const raw = { results: [{ id: 1, name: 'No Dept', known_for_department: undefined }] }
    mockFetch(raw)
    const res = mockRes()
    await handler({ query: { query: 'test' } }, res)
    expect(res._body.results[0].known_for_department).toBe('Unknown')
  })

  it('passes query to TMDB URL encoded', async () => {
    mockFetch(tmdbPersonSearchRaw)
    const res = mockRes()
    await handler({ query: { query: 'steven spielberg' } }, res)
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('steven')
    expect(url).not.toContain(' ')
  })

  it('returns 503 when TMDB returns error', async () => {
    mockFetch({}, 503)
    const res = mockRes()
    await handler({ query: { query: 'coppola' } }, res)
    expect(res._status).toBe(503)
    expect(res._body.error).toBe(true)
  })

  it('returns 503 on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('timeout'))
    const res = mockRes()
    await handler({ query: { query: 'coppola' } }, res)
    expect(res._status).toBe(503)
  })
})
