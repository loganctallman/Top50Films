import { describe, it, expect } from 'vitest'
import { generateNotifications } from './notificationLogic.js'

const makeFilm = (id) => ({
  tmdb_id: id,
  title: `Film ${id}`,
  year: '2000',
  poster_path: `/p${id}.jpg`,
  genre_ids: [18]
})

const makeProvider = (name) => ({ provider_name: name, streaming_type: 'subscription' })

const makeCache = (id, providers) => ({
  [id]: { tmdb_id: id, providers, fetched_at: new Date().toISOString() }
})

describe('generateNotifications', () => {
  it('returns empty array for empty favorites', () => {
    expect(generateNotifications([], {})).toEqual([])
  })

  it('returns empty array when cache is empty', () => {
    const favorites = [makeFilm(1), makeFilm(2)]
    expect(generateNotifications(favorites, {})).toEqual([])
  })

  it('generates a notification for a film with providers', () => {
    const favorites = [makeFilm(1)]
    const cache = makeCache(1, [makeProvider('Netflix')])
    const result = generateNotifications(favorites, cache)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
    expect(result[0].film).toEqual(favorites[0])
    expect(result[0].provider).toEqual(makeProvider('Netflix'))
    expect(result[0].providers).toEqual([makeProvider('Netflix')])
  })

  it('sets provider to the first provider in the list', () => {
    const providers = [makeProvider('Netflix'), makeProvider('Hulu')]
    const cache = makeCache(1, providers)
    const result = generateNotifications([makeFilm(1)], cache)
    expect(result[0].provider.provider_name).toBe('Netflix')
    expect(result[0].providers).toHaveLength(2)
  })

  it('skips films with no cache entry', () => {
    const favorites = [makeFilm(1), makeFilm(2)]
    const cache = makeCache(1, [makeProvider('Netflix')])
    const result = generateNotifications(favorites, cache)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('skips films with empty providers array', () => {
    const favorites = [makeFilm(1), makeFilm(2)]
    const cache = {
      ...makeCache(1, [makeProvider('Netflix')]),
      ...makeCache(2, [])  // empty providers
    }
    const result = generateNotifications(favorites, cache)
    expect(result).toHaveLength(1)
  })

  it('skips films whose cache entry has null providers', () => {
    const cache = { 1: { tmdb_id: 1, providers: null, fetched_at: new Date().toISOString() } }
    const result = generateNotifications([makeFilm(1)], cache)
    expect(result).toEqual([])
  })

  it('includes ALL films with any provider regardless of streaming service type', () => {
    const providers = [
      makeProvider('Netflix'),
      { provider_name: 'Tubi', streaming_type: 'free' },
      { provider_name: 'PlutoTV', streaming_type: 'ads' }
    ]
    const favorites = providers.map((_, i) => makeFilm(i + 1))
    const cache = Object.fromEntries(
      providers.map((p, i) => [i + 1, { tmdb_id: i + 1, providers: [p], fetched_at: new Date().toISOString() }])
    )
    const result = generateNotifications(favorites, cache)
    expect(result).toHaveLength(3)
  })

  it('preserves favorites order in output', () => {
    const favorites = [makeFilm(3), makeFilm(1), makeFilm(2)]
    const cache = {
      1: { tmdb_id: 1, providers: [makeProvider('A')], fetched_at: new Date().toISOString() },
      2: { tmdb_id: 2, providers: [makeProvider('B')], fetched_at: new Date().toISOString() },
      3: { tmdb_id: 3, providers: [makeProvider('C')], fetched_at: new Date().toISOString() }
    }
    const result = generateNotifications(favorites, cache)
    expect(result.map(n => n.id)).toEqual(['3', '1', '2'])
  })
})
