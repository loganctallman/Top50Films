import { test, expect } from '@playwright/test'
import { skipOnboarding, seedStorage, mockAllApis, overrideMock, fixtures } from './helpers.js'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    await page.goto('/#/settings')
  })

  // -------------------------------------------------------------------------
  // Page structure
  // -------------------------------------------------------------------------

  test('shows Settings heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('shows Streaming Services section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Streaming Services' })).toBeVisible()
  })

  test('shows Reset section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Reset' })).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Provider loading
  // -------------------------------------------------------------------------

  test('providers load and are visible', async ({ page }) => {
    await expect(page.getByTitle('Netflix')).toBeVisible()
    await expect(page.getByTitle('Amazon Prime')).toBeVisible()
    await expect(page.getByTitle('Tubi TV')).toBeVisible()
    await expect(page.getByTitle('Disney Plus')).toBeVisible()
  })

  test('shows provider search input once providers are loaded', async ({ page }) => {
    // Wait for providers to load
    await expect(page.getByTitle('Netflix')).toBeVisible()
    await expect(page.getByLabel('Search streaming services')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Provider toggle
  // -------------------------------------------------------------------------

  test('providers start unselected', async ({ page }) => {
    await expect(page.getByTitle('Netflix')).toBeVisible()
    const netflixBtn = page.getByTitle('Netflix')
    await expect(netflixBtn).toHaveAttribute('aria-pressed', 'false')
  })

  test('clicking a provider toggles it on', async ({ page }) => {
    const netflixBtn = page.getByTitle('Netflix')
    await netflixBtn.click()
    await expect(netflixBtn).toHaveAttribute('aria-pressed', 'true')
  })

  test('clicking an active provider deselects it', async ({ page }) => {
    const netflixBtn = page.getByTitle('Netflix')
    await netflixBtn.click()
    await expect(netflixBtn).toHaveAttribute('aria-pressed', 'true')
    await netflixBtn.click()
    await expect(netflixBtn).toHaveAttribute('aria-pressed', 'false')
  })

  test('provider selection persists after page reload', async ({ page }) => {
    const netflixBtn = page.getByTitle('Netflix')
    await netflixBtn.click()
    await expect(netflixBtn).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    // Re-wait for providers after reload
    await expect(page.getByTitle('Netflix')).toBeVisible()
    await expect(page.getByTitle('Netflix')).toHaveAttribute('aria-pressed', 'true')
  })

  // -------------------------------------------------------------------------
  // Select All / Deselect All
  // -------------------------------------------------------------------------

  test('shows Select All Services button', async ({ page }) => {
    await expect(page.getByTitle('Netflix')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Select All Services' })).toBeVisible()
  })

  test('Select All Services selects all providers', async ({ page }) => {
    await expect(page.getByTitle('Netflix')).toBeVisible()
    await page.getByRole('button', { name: 'Select All Services' }).click()
    // All four providers should now be selected
    for (const name of ['Netflix', 'Amazon Prime', 'Tubi TV', 'Disney Plus']) {
      await expect(page.getByTitle(name)).toHaveAttribute('aria-pressed', 'true')
    }
  })

  test('button label changes to Deselect All after selecting all', async ({ page }) => {
    await expect(page.getByTitle('Netflix')).toBeVisible()
    await page.getByRole('button', { name: 'Select All Services' }).click()
    await expect(page.getByRole('button', { name: 'Deselect All Services' })).toBeVisible()
  })

  test('Deselect All Services deselects all providers', async ({ page }) => {
    await expect(page.getByTitle('Netflix')).toBeVisible()
    await page.getByRole('button', { name: 'Select All Services' }).click()
    await page.getByRole('button', { name: 'Deselect All Services' }).click()
    for (const name of ['Netflix', 'Amazon Prime', 'Tubi TV', 'Disney Plus']) {
      await expect(page.getByTitle(name)).toHaveAttribute('aria-pressed', 'false')
    }
  })

  // -------------------------------------------------------------------------
  // Provider search / filter
  // -------------------------------------------------------------------------

  test('typing in provider search filters the list', async ({ page }) => {
    await expect(page.getByTitle('Netflix')).toBeVisible()
    await page.getByLabel('Search streaming services').fill('Netflix')
    await expect(page.getByTitle('Netflix')).toBeVisible()
    await expect(page.getByTitle('Amazon Prime')).not.toBeVisible()
  })

  test('shows Clear Search button when search has text', async ({ page }) => {
    await expect(page.getByTitle('Netflix')).toBeVisible()
    await page.getByLabel('Search streaming services').fill('net')
    await expect(page.getByRole('button', { name: 'Clear Search' })).toBeVisible()
  })

  test('Clear Search button clears the filter and shows all providers', async ({ page }) => {
    await expect(page.getByTitle('Netflix')).toBeVisible()
    await page.getByLabel('Search streaming services').fill('Netflix')
    await page.getByRole('button', { name: 'Clear Search' }).click()
    await expect(page.getByTitle('Amazon Prime')).toBeVisible()
    await expect(page.getByTitle('Tubi TV')).toBeVisible()
  })

  test('shows no-match message for unrecognised search', async ({ page }) => {
    await expect(page.getByTitle('Netflix')).toBeVisible()
    await page.getByLabel('Search streaming services').fill('xyzunknown')
    await expect(page.getByText('No services match "xyzunknown"')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Delete all data — two-step confirm
  // -------------------------------------------------------------------------

  test('shows Delete All My Data button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Delete All My Data' })).toBeVisible()
  })

  test('clicking Delete shows confirmation box', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete All My Data' }).click()
    await expect(page.getByText('This will erase everything and return you to the welcome screen')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Yes, Delete Everything' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  test('Cancel hides the confirmation box', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete All My Data' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: 'Delete All My Data' })).toBeVisible()
    await expect(page.getByText('This will erase everything')).not.toBeVisible()
  })

  test('confirming delete resets all stored data', async ({ page }) => {
    // Select Netflix to create some state before deletion
    await expect(page.getByTitle('Netflix')).toBeVisible()
    await page.getByTitle('Netflix').click()
    await expect(page.getByTitle('Netflix')).toHaveAttribute('aria-pressed', 'true')

    // Confirm delete
    await page.getByRole('button', { name: 'Delete All My Data' }).click()
    await page.getByRole('button', { name: 'Yes, Delete Everything' }).click()

    // deleteAllData() sets hash='#/' then reloads. Wait for networkidle so the
    // reload is fully settled, then use a client-side hash assignment to reach
    // Settings. page.goto() after a page-initiated reload strips the hash in
    // WebKit, landing on the base URL and defaulting the SPA router to #/.
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => { location.hash = '/settings' })

    // After reload, providers load fresh and Netflix should be unselected
    await expect(page.getByTitle('Netflix')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTitle('Netflix')).toHaveAttribute('aria-pressed', 'false')
  })
})

test.describe('Settings — provider loading failure', () => {
  test('shows error state when providers API fails', async ({ page }) => {
    await skipOnboarding(page)
    await overrideMock(page, '/api/providers', { data: { error: true }, status: 503 })
    await page.goto('/#/settings')
    await expect(page.getByText('Something went wrong loading streaming services')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible()
  })
})

test.describe('Settings — pre-seeded prefs', () => {
  test('shows pre-selected providers from localStorage', async ({ page }) => {
    await seedStorage(page, {
      onboardingComplete: true,
      streamingPrefs: { 8: true, 337: true }  // Netflix + Disney Plus pre-selected
    })
    await mockAllApis(page)
    await page.goto('/#/settings')
    await expect(page.getByTitle('Netflix')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTitle('Disney Plus')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTitle('Tubi TV')).toHaveAttribute('aria-pressed', 'false')
  })
})
