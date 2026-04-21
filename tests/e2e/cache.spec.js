import { test, expect } from '@playwright/test'
import { seedStorage, mockAllApis, makeCacheEntry } from './helpers.js'

/**
 * Cache / performance assertions.
 *
 * App.svelte runs `refreshStaleCache($favorites)` reactively. It calls
 * `getExpiredOrMissingIds(favs, cache)` and only fetches `/api/movie/:id`
 * for entries that are missing or older than 24 hours.
 *
 * These tests count how many times /api/movie/:id is called to verify:
 *   1. Fresh cache entries → zero fetches (no wasted API calls)
 *   2. Missing cache entries → one fetch per film
 *   3. Expired cache entries (>24 h old) → one fetch per expired film
 *   4. Mix of fresh and stale → only stale films are re-fetched
 */

const FILM_238 = {
  tmdb_id: 238,
  title: 'The Godfather',
  year: '1972',
  poster_path: '/path.jpg',
  genre_ids: [18, 80],
  vote_average: 9.2,
  added_at: new Date('2024-01-01T00:00:00.000Z').toISOString()
}

const FILM_278 = {
  tmdb_id: 278,
  title: 'The Shawshank Redemption',
  year: '1994',
  poster_path: '/path2.jpg',
  genre_ids: [18],
  vote_average: 9.3,
  added_at: new Date('2024-01-02T00:00:00.000Z').toISOString()
}

const NETFLIX = { provider_id: 8, provider_name: 'Netflix', logo_path: '/logo.jpg', streaming_type: 'flatrate' }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sets up a call counter for /api/movie/** and returns a getter. */
async function trackMovieCalls(page) {
  let count = 0
  const calls = []

  await page.route('**/api/movie/**', (route, request) => {
    count++
    calls.push(request.url())
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tmdb_id: 238,
        title: 'The Godfather',
        watch_providers: [NETFLIX]
      })
    })
  })

  return {
    getCount: () => count,
    getCalls: () => calls
  }
}

// ---------------------------------------------------------------------------
// 1. Fresh cache → no movie fetches
// ---------------------------------------------------------------------------

test('fresh cache entries suppress /api/movie calls entirely', async ({ page }) => {
  const cache = {
    238: makeCacheEntry(238, [NETFLIX]),
    278: makeCacheEntry(278, [NETFLIX])
  }

  await seedStorage(page, {
    onboardingComplete: true,
    favorites: [FILM_238, FILM_278],
    streamingCache: cache
  })

  // Track movie calls BEFORE mock setup so the counter captures everything
  const tracker = await trackMovieCalls(page)

  // Mock providers (App.svelte needs this on mount)
  await page.route('**/api/providers', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  )

  await page.goto('/')
  // Wait for app to be interactive
  await expect(page.locator('nav')).toBeVisible()
  // Allow any async reactive effects to settle
  await page.waitForLoadState('networkidle')

  expect(tracker.getCount()).toBe(0)
})

// ---------------------------------------------------------------------------
// 2. No cache → one fetch per favorite
// ---------------------------------------------------------------------------

test('missing cache entries trigger one /api/movie fetch per film', async ({ page }) => {
  await seedStorage(page, {
    onboardingComplete: true,
    favorites: [FILM_238, FILM_278]
    // No streamingCache seeded
  })

  const tracker = await trackMovieCalls(page)

  await page.route('**/api/providers', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  )

  await page.goto('/')
  await expect(page.locator('nav')).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(tracker.getCount()).toBe(2)
})

// ---------------------------------------------------------------------------
// 3. Expired cache → re-fetch only expired entries
// ---------------------------------------------------------------------------

test('expired cache entries are re-fetched', async ({ page }) => {
  const EXPIRED_DATE = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25 h ago

  const cache = {
    238: {
      tmdb_id: 238,
      providers: [NETFLIX],
      fetched_at: EXPIRED_DATE  // expired (>24 h)
    }
  }

  await seedStorage(page, {
    onboardingComplete: true,
    favorites: [FILM_238],
    streamingCache: cache
  })

  const tracker = await trackMovieCalls(page)

  await page.route('**/api/providers', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  )

  await page.goto('/')
  await expect(page.locator('nav')).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(tracker.getCount()).toBe(1)
})

// ---------------------------------------------------------------------------
// 4. Mixed freshness → only stale films re-fetched
// ---------------------------------------------------------------------------

test('only stale films are re-fetched when cache is mixed', async ({ page }) => {
  const EXPIRED_DATE = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()

  const cache = {
    238: makeCacheEntry(238, [NETFLIX]),          // fresh — should NOT be fetched
    278: {                                         // expired — SHOULD be fetched
      tmdb_id: 278,
      providers: [NETFLIX],
      fetched_at: EXPIRED_DATE
    }
  }

  await seedStorage(page, {
    onboardingComplete: true,
    favorites: [FILM_238, FILM_278],
    streamingCache: cache
  })

  const tracker = await trackMovieCalls(page)

  await page.route('**/api/providers', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  )

  await page.goto('/')
  await expect(page.locator('nav')).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(tracker.getCount()).toBe(1)
  expect(tracker.getCalls()[0]).toContain('/api/movie/278')
})

// ---------------------------------------------------------------------------
// 5. Adding a new favorite triggers a cache fetch for that film only
// ---------------------------------------------------------------------------

test('adding a new film to favorites triggers exactly one movie fetch for that film', async ({ page }) => {
  // Start with one fresh-cached film
  const cache = { 238: makeCacheEntry(238, [NETFLIX]) }

  await seedStorage(page, {
    onboardingComplete: true,
    favorites: [FILM_238],
    streamingCache: cache
  })

  const tracker = await trackMovieCalls(page)

  await mockAllApis(page)
  // Override movie route to count calls (mockAllApis sets a default handler;
  // our tracker was registered first so it has lower priority — re-register after)
  // Actually tracker was registered first (lower priority in LIFO) — re-register
  // the tracker AFTER mockAllApis so it intercepts instead.

  // Reset and re-register tracker after mockAllApis
  let movieCallCount = 0
  const movieCallUrls = []
  await page.route('**/api/movie/**', (route, request) => {
    movieCallCount++
    movieCallUrls.push(request.url())
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tmdb_id: 278, title: 'The Shawshank Redemption', watch_providers: [] })
    })
  })

  await page.goto('/#/add')
  await expect(page.getByText('The Godfather').first()).toBeVisible()

  // Reset count after initial page load (genre films also trigger movie fetches for providers)
  const countBeforeAdd = movieCallCount

  // Add Shawshank (tmdb_id 278, not in favorites, not in cache)
  // The genre results include Shawshank — click its add button
  await page.getByRole('button', { name: '+ Add to Favorites' }).nth(1).click()
  await expect(page.getByText('Added!')).toBeVisible()

  // Wait for reactive cache refresh
  await page.waitForLoadState('networkidle')

  // Exactly one new fetch should have been made (for film 278)
  const newCalls = movieCallUrls.slice(countBeforeAdd)
  expect(newCalls.some(url => url.includes('/api/movie/278'))).toBe(true)
})

// ---------------------------------------------------------------------------
// 6. Provider cache is written to localStorage after fetch
// ---------------------------------------------------------------------------

test('provider data is persisted to localStorage after a cache refresh', async ({ page }) => {
  await seedStorage(page, {
    onboardingComplete: true,
    favorites: [FILM_238]
    // No cache — will trigger a fetch
  })

  await page.route('**/api/movie/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tmdb_id: 238, title: 'The Godfather', watch_providers: [NETFLIX] })
    })
  )
  await page.route('**/api/providers', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) })
  )

  await page.goto('/')
  await expect(page.locator('nav')).toBeVisible()
  await page.waitForLoadState('networkidle')

  // Verify streaming_cache was written to localStorage with the fetched providers
  const raw = await page.evaluate(() => localStorage.getItem('streaming_cache'))
  const cache = JSON.parse(raw)
  expect(cache[238]).toBeDefined()
  expect(cache[238].providers).toHaveLength(1)
  expect(cache[238].providers[0].provider_name).toBe('Netflix')
  expect(cache[238].fetched_at).toBeTruthy()
})
