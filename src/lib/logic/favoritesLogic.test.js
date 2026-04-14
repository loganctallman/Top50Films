import { describe, it, expect } from 'vitest'
import {
  MAX_FAVORITES,
  isDuplicate,
  canAddFavorite,
  addFavorite,
  removeFavorite
} from './favoritesLogic.js'

const makeFilm = (id, overrides = {}) => ({
  tmdb_id: id,
  title: `Film ${id}`,
  year: '2000',
  poster_path: `/poster${id}.jpg`,
  genre_ids: [18],
  ...overrides
})

describe('isDuplicate', () => {
  it('returns false for empty list', () => {
    expect(isDuplicate([], 1)).toBe(false)
  })

  it('returns true when tmdb_id already exists', () => {
    expect(isDuplicate([makeFilm(1)], 1)).toBe(true)
  })

  it('returns false when tmdb_id does not exist', () => {
    expect(isDuplicate([makeFilm(1), makeFilm(2)], 3)).toBe(false)
  })
})

describe('canAddFavorite', () => {
  it('returns true when list is empty', () => {
    expect(canAddFavorite([])).toBe(true)
  })

  it('returns true when list has 49 entries', () => {
    const list = Array.from({ length: 49 }, (_, i) => makeFilm(i + 1))
    expect(canAddFavorite(list)).toBe(true)
  })

  it('returns false when list is at MAX_FAVORITES (50)', () => {
    const list = Array.from({ length: MAX_FAVORITES }, (_, i) => makeFilm(i + 1))
    expect(canAddFavorite(list)).toBe(false)
  })
})

describe('addFavorite', () => {
  it('adds a film and returns success with updated list', () => {
    const result = addFavorite([], makeFilm(1))
    expect(result.success).toBe(true)
    expect(result.favorites).toHaveLength(1)
    expect(result.favorites[0].tmdb_id).toBe(1)
    expect(result.favorites[0].title).toBe('Film 1')
  })

  it('includes added_at ISO timestamp on new entry', () => {
    const before = Date.now()
    const result = addFavorite([], makeFilm(1))
    const ts = new Date(result.favorites[0].added_at).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
  })

  it('preserves existing favorites (immutable)', () => {
    const existing = [makeFilm(1)]
    const result = addFavorite(existing, makeFilm(2))
    expect(result.success).toBe(true)
    expect(result.favorites).toHaveLength(2)
    expect(existing).toHaveLength(1) // original untouched
  })

  it('defaults genre_ids to [] when not provided', () => {
    const film = { tmdb_id: 99, title: 'No Genres', year: '2001', poster_path: '/p.jpg' }
    const result = addFavorite([], film)
    expect(result.favorites[0].genre_ids).toEqual([])
  })

  it('returns duplicate failure when film already in list', () => {
    const existing = [makeFilm(1)]
    const result = addFavorite(existing, makeFilm(1))
    expect(result.success).toBe(false)
    expect(result.reason).toBe('duplicate')
  })

  it('returns full failure when list is at capacity', () => {
    const full = Array.from({ length: MAX_FAVORITES }, (_, i) => makeFilm(i + 1))
    const result = addFavorite(full, makeFilm(MAX_FAVORITES + 1))
    expect(result.success).toBe(false)
    expect(result.reason).toBe('full')
  })

  it('checks duplicate before full (duplicate wins)', () => {
    const full = Array.from({ length: MAX_FAVORITES }, (_, i) => makeFilm(i + 1))
    // film 1 is already in the full list
    const result = addFavorite(full, makeFilm(1))
    expect(result.reason).toBe('duplicate')
  })
})

describe('removeFavorite', () => {
  it('removes the film with matching tmdb_id', () => {
    const list = [makeFilm(1), makeFilm(2), makeFilm(3)]
    const result = removeFavorite(list, 2)
    expect(result).toHaveLength(2)
    expect(result.find(f => f.tmdb_id === 2)).toBeUndefined()
  })

  it('returns unchanged list when id is not found', () => {
    const list = [makeFilm(1), makeFilm(2)]
    const result = removeFavorite(list, 99)
    expect(result).toHaveLength(2)
  })

  it('returns empty array when removing the only item', () => {
    const result = removeFavorite([makeFilm(1)], 1)
    expect(result).toEqual([])
  })

  it('does not mutate the original array', () => {
    const list = [makeFilm(1), makeFilm(2)]
    removeFavorite(list, 1)
    expect(list).toHaveLength(2)
  })
})
