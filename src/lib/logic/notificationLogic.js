/**
 * Generates notification entries for favorites that are available on
 * a streaming service the user subscribes to.
 *
 * Returns one notification per film (the first matching subscribed provider).
 *
 * @param {Array}  favorites      - tmdb_favorites array
 * @param {Object} streamingCache - keyed by tmdb_id
 * @param {Object} streamingPrefs - { [provider_id]: true }
 * @returns {Array} notifications
 */
export function generateNotifications(favorites, streamingCache, streamingPrefs) {
  const notifications = []

  for (const film of favorites) {
    const entry = streamingCache[film.tmdb_id]
    if (!entry || !Array.isArray(entry.providers)) continue

    const matchedProvider = entry.providers.find(p => streamingPrefs[p.provider_id])
    if (matchedProvider) {
      notifications.push({
        id: `${film.tmdb_id}-${matchedProvider.provider_id}`,
        film,
        provider: matchedProvider
      })
    }
  }

  return notifications
}
