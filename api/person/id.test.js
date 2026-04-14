import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from './[id].js'
import { tmdbPersonCreditsRaw } from '../../src/mocks/fixtures/person.js'

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

describe('GET /api/person/:id', () => {
  it('returns 500 when TMDB_API_KEY is missing', async () => {
    delete process.env.TMDB_API_KEY
    const res = mockRes()
    await handler({ query: { id: '1032' } }, res)
    expect(res._status).toBe(500)
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
    expect(res._body.message).toBe('Person not found')
  })

  it('returns merged cast + directing credits sorted by vote_average', async () => {
    mockFetch(tmdbPersonCreditsRaw)
    const res = mockRes()
    await handler({ query: { id: '1032' } }, res)
    expect(res._status).toBe(200)
    const films = res._body.results
    // Fight Club (8.4 from cast) and Godfather (9.2 from crew Director)
    expect(films.length).toBeGreaterThan(0)
    // Sorted by vote_average desc — Godfather (9.2) before Fight Club (8.4)
    const godfather = films.find(f => f.tmdb_id === 238)
    const fightClub = films.find(f => f.tmdb_id === 550)
    expect(godfather).toBeDefined()
    expect(fightClub).toBeDefined()
    const godfatherIdx = films.indexOf(godfather)
    const fightClubIdx = films.indexOf(fightClub)
    expect(godfatherIdx).toBeLessThan(fightClubIdx)
  })

  it('deduplicates films that appear in both cast and crew', async () => {
    // Fight Club id=550 appears in both cast and crew (as Producer)
    // Producer is not Director so crew entry filtered, but cast entry included
    mockFetch(tmdbPersonCreditsRaw)
    const res = mockRes()
    await handler({ query: { id: '1032' } }, res)
    const ids = res._body.results.map(f => f.tmdb_id)
    const unique = new Set(ids)
    expect(ids.length).toBe(unique.size)
  })

  it('excludes non-Director crew entries', async () => {
    // tmdbPersonCreditsRaw has Fight Club as Producer (not Director) in crew
    // It should appear only from the cast entry, not duplicated from crew
    mockFetch(tmdbPersonCreditsRaw)
    const res = mockRes()
    await handler({ query: { id: '1032' } }, res)
    // Fight Club should appear exactly once (from cast)
    const fightClubs = res._body.results.filter(f => f.tmdb_id === 550)
    expect(fightClubs).toHaveLength(1)
  })

  it('returns normalized film shape', async () => {
    mockFetch(tmdbPersonCreditsRaw)
    const res = mockRes()
    await handler({ query: { id: '1032' } }, res)
    const film = res._body.results[0]
    expect(film).toHaveProperty('tmdb_id')
    expect(film).toHaveProperty('title')
    expect(film).toHaveProperty('year')
    expect(film).toHaveProperty('poster_path')
    expect(film).toHaveProperty('genre_ids')
    expect(film).toHaveProperty('vote_average')
    expect(film).toHaveProperty('watch_providers')
    expect(film.watch_providers).toEqual([])
  })

  it('includes total_results in response', async () => {
    mockFetch(tmdbPersonCreditsRaw)
    const res = mockRes()
    await handler({ query: { id: '1032' } }, res)
    expect(res._body.total_results).toBe(res._body.results.length)
  })

  it('handles person with no credits', async () => {
    mockFetch({ cast: [], crew: [] })
    const res = mockRes()
    await handler({ query: { id: '1032' } }, res)
    expect(res._status).toBe(200)
    expect(res._body.results).toEqual([])
    expect(res._body.total_results).toBe(0)
  })

  it('filters out cast entries without id or title', async () => {
    const raw = {
      cast: [
        { id: 100, title: 'Valid Film', release_date: '2000-01-01', poster_path: '/p.jpg', genre_ids: [], vote_average: 7.0, vote_count: 1000 },
        { title: 'No ID Film', release_date: '2001-01-01' },         // no id
        { id: 200, release_date: '2002-01-01' }                      // no title
      ],
      crew: []
    }
    mockFetch(raw)
    const res = mockRes()
    await handler({ query: { id: '1032' } }, res)
    expect(res._body.results).toHaveLength(1)
    expect(res._body.results[0].tmdb_id).toBe(100)
  })

  it('returns 503 on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('timeout'))
    const res = mockRes()
    await handler({ query: { id: '1032' } }, res)
    expect(res._status).toBe(503)
  })
})
