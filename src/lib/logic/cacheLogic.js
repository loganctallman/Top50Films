const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export function isCacheExpired(entry) {
  if (!entry || !entry.fetched_at) return true
  return Date.now() - new Date(entry.fetched_at).getTime() > TTL_MS
}

export function getCacheEntry(cache, tmdbId) {
  return cache[tmdbId] || null
}

export function setCacheEntry(cache, tmdbId, providers) {
  return {
    ...cache,
    [tmdbId]: {
      tmdb_id: tmdbId,
      providers,
      fetched_at: new Date().toISOString()
    }
  }
}

/**
 * Returns the tmdb_ids from favorites whose cache entries are missing or expired.
 */
export function getExpiredOrMissingIds(favorites, cache) {
  return favorites
    .map(f => f.tmdb_id)
    .filter(id => isCacheExpired(cache[id]))
}
