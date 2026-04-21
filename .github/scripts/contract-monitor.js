/**
 * TMDB Upstream Contract Monitor
 *
 * Calls the real TMDB API with a minimal set of known-stable parameters,
 * then passes the raw response through each handler's normalisation logic.
 * Validates the normalised output against our JSON Schemas.
 *
 * Exits with code 1 if any schema violation is found so the CI workflow
 * can open a GitHub Issue. Exits 0 on full success.
 *
 * Usage:
 *   TMDB_API_KEY=<key> node .github/scripts/contract-monitor.js
 */

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import Ajv from 'ajv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require   = createRequire(import.meta.url)
const rootDir   = join(__dirname, '..', '..')

// ---------------------------------------------------------------------------
// Schema setup
// ---------------------------------------------------------------------------

const ajv = new Ajv({ allErrors: true })
;[
  'film', 'watch-provider',
  'providers-response', 'genre-top50-response', 'search-response',
  'suggestions-response', 'movie-response',
  'person-search-response', 'person-filmography-response'
].forEach(name => ajv.addSchema(require(join(rootDir, 'api/schemas', `${name}.json`))))

function validate(schemaId, data) {
  const valid = ajv.validate(schemaId, data)
  if (!valid) {
    return ajv.errors.map(e => `  ${e.instancePath || '(root)'} ${e.message}`).join('\n')
  }
  return null
}

// ---------------------------------------------------------------------------
// Handler imports (use real fetch — no mocking)
// ---------------------------------------------------------------------------

const { default: providersHandler }    = await import(join(rootDir, 'api/providers.js'))
const { default: genreTop50Handler }   = await import(join(rootDir, 'api/genre-top50.js'))
const { default: searchHandler }       = await import(join(rootDir, 'api/search.js'))
const { default: suggestionsHandler }  = await import(join(rootDir, 'api/suggestions.js'))
const { default: movieHandler }        = await import(join(rootDir, 'api/movie/[id].js'))
const { default: personSearchHandler } = await import(join(rootDir, 'api/person/search.js'))
const { default: personIdHandler }     = await import(join(rootDir, 'api/person/[id].js'))

// ---------------------------------------------------------------------------
// Minimal mock res (captures handler output without an HTTP server)
// ---------------------------------------------------------------------------

function mockRes() {
  const res = { _status: null, _body: null }
  res.status = (code) => { res._status = code; return res }
  res.json   = (data) => { res._body  = data; return res }
  return res
}

// ---------------------------------------------------------------------------
// Contract checks
// Known-stable TMDB IDs: The Godfather (238), Coppola (1032), Drama genre (18)
// ---------------------------------------------------------------------------

const checks = [
  {
    name: 'GET /api/providers',
    run: async () => {
      const res = mockRes()
      await providersHandler({ query: {} }, res)
      return { status: res._status, body: res._body, schema: 'providers-response' }
    }
  },
  {
    name: 'GET /api/genre-top50 (Drama)',
    run: async () => {
      const res = mockRes()
      await genreTop50Handler({ query: { genre_id: '18' } }, res)
      return { status: res._status, body: res._body, schema: 'genre-top50-response' }
    }
  },
  {
    name: 'GET /api/search?query=godfather',
    run: async () => {
      const res = mockRes()
      await searchHandler({ query: { query: 'godfather' } }, res)
      return { status: res._status, body: res._body, schema: 'search-response' }
    }
  },
  {
    name: 'GET /api/suggestions?genre_ids=18',
    run: async () => {
      const res = mockRes()
      await suggestionsHandler({ query: { genre_ids: '18' } }, res)
      return { status: res._status, body: res._body, schema: 'suggestions-response' }
    }
  },
  {
    name: 'GET /api/movie/238 (The Godfather)',
    run: async () => {
      const res = mockRes()
      await movieHandler({ query: { id: '238' } }, res)
      return { status: res._status, body: res._body, schema: 'movie-response' }
    }
  },
  {
    name: 'GET /api/person/search?query=coppola',
    run: async () => {
      const res = mockRes()
      await personSearchHandler({ query: { query: 'coppola' } }, res)
      return { status: res._status, body: res._body, schema: 'person-search-response' }
    }
  },
  {
    name: 'GET /api/person/1032 (Francis Ford Coppola)',
    run: async () => {
      const res = mockRes()
      await personIdHandler({ query: { id: '1032' } }, res)
      return { status: res._status, body: res._body, schema: 'person-filmography-response' }
    }
  }
]

// ---------------------------------------------------------------------------
// Run all checks
// ---------------------------------------------------------------------------

if (!process.env.TMDB_API_KEY) {
  console.error('TMDB_API_KEY is not set')
  process.exit(1)
}

const failures = []

for (const check of checks) {
  process.stdout.write(`Checking ${check.name} ... `)
  try {
    const { status, body, schema } = await check.run()

    if (status !== 200) {
      failures.push(`${check.name}: handler returned HTTP ${status}`)
      console.log('FAIL')
      continue
    }

    const errors = validate(schema, body)
    if (errors) {
      failures.push(`${check.name}: schema "${schema}" violated\n${errors}`)
      console.log('FAIL')
    } else {
      console.log('OK')
    }
  } catch (err) {
    failures.push(`${check.name}: unexpected error — ${err.message}`)
    console.log('ERROR')
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n${failures.length} contract violation(s) found:\n`)
  failures.forEach((f, i) => console.error(`${i + 1}. ${f}\n`))

  // Write failures to a file so the workflow can read them for the GitHub Issue body
  import('fs').then(({ writeFileSync }) => {
    writeFileSync('contract-failures.txt', failures.join('\n\n'))
  })

  process.exit(1)
} else {
  console.log('\nAll contracts satisfied.')
  process.exit(0)
}
