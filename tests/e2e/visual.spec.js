import { test, expect } from '@playwright/test'
import { mockAllApis, skipOnboarding, seedStorage, makeCacheEntry, fixtures } from './helpers.js'

// 1×1 grey PNG — returned for every TMDB image CDN request so posters are
// deterministic across runs regardless of network or CDN changes.
const POSTER_PLACEHOLDER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVQI12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==',
  'base64'
)

// Visual regression runs on Chromium only — baselines are Chromium-generated.
// Firefox and WebKit render fonts differently; separate baselines would be
// needed to support them, which is a future enhancement.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Visual regression is Chromium-only — baselines are desktop Chromium')
})

// Snapshot tolerance: 3% of pixels may differ to absorb cross-platform
// font-rendering differences (macOS vs Linux CI runner).
const SNAP = { maxDiffPixelRatio: 0.03, animations: 'disabled' }

// Freeze time so any relative timestamps ("2 weeks ago") are deterministic.
const FIXED_NOW = new Date('2024-01-15T12:00:00.000Z').getTime()

// Films used to seed populated states — match shape used across E2E specs.
const FILM_1 = {
  tmdb_id: 238,
  title: 'The Godfather',
  year: '1972',
  poster_path: '/3bhkrj58Vtu7enYsLlegkKXKHKY.jpg',
  genre_ids: [18, 80],
  vote_average: 9.2,
  added_at: new Date('2024-01-01T00:00:00.000Z').toISOString()
}

const FILM_2 = {
  tmdb_id: 278,
  title: 'The Shawshank Redemption',
  year: '1994',
  poster_path: '/lyQBXzOQSuE59IsHyhrp0qIiPAz.jpg',
  genre_ids: [18],
  vote_average: 9.3,
  added_at: new Date('2024-01-02T00:00:00.000Z').toISOString()
}

const NETFLIX = {
  provider_id: 8,
  provider_name: 'Netflix',
  logo_path: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg',
  streaming_type: 'flatrate'
}

/**
 * Applies all mocks and seeds needed for a deterministic visual snapshot.
 * Call before page.goto() — all route handlers and init scripts must be
 * registered prior to navigation.
 */
async function setup(page, storageOverrides = {}) {
  // Block TMDB image CDN so posters don't depend on external availability.
  await page.route('**image.tmdb.org/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: POSTER_PLACEHOLDER })
  )

  await mockAllApis(page)

  // Home page uses /api/suggestions — not in mockAllApis, add here.
  await page.route('**/api/suggestions**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.genreResults) })
  )

  await page.addInitScript((fixedNow) => {
    Date.now = () => fixedNow
  }, FIXED_NOW)

  if (Object.keys(storageOverrides).length) {
    await seedStorage(page, storageOverrides)
  } else {
    await skipOnboarding(page)
  }
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

test('home — suggestions loaded', async ({ page }) => {
  await setup(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('home.png', SNAP)
})

// ---------------------------------------------------------------------------
// Add to List
// ---------------------------------------------------------------------------

test('add to list — genre browse', async ({ page }) => {
  await setup(page)
  await page.goto('/#/add')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('add-genre-browse.png', SNAP)
})

test('add to list — search results', async ({ page }) => {
  await setup(page)
  await page.goto('/#/add')
  await page.getByPlaceholder(/search/i).fill('godfather')
  await expect(page.getByText('The Godfather').first()).toBeVisible()
  await expect(page).toHaveScreenshot('add-search-results.png', SNAP)
})

// ---------------------------------------------------------------------------
// My List
// ---------------------------------------------------------------------------

test('my list — empty', async ({ page }) => {
  await setup(page)
  await page.goto('/#/my-list')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('my-list-empty.png', SNAP)
})

test('my list — populated', async ({ page }) => {
  await setup(page, { onboardingComplete: true, favorites: [FILM_1, FILM_2] })
  await page.goto('/#/my-list')
  await expect(page.getByText('The Godfather')).toBeVisible()
  await expect(page).toHaveScreenshot('my-list-populated.png', SNAP)
})

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

test('notifications — empty', async ({ page }) => {
  await setup(page, { onboardingComplete: true, favorites: [] })
  await page.goto('/#/notifications')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('notifications-empty.png', SNAP)
})

test('notifications — populated', async ({ page }) => {
  const cache = {
    238: makeCacheEntry(238, [NETFLIX]),
    278: makeCacheEntry(278, [NETFLIX])
  }
  await setup(page, { onboardingComplete: true, favorites: [FILM_1, FILM_2], streamingCache: cache })
  await page.goto('/#/notifications')
  await expect(page.getByText('The Godfather')).toBeVisible()
  await expect(page).toHaveScreenshot('notifications-populated.png', SNAP)
})

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

test('settings — providers loaded', async ({ page }) => {
  await setup(page)
  await page.goto('/#/settings')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('settings.png', SNAP)
})
