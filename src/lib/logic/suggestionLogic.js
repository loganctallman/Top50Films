/**
 * Aggregates genre IDs from favorites by frequency and returns the top N.
 *
 * @param {Array}  favorites - tmdb_favorites array
 * @param {number} topN      - how many genre ids to return (default 3)
 * @returns {number[]} sorted genre ids, most frequent first
 */
export function aggregateGenreIds(favorites, topN = 3) {
  const counts = {}
  for (const film of favorites) {
    for (const genreId of (film.genre_ids || [])) {
      counts[genreId] = (counts[genreId] || 0) + 1
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([id]) => Number(id))
}
