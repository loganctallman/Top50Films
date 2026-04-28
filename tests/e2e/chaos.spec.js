import { test, expect } from '@playwright/test'
import { skipOnboarding, seedStorage, mockAllApis, overrideMock, fixtures } from './helpers.js'

/**
 * Chaos / edge-case tests — API errors, empty results, list-full state.
 *
 * Note: AddToList uses Promise.allSettled for genre/search fetches.
 * When both page-1 and page-2 calls fail, allSettled captures the rejections
 * and returns empty results, so filmsError='no-results' (not 'network').
 * "Couldn't connect" only appears for person search / filmography which use
 * direct await (no allSettled wrapper).
 */

// ---------------------------------------------------------------------------
// API error states — genre / search (show as empty, due to allSettled)
// ---------------------------------------------------------------------------

test.describe('Chaos — genre top50 API error', () => {
  test('shows no-results state on Add page when genre API returns 503', async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    await overrideMock(page, '/api/genre-top50', { data: { error: true }, status: 503 })
    await page.goto('/#/add')
    await expect(page.getByText('No results for this genre right now.')).toBeVisible()
  })

  test('clicking a genre filter shows no-results state when genre API returns 503', async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    await overrideMock(page, '/api/genre-top50', { data: { error: true }, status: 503 })
    await page.goto('/#/add')
    await page.getByRole('button', { name: 'Action' }).click()
    await expect(page.getByText('No results for this genre right now.')).toBeVisible()
  })
})

test.describe('Chaos — search API error', () => {
  test('shows no-results state when search API returns 503', async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    await overrideMock(page, '/api/search', { data: { error: true }, status: 503 })
    await page.goto('/#/add')
    await page.getByRole('searchbox').fill('godfather')
    await expect(page.getByText('No films found for that search.')).toBeVisible()
  })
})

test.describe('Chaos — search returns no results', () => {
  test('shows no-results message', async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    await overrideMock(page, '/api/search', { data: fixtures.searchEmpty })
    await page.goto('/#/add')
    await page.getByRole('searchbox').fill('xyzunknownfilm')
    await expect(page.getByText('No films found for that search.')).toBeVisible()
  })
})

test.describe('Chaos — person search API error', () => {
  test('shows network error state in person mode', async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    // person/search uses direct await (not allSettled) → sets personError='network'
    await overrideMock(page, '/api/person/search', { data: { error: true }, status: 503 })
    await page.goto('/#/add')
    await page.getByRole('button', { name: 'Film', exact: true }).click()
    await page.getByText('Director / Actor').click()
    await page.getByRole('searchbox').fill('coppola')
    await expect(page.getByText("Couldn't connect — check your internet connection.")).toBeVisible()
  })
})

test.describe('Chaos — providers API error on Settings', () => {
  test('shows error state and Try Again button', async ({ page }) => {
    await skipOnboarding(page)
    await overrideMock(page, '/api/providers', { data: { error: true }, status: 503 })
    await page.goto('/#/settings')
    await expect(page.getByText('Something went wrong loading streaming services')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// List-full state (50 favorites)
// ---------------------------------------------------------------------------

test.describe('Chaos — list full (50 favorites)', () => {
  function makeFullFavorites() {
    return Array.from({ length: 50 }, (_, i) => ({
      tmdb_id: 1000 + i,
      title: `Film ${i + 1}`,
      year: '2000',
      poster_path: null,
      genre_ids: [18],
      vote_average: 7.0,
      added_at: new Date('2024-01-01T00:00:00.000Z').toISOString()
    }))
  }

  test('shows full indicator in counter', async ({ page }) => {
    await seedStorage(page, { onboardingComplete: true, favorites: makeFullFavorites() })
    await mockAllApis(page)
    await page.goto('/#/add')

    const counter = page.getByTitle('Favorites count')
    await expect(counter).toHaveText('50 / 50')
    await expect(counter).toHaveClass(/full/)
  })

  test('adding when full shows list-full message', async ({ page }) => {
    await seedStorage(page, { onboardingComplete: true, favorites: makeFullFavorites() })
    await mockAllApis(page)
    await page.goto('/#/add')

    // Genre results include The Godfather (tmdb_id: 238) — not in the full list
    await expect(page.getByText('The Godfather').first()).toBeVisible()
    // Click the first visible Add button
    await page.getByRole('button', { name: '+ Add to Favorites' }).first().click()
    await expect(page.getByText('Your list is full (50/50)')).toBeVisible()
  })

  test('Add More button is hidden when list is full', async ({ page }) => {
    await seedStorage(page, { onboardingComplete: true, favorites: makeFullFavorites() })
    await mockAllApis(page)
    await page.goto('/#/my-list')
    await expect(page.getByRole('button', { name: '+ Add More' })).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Mock infrastructure — LIFO override guard
// ---------------------------------------------------------------------------

test.describe('Mock infrastructure — overrideMock LIFO priority', () => {
  test('overrideMock registered after mockAllApis takes priority over the baseline', async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    // Registered AFTER mockAllApis → must be checked first (LIFO).
    // Baseline returns searchResults (two films); this override returns searchEmpty.
    // If LIFO is broken the baseline wins and no-results state never appears.
    await overrideMock(page, '/api/search', { data: fixtures.searchEmpty })
    await page.goto('/#/add')
    await page.getByRole('searchbox').fill('godfather')
    await expect(page.getByText('No films found for that search.')).toBeVisible()
  })

  test('person/search override takes priority over the general /api/person/ baseline', async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    // /api/person/search is a substring of /api/person/ — if the more-general wrapper
    // runs first it returns the personFilmography fixture instead of personSearch.
    // Override person/search to return empty so we can detect which layer won.
    await overrideMock(page, '/api/person/search', { data: { results: [] } })
    await page.goto('/#/add')
    await page.getByRole('button', { name: 'Film', exact: true }).click()
    await page.getByText('Director / Actor').click()
    await page.getByRole('searchbox').fill('coppola')
    // Empty person results → 'no-results' state. If /api/person/ baseline had won
    // the personFilmography fixture would populate person cards, not this message.
    await expect(page.getByText('No results found for that name.')).toBeVisible()
  })

  test('abort: true override registered after mockAllApis takes priority — direct-await path', async ({ page }) => {
    // person/search uses a direct await so a leaked TypeError would surface as an
    // unhandled rejection. Track it to confirm the app's catch block handles it.
    await page.addInitScript(() => {
      window.__unhandledRejections = []
      window.addEventListener('unhandledrejection', e => {
        window.__unhandledRejections.push(e.reason?.message || String(e.reason))
      })
    })
    await skipOnboarding(page)
    await mockAllApis(page)
    // The abort branch returns Promise.reject — different code path than { data }.
    // If LIFO is broken the baseline personSearch fixture returns instead and
    // "Couldn't connect" never appears.
    await overrideMock(page, '/api/person/search', { abort: true })
    await page.goto('/#/add')
    await page.getByRole('button', { name: 'Film', exact: true }).click()
    await page.getByText('Director / Actor').click()
    await page.getByRole('searchbox').fill('coppola')
    await expect(page.getByText("Couldn't connect — check your internet connection.")).toBeVisible()
    expect(await page.evaluate(() => window.__unhandledRejections)).toHaveLength(0)
  })

  test('abort: true override registered after mockAllApis takes priority — allSettled path', async ({ page }) => {
    // allSettled is supposed to absorb the TypeError silently, but if the mock
    // infrastructure leaks the rejection before allSettled wraps it the sentinel catches it.
    await page.addInitScript(() => {
      window.__unhandledRejections = []
      window.addEventListener('unhandledrejection', e => {
        window.__unhandledRejections.push(e.reason?.message || String(e.reason))
      })
    })
    await skipOnboarding(page)
    await mockAllApis(page)
    // /api/search is consumed via Promise.allSettled — a different consumer path than
    // person/search (direct await). allSettled absorbs the rejection and returns empty
    // results, so "No films found" is the observable outcome when abort wins.
    // If LIFO is broken the baseline searchResults fixture returns instead.
    await overrideMock(page, '/api/search', { abort: true })
    await page.goto('/#/add')
    await page.getByRole('searchbox').fill('godfather')
    await expect(page.getByText('No films found for that search.')).toBeVisible()
    expect(await page.evaluate(() => window.__unhandledRejections)).toHaveLength(0)
  })

  test('abort: true override for /api/providers shows error state (LIFO guard)', async ({ page }) => {
    await page.addInitScript(() => {
      window.__unhandledRejections = []
      window.addEventListener('unhandledrejection', e => {
        window.__unhandledRejections.push(e.reason?.message || String(e.reason))
      })
    })
    await skipOnboarding(page)
    await mockAllApis(page)
    // /api/providers baseline returns the providers fixture; abort override registered
    // after must win. Settings page shows error state when providers fetch fails.
    await overrideMock(page, '/api/providers', { abort: true })
    await page.goto('/#/settings')
    await expect(page.getByText('Something went wrong loading streaming services')).toBeVisible()
    expect(await page.evaluate(() => window.__unhandledRejections)).toHaveLength(0)
  })

  test('abort: true override is sticky for the page lifetime (not consumed after first request)', async ({ page }) => {
    await page.addInitScript(() => {
      window.__unhandledRejections = []
      window.addEventListener('unhandledrejection', e => {
        window.__unhandledRejections.push(e.reason?.message || String(e.reason))
      })
    })
    await skipOnboarding(page)
    await mockAllApis(page)
    await overrideMock(page, '/api/search', { abort: true })
    await page.goto('/#/add')
    // First search — aborted → no-results
    await page.getByRole('searchbox').fill('godfather')
    await expect(page.getByText('No films found for that search.')).toBeVisible()
    // Clear so the component registers a genuine input-change event on the next fill,
    // guaranteeing a new fetch cycle rather than a memoised/debounced render.
    await page.getByRole('searchbox').clear()
    // Second search — override must still be active (sticky, not a one-shot pop)
    await page.getByRole('searchbox').fill('batman')
    await expect(page.getByText('No films found for that search.')).toBeVisible()
    // Neither aborted fetch should leak as an unhandled rejection
    expect(await page.evaluate(() => window.__unhandledRejections)).toHaveLength(0)
  })

  test('{ data } override registered after abort takes priority — reverse LIFO order', async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    // Register abort first, then a normal fixture after — the fixture (registered last)
    // must win. If the LIFO stack iterates forwards instead of backwards, abort wins
    // and "No films found" appears instead of actual results.
    await overrideMock(page, '/api/search', { abort: true })
    await overrideMock(page, '/api/search', { data: fixtures.searchResults })
    await page.goto('/#/add')
    await page.getByRole('searchbox').fill('godfather')
    await expect(page.getByText('The Godfather').first()).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Duplicate add attempt
// ---------------------------------------------------------------------------

test.describe('Chaos — duplicate add', () => {
  test('shows Remove button (not Add) for a film already in list', async ({ page }) => {
    const existingFavorite = {
      tmdb_id: 238,
      title: 'The Godfather',
      year: '1972',
      poster_path: '/path.jpg',
      genre_ids: [18, 80],
      vote_average: 9.2,
      added_at: new Date('2024-01-01T00:00:00.000Z').toISOString()
    }
    await seedStorage(page, { onboardingComplete: true, favorites: [existingFavorite] })
    await mockAllApis(page)
    await page.goto('/#/add')

    // The Godfather is already in the list — shows Remove button, not Add
    await expect(page.getByRole('button', { name: 'Remove The Godfather from your list' }).first()).toBeVisible()
  })
})
