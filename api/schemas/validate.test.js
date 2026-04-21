import { describe, it, expect } from 'vitest'
import { validate, SCHEMAS } from './validate.js'

// ---------------------------------------------------------------------------
// validate() error-path behaviour
// ---------------------------------------------------------------------------

describe('validate() — error paths', () => {
  it('throws when data violates a schema', () => {
    // {} is missing all required fields for search-response
    expect(() => validate(SCHEMAS.SEARCH, {})).toThrow()
  })

  it('thrown message includes the schema ID', () => {
    expect(() => validate(SCHEMAS.SEARCH, {})).toThrow(/Schema "search-response" violated:/)
  })

  it('thrown message includes "(root)" when the violation is at the top level', () => {
    // A missing required property at the root produces an empty instancePath
    expect(() => validate(SCHEMAS.SEARCH, {})).toThrow(/\(root\)/)
  })

  it('thrown message includes a field path when a nested field fails', () => {
    const badFilm = { tmdb_id: 'not-a-number', title: 'X', genre_ids: [], vote_average: 8, watch_providers: [] }
    const data = { results: [badFilm], total_results: 1, total_pages: 1, page: 1 }
    expect(() => validate(SCHEMAS.SEARCH, data)).toThrow(/\/results\/0\/tmdb_id/)
  })

  it('does not throw for valid data', () => {
    const data = { results: [], total_results: 0, total_pages: 0, page: 1 }
    expect(() => validate(SCHEMAS.SEARCH, data)).not.toThrow()
  })

  it('throws when data is null', () => {
    expect(() => validate(SCHEMAS.SEARCH, null)).toThrow()
  })

  it('throws when data is undefined', () => {
    expect(() => validate(SCHEMAS.SEARCH, undefined)).toThrow()
  })

  it('throws when schema ID is not registered', () => {
    // AJV throws its own error for unresolved schema IDs — different from
    // our "violated" message format
    expect(() => validate('nonexistent-schema', {})).toThrow()
    expect(() => validate('nonexistent-schema', {})).not.toThrow(/Schema "nonexistent-schema" violated:/)
  })
})

// ---------------------------------------------------------------------------
// SCHEMAS constant — exhaustiveness
// Every value in SCHEMAS must resolve to a registered AJV schema.
// Passing {} to a registered schema always throws "violated" (schema found,
// data invalid). An unregistered schema would throw a different AJV error.
// ---------------------------------------------------------------------------

describe('SCHEMAS constant — exhaustiveness', () => {
  it('every SCHEMAS value resolves to a registered AJV schema', () => {
    for (const schemaId of Object.values(SCHEMAS)) {
      expect(() => validate(schemaId, {})).toThrow(new RegExp(`Schema "${schemaId}" violated:`))
    }
  })
})
