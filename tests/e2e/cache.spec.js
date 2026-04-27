import { test, expect } from '@playwright/test'
import { seedStorage, mockAllApis, overrideMock, makeCacheEntry } from './helpers.js'

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

/**
 * Patches window.fetch via addInitScript to intercept /api/movie/ calls,
 * recording each URL in window.__movieCalls and returning the mock data.
 * Returns async getters backed by page.evaluate() so they work in WebKit.
 *
 * Call BEFORE page.goto(). If called after mockAllApis(), it wraps the
 * mocked fetch and takes priority for movie calls.
 */
async function trackMovieCalls(page, mockData = null) {
  const data = mockData || { tmdb_id: 238, title: 'The Godfather', watch_providers: [NETFLIX] }
  await page.addInitScript(({ data }) => {
    window.__movieCalls = []
    const _prev = window.fetch ? window.fetch.bind(window) : fetch.bind(window)
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || String(input)
      if (url.includes('/api/movie/')) {
        window.__movieCalls.push(url)
        return Promise.resolve(new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }))
      }
      return _prev(input, init)
    }
  }, { data })

  return {
    getCount: () => page.evaluate(() => window.__movieCalls.length),
    getCalls: () => page.evaluate(() => window.__movieCalls),
    reset:    () => page.evaluate(() => { window.__movieCalls = [] })
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

  const tracker = await trackMovieCalls(page)
  await overrideMock(page, '/api/providers', { data: { results: [] } })

  await page.goto('/')
  await expect(page.locator('nav')).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(await tracker.getCount()).toBe(0)
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
  await overrideMock(page, '/api/providers', { data: { results: [] } })

  await page.goto('/')
  await expect(page.locator('nav')).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(await tracker.getCount()).toBe(2)
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
  await overrideMock(page, '/api/providers', { data: { results: [] } })

  await page.goto('/')
  await expect(page.locator('nav')).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(await tracker.getCount()).toBe(1)
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
  await overrideMock(page, '/api/providers', { data: { results: [] } })

  await page.goto('/')
  await expect(page.locator('nav')).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(await tracker.getCount()).toBe(1)
  expect((await tracker.getCalls())[0]).toContain('/api/movie/278')
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

  // mockAllApis first, then trackMovieCalls so the tracker wraps the mocked
  // fetch and takes priority for movie calls (addInitScript LIFO wrapping).
  await mockAllApis(page)
  const tracker = await trackMovieCalls(page, { tmdb_id: 278, title: 'The Shawshank Redemption', watch_providers: [] })

  await page.goto('/#/add')
  await expect(page.getByText('The Godfather').first()).toBeVisible()

  // Reset counter after initial load (genre films may trigger movie fetches)
  await tracker.reset()

  // Add Shawshank (tmdb_id 278, not in favorites, not in cache)
  await page.getByRole('button', { name: '+ Add to Favorites' }).nth(1).click()
  await expect(page.getByText('Added!')).toBeVisible()

  await page.waitForLoadState('networkidle')

  expect(await tracker.getCount()).toBe(1)
  expect((await tracker.getCalls())[0]).toContain('/api/movie/278')
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

  await overrideMock(page, '/api/movie/', { data: { tmdb_id: 238, title: 'The Godfather', watch_providers: [NETFLIX] } })
  await overrideMock(page, '/api/providers', { data: { results: [] } })

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
