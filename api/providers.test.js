import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from './providers.js'

// Raw TMDB providers response — uses display_priorities (per-region) as TMDB actually returns
const tmdbProvidersRawActual = {
  results: [
    { provider_id: 9, provider_name: 'Amazon Prime', logo_path: '/amazon.jpg', display_priorities: { US: 2 } },
    { provider_id: 8, provider_name: 'Netflix',       logo_path: '/netflix.jpg', display_priorities: { US: 1 } },
    { provider_id: 337, provider_name: 'Disney+',     logo_path: '/disney.jpg', display_priorities: { US: 3 } }
  ]
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

describe('GET /api/providers', () => {
  it('returns 500 when TMDB_API_KEY is missing', async () => {
    delete process.env.TMDB_API_KEY
    const res = mockRes()
    await handler({ query: {} }, res)
    expect(res._status).toBe(500)
  })

  it('returns providers sorted by US display_priority ascending', async () => {
    mockFetch(tmdbProvidersRawActual)
    const res = mockRes()
    await handler({ query: {} }, res)
    expect(res._status).toBe(200)
    const names = res._body.results.map(p => p.provider_name)
    expect(names[0]).toBe('Netflix')   // priority 1
    expect(names[1]).toBe('Amazon Prime')  // priority 2
    expect(names[2]).toBe('Disney+')       // priority 3
  })

  it('returns shaped provider objects', async () => {
    mockFetch(tmdbProvidersRawActual)
    const res = mockRes()
    await handler({ query: {} }, res)
    const netflix = res._body.results[0]
    expect(netflix.provider_id).toBe(8)
    expect(netflix.provider_name).toBe('Netflix')
    expect(netflix.logo_path).toBe('/netflix.jpg')
    expect(netflix.display_priority).toBe(1)
  })

  it('falls back to priority 999 when display_priorities is absent', async () => {
    const rawNoPriority = {
      results: [{ provider_id: 99, provider_name: 'Unknown', logo_path: null }]
    }
    mockFetch(rawNoPriority)
    const res = mockRes()
    await handler({ query: {} }, res)
    expect(res._body.results[0].display_priority).toBe(999)
  })

  it('returns empty results array when TMDB has no providers', async () => {
    mockFetch({ results: [] })
    const res = mockRes()
    await handler({ query: {} }, res)
    expect(res._status).toBe(200)
    expect(res._body.results).toEqual([])
  })

  it('hits the correct TMDB endpoint with watch_region=US', async () => {
    mockFetch(tmdbProvidersRawActual)
    const res = mockRes()
    await handler({ query: {} }, res)
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('/watch/providers/movie')
    expect(url).toContain('watch_region=US')
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
