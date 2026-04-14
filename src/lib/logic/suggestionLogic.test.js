import { describe, it, expect } from 'vitest'
import { aggregateGenreIds } from './suggestionLogic.js'

const makeFilm = (genreIds) => ({ genre_ids: genreIds })

describe('aggregateGenreIds', () => {
  it('returns empty array for empty favorites', () => {
    expect(aggregateGenreIds([])).toEqual([])
  })

  it('returns top genre when all films share one genre', () => {
    const favorites = [makeFilm([18]), makeFilm([18]), makeFilm([18])]
    expect(aggregateGenreIds(favorites, 1)).toEqual([18])
  })

  it('returns genres sorted by frequency descending', () => {
    const favorites = [
      makeFilm([18, 80]),  // 18 appears twice, 80 once
      makeFilm([18, 28]),  // 28 once
      makeFilm([80])
    ]
    // 18: 2, 80: 2, 28: 1 — but 18 processed first, so order may vary at same count
    const result = aggregateGenreIds(favorites, 3)
    expect(result).toContain(18)
    expect(result).toContain(80)
    expect(result).toContain(28)
    expect(result[result.length - 1]).toBe(28) // least frequent last
  })

  it('defaults topN to 3', () => {
    const favorites = [
      makeFilm([1, 2, 3, 4, 5])
    ]
    const result = aggregateGenreIds(favorites)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('respects custom topN', () => {
    const favorites = [makeFilm([1, 2, 3, 4, 5])]
    expect(aggregateGenreIds(favorites, 5)).toHaveLength(5)
    expect(aggregateGenreIds(favorites, 1)).toHaveLength(1)
  })

  it('handles films with no genre_ids gracefully', () => {
    const favorites = [{ title: 'No genres' }, makeFilm([18])]
    const result = aggregateGenreIds(favorites, 3)
    expect(result).toEqual([18])
  })

  it('returns numeric ids (not strings)', () => {
    const favorites = [makeFilm([18, 28])]
    const result = aggregateGenreIds(favorites)
    result.forEach(id => expect(typeof id).toBe('number'))
  })

  it('most frequent genre is first', () => {
    const favorites = [
      makeFilm([28]),
      makeFilm([28]),
      makeFilm([28]),
      makeFilm([18]),
      makeFilm([18]),
      makeFilm([80])
    ]
    // 28: 3, 18: 2, 80: 1
    const result = aggregateGenreIds(favorites, 3)
    expect(result[0]).toBe(28)
    expect(result[1]).toBe(18)
    expect(result[2]).toBe(80)
  })

  it('does not return more ids than genres that exist', () => {
    const favorites = [makeFilm([18, 28])]
    const result = aggregateGenreIds(favorites, 10)
    expect(result).toHaveLength(2)
  })
})
