export const MAX_FAVORITES = 50

export function isDuplicate(favorites, tmdbId) {
  return favorites.some(f => f.tmdb_id === tmdbId)
}

export function canAddFavorite(favorites) {
  return favorites.length < MAX_FAVORITES
}

/**
 * @returns {{ success: true, favorites: Array } | { success: false, reason: 'duplicate' | 'full' }}
 */
export function addFavorite(favorites, film) {
  if (isDuplicate(favorites, film.tmdb_id)) {
    return { success: false, reason: 'duplicate' }
  }
  if (!canAddFavorite(favorites)) {
    return { success: false, reason: 'full' }
  }
  const entry = {
    tmdb_id: film.tmdb_id,
    title: film.title,
    year: film.year,
    poster_path: film.poster_path,
    genre_ids: film.genre_ids || [],
    added_at: new Date().toISOString()
  }
  return { success: true, favorites: [...favorites, entry] }
}

export function removeFavorite(favorites, tmdbId) {
  return favorites.filter(f => f.tmdb_id !== tmdbId)
}
