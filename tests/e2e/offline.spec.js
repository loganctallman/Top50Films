import { test, expect } from '@playwright/test'
import { skipOnboarding, seedStorage, mockAllApis, overrideMock, makeCacheEntry } from './helpers.js'

/**
 * Offline / degraded-network tests.
 *
 * Strategy:
 *  - For pages that depend on localStorage only (My List, Notifications) we
 *    use context.setOffline(true) — these pages never need network after the
 *    initial app shell load.
 *  - For pages that make API calls on mount (Add to List) we use context.route()
 *    to abort requests, which is more reliable than context.setOffline in
 *    Playwright headless (where the SW may not have had time to cache assets).
 *
 * Note: AddToList uses Promise.allSettled for genre/search fetches, so when
 * those fail the UI shows "No results for this genre right now." (not
 * "Couldn't connect" — that only appears for non-allSettled paths).
 */

// ---------------------------------------------------------------------------
// My List — reads localStorage, no network needed
// ---------------------------------------------------------------------------

test.describe('Offline — My List still shows cached favorites', () => {
  test('favorites seeded in localStorage are visible while offline', async ({ context, page }) => {
    const film = {
      tmdb_id: 238,
      title: 'The Godfather',
      year: '1972',
      poster_path: '/path.jpg',
      genre_ids: [18, 80],
      vote_average: 9.2,
      added_at: new Date('2024-01-01T00:00:00.000Z').toISOString()
    }

    await seedStorage(page, { onboardingComplete: true, favorites: [film] })
    await mockAllApis(page)

    // Load while online
    await page.goto('/#/my-list')
    await expect(page.getByText('The Godfather')).toBeVisible()

    // Go offline — My List reads from localStorage only.
    // Use evaluate instead of page.goto() here: WebKit rejects full page
    // navigations while offline, even for hash routes.
    await context.setOffline(true)
    await page.evaluate(() => { location.hash = location.hash })

    await expect(page.getByText('The Godfather')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Notifications — reads localStorage + streamingCache, no network needed
// ---------------------------------------------------------------------------

test.describe('Offline — Notifications shows cached notifications', () => {
  test('notifications generated from seeded cache are visible while offline', async ({ context, page }) => {
    const film = {
      tmdb_id: 238,
      title: 'The Godfather',
      year: '1972',
      poster_path: '/path.jpg',
      genre_ids: [18, 80],
      vote_average: 9.2,
      added_at: new Date('2024-01-01T00:00:00.000Z').toISOString()
    }
    const cache = {
      238: makeCacheEntry(238, [
        { provider_id: 8, provider_name: 'Netflix', logo_path: '/logo.jpg', streaming_type: 'flatrate' }
      ])
    }

    await seedStorage(page, {
      onboardingComplete: true,
      favorites: [film],
      streamingCache: cache
    })
    await mockAllApis(page)

    // Load while online
    await page.goto('/#/notifications')
    await expect(page.getByText('The Godfather')).toBeVisible()

    // Go offline — notifications are computed from localStorage.
    // Use evaluate instead of page.goto() here: WebKit rejects full page
    // navigations while offline, even for hash routes.
    await context.setOffline(true)
    await page.evaluate(() => { location.hash = location.hash })

    await expect(page.getByText('The Godfather')).toBeVisible()
    await expect(page.getByText('Netflix')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Add to List — simulated network failure via context.route() abort
// ---------------------------------------------------------------------------

test.describe('Offline — Add to List degrades gracefully when API fails', () => {
  test('shows no-results state when genre API calls are aborted', async ({ page }) => {
    await skipOnboarding(page)
    await overrideMock(page, '/api/providers', { data: { results: [] } })
    await overrideMock(page, '/api/genre-top50', { abort: true })
    await page.goto('/#/add')
    // allSettled captures the abort as a rejection → empty results → 'no-results' state
    await expect(page.getByText('No results for this genre right now.')).toBeVisible()
  })

  test('shows no-results state when search API calls are aborted', async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    await overrideMock(page, '/api/search', { abort: true })
    await page.goto('/#/add')
    await page.getByRole('searchbox').fill('godfather')
    // allSettled captures abort as rejection → empty results → 'no-results' state
    await expect(page.getByText('No films found for that search.')).toBeVisible()
  })

  test('shows network error when person search API calls are aborted', async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    // Track unhandled rejections — a leaked promise rejection means the app's catch
    // block did not handle the TypeError thrown by overrideMock's abort: true path.
    await page.addInitScript(() => {
      window.__unhandledRejections = []
      window.addEventListener('unhandledrejection', e => {
        window.__unhandledRejections.push(e.reason?.message || String(e.reason))
      })
    })
    // person/search uses direct await (not allSettled) → catch fires → 'network' state
    await overrideMock(page, '/api/person/search', { abort: true })
    await page.goto('/#/add')
    await page.getByRole('button', { name: 'Film', exact: true }).click()
    await page.getByText('Director / Actor').click()
    await page.getByRole('searchbox').fill('coppola')
    await expect(page.getByText("Couldn't connect — check your internet connection.")).toBeVisible()
    // Confirm the TypeError was caught by the app, not leaked as an unhandled rejection
    const unhandled = await page.evaluate(() => window.__unhandledRejections)
    expect(unhandled).toHaveLength(0)
  })
})
