import { test, expect } from '@playwright/test'
import { skipOnboarding, seedStorage, mockAllApis, fixtures } from './helpers.js'

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
    // Override after mockAllApis so this handler wins (Playwright LIFO)
    await page.context().route('**/api/genre-top50**', route =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: true }) })
    )
    await page.goto('/#/add')
    await expect(page.getByText('No results for this genre right now.')).toBeVisible()
  })

  test('clicking a genre filter shows no-results state when genre API returns 503', async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    await page.context().route('**/api/genre-top50**', route =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: true }) })
    )
    await page.goto('/#/add')
    await page.getByRole('button', { name: 'Action' }).click()
    await expect(page.getByText('No results for this genre right now.')).toBeVisible()
  })
})

test.describe('Chaos — search API error', () => {
  test('shows no-results state when search API returns 503', async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    await page.context().route('**/api/search**', route =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: true }) })
    )
    await page.goto('/#/add')
    await page.getByRole('searchbox').fill('godfather')
    await expect(page.getByText('No films found for that search.')).toBeVisible()
  })
})

test.describe('Chaos — search returns no results', () => {
  test('shows no-results message', async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    await page.context().route('**/api/search**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.searchEmpty) })
    )
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
    await page.context().route('**/api/person/search**', route =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: true }) })
    )
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
    await page.context().route('**/api/providers', route =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: true }) })
    )
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
