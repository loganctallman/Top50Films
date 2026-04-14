import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  isCacheExpired,
  getCacheEntry,
  setCacheEntry,
  getExpiredOrMissingIds
} from './cacheLogic.js'

const TTL_MS = 24 * 60 * 60 * 1000

// Always use real timers after each test so mocks don't leak
afterEach(() => { vi.useRealTimers() })

const makeEntry = (hoursAgo = 0) => ({
  tmdb_id: 1,
  providers: [],
  fetched_at: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
})

describe('isCacheExpired', () => {
  it('returns true for null entry', () => {
    expect(isCacheExpired(null)).toBe(true)
  })

  it('returns true for entry with no fetched_at', () => {
    expect(isCacheExpired({ providers: [] })).toBe(true)
  })

  it('returns false for a fresh entry (just now)', () => {
    expect(isCacheExpired(makeEntry(0))).toBe(false)
  })

  it('returns false for a 23-hour-old entry', () => {
    expect(isCacheExpired(makeEntry(23))).toBe(false)
  })

  it('returns true for a 25-hour-old entry', () => {
    expect(isCacheExpired(makeEntry(25))).toBe(true)
  })

  it('returns true for exactly-expired entry (>24h)', () => {
    // Freeze time, build entry at t=0, then advance past TTL
    const base = new Date('2025-01-01T00:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(base)
    const entry = makeEntry(0) // fetched_at = base time
    vi.setSystemTime(new Date(base.getTime() + TTL_MS + 1))
    expect(isCacheExpired(entry)).toBe(true)
  })
})

describe('getCacheEntry', () => {
  it('returns the entry for a known id', () => {
    const cache = { 42: makeEntry(1) }
    expect(getCacheEntry(cache, 42)).toEqual(cache[42])
  })

  it('returns null for an unknown id', () => {
    expect(getCacheEntry({}, 99)).toBeNull()
  })
})

describe('setCacheEntry', () => {
  it('adds a new entry to the cache', () => {
    const providers = [{ provider_name: 'Netflix' }]
    const updated = setCacheEntry({}, 10, providers)
    expect(updated[10]).toBeDefined()
    expect(updated[10].tmdb_id).toBe(10)
    expect(updated[10].providers).toEqual(providers)
    expect(updated[10].fetched_at).toBeTruthy()
  })

  it('overwrites an existing entry', () => {
    const old = setCacheEntry({}, 10, [{ provider_name: 'Hulu' }])
    const fresh = setCacheEntry(old, 10, [{ provider_name: 'Netflix' }])
    expect(fresh[10].providers[0].provider_name).toBe('Netflix')
  })

  it('does not mutate the original cache', () => {
    const original = {}
    setCacheEntry(original, 10, [])
    expect(original[10]).toBeUndefined()
  })

  it('preserves other entries in the cache', () => {
    const cache = { 5: makeEntry(1) }
    const updated = setCacheEntry(cache, 10, [])
    expect(updated[5]).toEqual(cache[5])
    expect(updated[10]).toBeDefined()
  })

  it('records a recent fetched_at timestamp', () => {
    const frozen = new Date('2025-06-15T12:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(frozen)
    const updated = setCacheEntry({}, 1, [])
    const ts = new Date(updated[1].fetched_at).getTime()
    expect(ts).toBe(frozen.getTime())
  })
})

describe('getExpiredOrMissingIds', () => {
  it('returns all ids when cache is empty', () => {
    const favorites = [{ tmdb_id: 1 }, { tmdb_id: 2 }]
    expect(getExpiredOrMissingIds(favorites, {})).toEqual([1, 2])
  })

  it('returns only ids with missing or expired entries', () => {
    const favorites = [{ tmdb_id: 1 }, { tmdb_id: 2 }, { tmdb_id: 3 }]
    const cache = {
      1: makeEntry(1),   // fresh — excluded
      2: makeEntry(25),  // expired — included
      // 3 missing       — included
    }
    const result = getExpiredOrMissingIds(favorites, cache)
    expect(result).toContain(2)
    expect(result).toContain(3)
    expect(result).not.toContain(1)
  })

  it('returns empty array when all entries are fresh', () => {
    const favorites = [{ tmdb_id: 1 }, { tmdb_id: 2 }]
    const cache = { 1: makeEntry(0), 2: makeEntry(1) }
    expect(getExpiredOrMissingIds(favorites, cache)).toEqual([])
  })

  it('returns empty array for empty favorites', () => {
    expect(getExpiredOrMissingIds([], { 1: makeEntry(0) })).toEqual([])
  })
})
