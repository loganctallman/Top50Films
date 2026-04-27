/**
 * Shared helpers for E2E Playwright tests.
 *
 * Strategy:
 *  - page.addInitScript() seeds localStorage BEFORE the app boots so stores
 *    pick up the values during their initial writable() call.
 *  - context.route() intercepts API calls (vite preview has no serverless fns).
 *  - All fixture data is defined here so specs stay concise.
 */

// ---------------------------------------------------------------------------
// Fixture data (mirrors src/mocks/fixtures/*)
// ---------------------------------------------------------------------------

export const fixtures = {
  providers: {
    results: [
      { provider_id: 8,   provider_name: 'Netflix',      logo_path: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg' },
      { provider_id: 9,   provider_name: 'Amazon Prime', logo_path: '/emthp39XA2yngMLFSQ3Yf6GDFzk.jpg' },
      { provider_id: 73,  provider_name: 'Tubi TV',      logo_path: '/pZgeSWpfvD59x6b2mHQnGwAQbEr.jpg' },
      { provider_id: 337, provider_name: 'Disney Plus',  logo_path: '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg' }
    ]
  },

  genreResults: {
    results: [
      { tmdb_id: 238, title: 'The Godfather',           year: '1972', poster_path: '/path.jpg',  genre_ids: [18, 80], vote_average: 9.2, vote_count: 18000, watch_providers: [] },
      { tmdb_id: 278, title: 'The Shawshank Redemption',year: '1994', poster_path: '/path2.jpg', genre_ids: [18],     vote_average: 9.3, vote_count: 25000, watch_providers: [] }
    ],
    total_results: 2
  },

  suggestions: {
    results: [
      { tmdb_id: 238, title: 'The Godfather',           year: '1972', poster_path: '/path.jpg',  genre_ids: [18, 80], vote_average: 9.2, vote_count: 18000, watch_providers: [] },
      { tmdb_id: 278, title: 'The Shawshank Redemption',year: '1994', poster_path: '/path2.jpg', genre_ids: [18],     vote_average: 9.3, vote_count: 25000, watch_providers: [] }
    ]
  },

  searchResults: {
    results: [
      { tmdb_id: 238, title: 'The Godfather',           year: '1972', poster_path: '/3bhkrj58Vtu7enYsLlegkKXKHKY.jpg', genre_ids: [18, 80], vote_average: 9.2, vote_count: 18000, watch_providers: [] },
      { tmdb_id: 278, title: 'The Shawshank Redemption',year: '1994', poster_path: '/lyQBXzOQSuE59IsHyhrp0qIiPAz.jpg', genre_ids: [18],     vote_average: 9.3, vote_count: 25000, watch_providers: [] }
    ],
    total_results: 2, total_pages: 1, page: 1
  },

  searchEmpty: { results: [], total_results: 0, total_pages: 0, page: 1 },

  movieWithProviders: {
    tmdb_id: 238,
    title: 'The Godfather',
    year: '1972',
    poster_path: '/3bhkrj58Vtu7enYsLlegkKXKHKY.jpg',
    genre_ids: [18, 80],
    vote_average: 9.2,
    watch_providers: [
      { provider_id: 8,  provider_name: 'Netflix', logo_path: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg', streaming_type: 'flatrate', watch_link: null },
      { provider_id: 73, provider_name: 'Tubi TV', logo_path: '/pZgeSWpfvD59x6b2mHQnGwAQbEr.jpg', streaming_type: 'free',     watch_link: null }
    ]
  },

  movieNoProviders: {
    tmdb_id: 278,
    title: 'The Shawshank Redemption',
    year: '1994',
    poster_path: '/lyQBXzOQSuE59IsHyhrp0qIiPAz.jpg',
    genre_ids: [18],
    vote_average: 9.3,
    watch_providers: []
  },

  personSearch: {
    results: [
      { id: 1032, name: 'Francis Ford Coppola', known_for_department: 'Directing' },
      { id: 2710, name: 'Steven Spielberg',     known_for_department: 'Directing' }
    ]
  },

  personFilmography: {
    results: [
      { tmdb_id: 238, title: 'The Godfather',         year: '1972', poster_path: '/path.jpg',  genre_ids: [18, 80], vote_average: 9.2, vote_count: 18000, watch_providers: [] },
      { tmdb_id: 242, title: 'The Godfather Part II', year: '1974', poster_path: '/path2.jpg', genre_ids: [18, 80], vote_average: 9.0, vote_count: 11000, watch_providers: [] }
    ],
    total_results: 2
  },

  // A single favorite film for seeding
  favoriteFilm: {
    tmdb_id: 238,
    title: 'The Godfather',
    year: '1972',
    poster_path: '/3bhkrj58Vtu7enYsLlegkKXKHKY.jpg',
    genre_ids: [18, 80],
    vote_average: 9.2,
    added_at: new Date('2024-01-01T00:00:00.000Z').toISOString()
  }
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

/**
 * Seeds localStorage before the page loads.
 * Call BEFORE page.goto() — it uses addInitScript which runs at page start.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} data  Keys map to localStorage keys:
 *   - onboardingComplete {boolean}
 *   - favorites          {Array}
 *   - streamingPrefs     {Object}
 *   - streamingCache     {Object}
 *   - trialNotes         {Array}
 */
export async function seedStorage(page, data = {}) {
  const storageMap = {
    onboardingComplete: 'onboarding_complete',
    favorites:          'tmdb_favorites',
    streamingPrefs:     'streaming_prefs',
    streamingCache:     'streaming_cache',
    trialNotes:         'trial_notes'
  }

  const entries = Object.entries(data).map(([k, v]) => [storageMap[k] || k, v])

  await page.addInitScript((entries) => {
    for (const [key, value] of entries) {
      localStorage.setItem(key, JSON.stringify(value))
    }
  }, entries)
}

/**
 * Convenience: seed onboardingComplete = true (skips onboarding screen).
 */
export async function skipOnboarding(page) {
  await seedStorage(page, { onboardingComplete: true })
}

// ---------------------------------------------------------------------------
// API route mocking helpers
// ---------------------------------------------------------------------------

/**
 * Mocks all standard API routes used by the app.
 * Call after page creation, before page.goto().
 *
 * Individual specs can override specific routes by calling page.context().route()
 * AFTER this function — Playwright uses the most-recently-registered handler.
 */
export async function mockAllApis(page) {
  const ctx = page.context()

  // Use context.route() rather than page.route() so handlers are registered at
  // browser-context level. This avoids a WebKit timing race where fetch() calls
  // fired in onMount during page.goto() execute before page-level CDP intercepts
  // are established, causing requests to slip through to the vite preview server.
  await ctx.route('**/api/providers', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.providers) })
  )

  await ctx.route('**/api/genre-top50**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.genreResults) })
  )

  await ctx.route('**/api/search**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.searchResults) })
  )

  await ctx.route('**/api/suggestions**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.suggestions) })
  )

  await ctx.route('**/api/movie/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.movieWithProviders) })
  )

  // Register person/:id BEFORE person/search so that the more-specific
  // person/search route (registered last) takes priority (Playwright LIFO).
  await ctx.route('**/api/person/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.personFilmography) })
  )

  await ctx.route('**/api/person/search**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.personSearch) })
  )
}

/**
 * Builds a fresh streaming-cache entry (not expired) for a given film id and providers array.
 */
export function makeCacheEntry(tmdb_id, providers) {
  return {
    tmdb_id,
    providers,
    fetched_at: new Date().toISOString()
  }
}
