/**
 * Generates notification entries for ALL favorited films that have any
 * streaming availability, regardless of the user's service subscriptions.
 *
 * Subscribed services are still highlighted in the UI via streamingPrefs,
 * but do not filter which films appear.
 *
 * @param {Array}  favorites      - tmdb_favorites array
 * @param {Object} streamingCache - keyed by tmdb_id
 * @returns {Array} notifications
 */
export function generateNotifications(favorites, streamingCache) {
  const notifications = []

  for (const film of favorites) {
    const entry = streamingCache[film.tmdb_id]
    if (!entry || !Array.isArray(entry.providers) || entry.providers.length === 0) continue

    notifications.push({
      id: String(film.tmdb_id),
      film,
      provider: entry.providers[0],  // first provider shown by default
      providers: entry.providers      // all providers for expand/collapse
    })
  }

  return notifications
}
