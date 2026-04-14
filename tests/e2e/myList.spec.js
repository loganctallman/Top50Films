import { test, expect } from '@playwright/test'
import { mockAllApis, skipOnboarding, seedStorage, fixtures } from './helpers.js'

const film1 = {
  tmdb_id: 238,
  title: 'The Godfather',
  year: '1972',
  poster_path: '/path.jpg',
  genre_ids: [18, 80],
  vote_average: 9.2,
  added_at: new Date('2024-01-01T00:00:00.000Z').toISOString()
}

const film2 = {
  tmdb_id: 278,
  title: 'The Shawshank Redemption',
  year: '1994',
  poster_path: '/path2.jpg',
  genre_ids: [18],
  vote_average: 9.3,
  added_at: new Date('2024-01-02T00:00:00.000Z').toISOString()
}

test.describe('My List — empty', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    await page.goto('/#/my-list')
  })

  test('shows empty-state message', async ({ page }) => {
    await expect(page.getByText('Your list is empty')).toBeVisible()
  })

  test('shows Browse Films button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Browse Films' })).toBeVisible()
  })

  test('Browse Films button navigates to add page', async ({ page }) => {
    await page.getByRole('button', { name: 'Browse Films' }).click()
    await expect(page.getByRole('heading', { name: 'Add to List' })).toBeVisible()
  })
})

test.describe('My List — with favorites', () => {
  test.beforeEach(async ({ page }) => {
    await seedStorage(page, {
      onboardingComplete: true,
      favorites: [film1, film2]
    })
    await mockAllApis(page)
    await page.goto('/#/my-list')
  })

  test('shows both film titles', async ({ page }) => {
    await expect(page.getByText('The Godfather')).toBeVisible()
    await expect(page.getByText('The Shawshank Redemption')).toBeVisible()
  })

  test('shows favorites count', async ({ page }) => {
    await expect(page.getByText('2 / 50 favorites')).toBeVisible()
  })

  test('shows Add More button when under 50 favorites', async ({ page }) => {
    await expect(page.getByRole('button', { name: '+ Add More' })).toBeVisible()
  })

  test('Add More button navigates to add page', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add More' }).click()
    await expect(page.getByRole('heading', { name: 'Add to List' })).toBeVisible()
  })

  test('shows Remove All button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Remove All' })).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Remove individual film
  // -------------------------------------------------------------------------

  test('remove button is visible on film cards', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Remove .* from your list/i }).first()).toBeVisible()
  })

  test('removing a film removes it from the list', async ({ page }) => {
    // Remove The Godfather
    await page.getByRole('button', { name: 'Remove The Godfather from your list' }).click()
    await expect(page.getByText('The Godfather')).not.toBeVisible()
    await expect(page.getByText('The Shawshank Redemption')).toBeVisible()
    await expect(page.getByText('1 / 50 favorites')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Remove all — two-step confirm
  // -------------------------------------------------------------------------

  test('Remove All shows confirmation row', async ({ page }) => {
    await page.getByRole('button', { name: 'Remove All' }).click()
    await expect(page.getByText('Remove all?')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  test('Cancel returns to normal state', async ({ page }) => {
    await page.getByRole('button', { name: 'Remove All' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: 'Remove All' })).toBeVisible()
    await expect(page.getByText('The Godfather')).toBeVisible()
  })

  test('confirming Remove All clears the list and shows empty state', async ({ page }) => {
    await page.getByRole('button', { name: 'Remove All' }).click()
    await page.getByRole('button', { name: 'Yes' }).click()
    await expect(page.getByText('Your list is empty')).toBeVisible()
  })
})
