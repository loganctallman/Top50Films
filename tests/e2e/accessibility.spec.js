import { test, expect } from '@playwright/test'
import { injectAxe } from 'axe-playwright'
import { mockAllApis, skipOnboarding, seedStorage, makeCacheEntry } from './helpers.js'

/**
 * Axe-core accessibility sweep across all app pages.
 *
 * Rules enforced: WCAG 2.1 AA (axe default).
 * Known cosmetic issues in third-party images (e.g. TMDB poster alt text) are
 * excluded via axeOptions.rules where noted.
 *
 * axeOptions.runOnly keeps the scan focused on the most impactful rule categories.
 */

const AXE_OPTIONS = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'best-practice']
  }
}

// ---------------------------------------------------------------------------
// Helper: inject axe and run check on current page
// ---------------------------------------------------------------------------
async function a11yCheck(page) {
  // Freeze all CSS animations/transitions so axe doesn't catch mid-animation
  // states (e.g. opacity < 1 during a fade-in blending text color with bg).
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }'
  })

  await injectAxe(page)
  // Get raw violations first so we can log the failing HTML for diagnosis
  const violations = await page.evaluate(async (opts) => {
    const results = await window.axe.run(document, opts)
    return results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map(n => n.html.slice(0, 200))
    }))
  }, AXE_OPTIONS)

  if (violations.length > 0) {
    const detail = violations
      .map(v => `  [${v.impact}] ${v.id} (${v.nodes.length} node(s)):\n${v.nodes.map(n => '      ' + n).join('\n')}`)
      .join('\n')
    console.error('\nAccessibility violations found:\n' + detail + '\n')
    throw new Error('Accessibility violations: ' + violations.map(v => `${v.id} (${v.nodes.length})`).join(', '))
  }
}

// ---------------------------------------------------------------------------
// Onboarding (step 1 & step 2)
// ---------------------------------------------------------------------------

test.describe('Accessibility — Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApis(page)
  })

  test('step 1 (welcome screen) has no violations', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Welcome to My Top 50')).toBeVisible()
    await a11yCheck(page)
  })

  test('step 2 (how it works) has no violations', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Get Started' }).click()
    await expect(page.getByText('How it works')).toBeVisible()
    await a11yCheck(page)
  })
})

// ---------------------------------------------------------------------------
// Main app pages
// ---------------------------------------------------------------------------

test.describe('Accessibility — Add to List', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
  })

  test('genre browse view has no violations', async ({ page }) => {
    await page.goto('/#/add')
    await expect(page.getByText('The Godfather').first()).toBeVisible()
    await a11yCheck(page)
  })

  test('search results view has no violations', async ({ page }) => {
    await page.goto('/#/add')
    await page.getByRole('searchbox').fill('godfather')
    await expect(page.getByText('The Godfather').first()).toBeVisible()
    await a11yCheck(page)
  })

  test('person search results view has no violations', async ({ page }) => {
    await page.goto('/#/add')
    await page.getByRole('button', { name: 'Film', exact: true }).click()
    await page.getByText('Director / Actor').click()
    await page.getByRole('searchbox').fill('coppola')
    await expect(page.getByText('Francis Ford Coppola')).toBeVisible({ timeout: 10000 })
    await a11yCheck(page)
  })
})

test.describe('Accessibility — My List', () => {
  test('empty state has no violations', async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    await page.goto('/#/my-list')
    await expect(page.getByText('Your list is empty')).toBeVisible()
    await a11yCheck(page)
  })

  test('populated list has no violations', async ({ page }) => {
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
    await page.goto('/#/my-list')
    await expect(page.getByText('The Godfather')).toBeVisible()
    await a11yCheck(page)
  })
})

test.describe('Accessibility — Notifications', () => {
  test('empty state has no violations', async ({ page }) => {
    await seedStorage(page, { onboardingComplete: true, favorites: [] })
    await mockAllApis(page)
    await page.goto('/#/notifications')
    await expect(page.getByText('None of your favorites are currently available')).toBeVisible()
    await a11yCheck(page)
  })

  test('populated notifications list has no violations', async ({ page }) => {
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
        { provider_id: 8, provider_name: 'Netflix', logo_path: '/logo.jpg', streaming_type: 'flatrate' },
        { provider_id: 73, provider_name: 'Tubi TV', logo_path: '/logo2.jpg', streaming_type: 'free' }
      ])
    }
    await seedStorage(page, { onboardingComplete: true, favorites: [film], streamingCache: cache })
    await mockAllApis(page)
    await page.goto('/#/notifications')
    await expect(page.getByText('The Godfather')).toBeVisible()
    await a11yCheck(page)
  })
})

test.describe('Accessibility — Settings', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
  })

  test('settings page (providers loaded) has no violations', async ({ page }) => {
    await page.goto('/#/settings')
    await expect(page.getByTitle('Netflix')).toBeVisible()
    await a11yCheck(page)
  })

  test('delete confirmation state has no violations', async ({ page }) => {
    await page.goto('/#/settings')
    await page.getByRole('button', { name: 'Delete All My Data' }).click()
    await expect(page.getByText('This will erase everything')).toBeVisible()
    await a11yCheck(page)
  })
})
