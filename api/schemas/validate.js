import { createRequire } from 'module'
import Ajv from 'ajv'

const require = createRequire(import.meta.url)
const ajv = new Ajv({ allErrors: true })

// Reusable definitions must be registered before response schemas that $ref them
;[
  'film',
  'watch-provider',
  'providers-response',
  'genre-top50-response',
  'search-response',
  'suggestions-response',
  'movie-response',
  'person-search-response',
  'person-filmography-response'
].forEach(name => ajv.addSchema(require(`./${name}.json`)))

/**
 * Validates data against a registered schema.
 * Throws with a descriptive message on violation so test output is actionable.
 */
export function validate(schemaId, data) {
  const valid = ajv.validate(schemaId, data)
  if (!valid) {
    const errors = ajv.errors
      .map(e => `${e.instancePath || '(root)'} ${e.message}`)
      .join('; ')
    throw new Error(`Schema "${schemaId}" violated: ${errors}`)
  }
}

export const SCHEMAS = {
  PROVIDERS:           'providers-response',
  GENRE_TOP50:         'genre-top50-response',
  SEARCH:              'search-response',
  SUGGESTIONS:         'suggestions-response',
  MOVIE:               'movie-response',
  PERSON_SEARCH:       'person-search-response',
  PERSON_FILMOGRAPHY:  'person-filmography-response'
}
