import { test, expect } from '@playwright/test'
import { mockAllApis, seedStorage, makeCacheEntry } from './helpers.js'

const film1 = {
  tmdb_id: 238,
  title: 'The Godfather',
  year: '1972',
  poster_path: '/3bhkrj58Vtu7enYsLlegkKXKHKY.jpg',
  genre_ids: [18, 80],
  vote_average: 9.2,
  added_at: new Date('2024-01-01T00:00:00.000Z').toISOString()
}

const film2 = {
  tmdb_id: 278,
  title: 'The Shawshank Redemption',
  year: '1994',
  poster_path: '/lyQBXzOQSuE59IsHyhrp0qIiPAz.jpg',
  genre_ids: [18],
  vote_average: 9.3,
  added_at: new Date('2024-01-02T00:00:00.000Z').toISOString()
}

const netflixProvider = {
  provider_id: 8,
  provider_name: 'Netflix',
  logo_path: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg',
  streaming_type: 'flatrate'
}

const tubiProvider = {
  provider_id: 73,
  provider_name: 'Tubi TV',
  logo_path: '/pZgeSWpfvD59x6b2mHQnGwAQbEr.jpg',
  streaming_type: 'free'
}

test.describe('Notifications — empty', () => {
  test.beforeEach(async ({ page }) => {
    // Empty favorites → no notifications regardless of cache state
    await seedStorage(page, { onboardingComplete: true, favorites: [] })
    await mockAllApis(page)
    await page.goto('/#/notifications')
  })

  test('shows empty-state when no films are streaming', async ({ page }) => {
    await expect(page.getByText('None of your favorites are currently available')).toBeVisible()
  })

  test('shows check-back message', async ({ page }) => {
    await expect(page.getByText('Check back later')).toBeVisible()
  })
})

test.describe('Notifications — with streaming films', () => {
  test.beforeEach(async ({ page }) => {
    const cache = {
      238: makeCacheEntry(238, [netflixProvider, tubiProvider]),
      278: makeCacheEntry(278, [netflixProvider])
    }
    await seedStorage(page, {
      onboardingComplete: true,
      favorites: [film1, film2],
      streamingCache: cache
    })
    await mockAllApis(page)
    await page.goto('/#/notifications')
  })

  test('shows notification cards for streaming films', async ({ page }) => {
    await expect(page.getByText('The Godfather')).toBeVisible()
    await expect(page.getByText('The Shawshank Redemption')).toBeVisible()
  })

  test('shows "Streaming on" label', async ({ page }) => {
    await expect(page.getByText('Streaming on').first()).toBeVisible()
  })

  test('shows the first provider badge', async ({ page }) => {
    // Netflix is the first provider for both films
    await expect(page.getByText('Netflix').first()).toBeVisible()
  })

  test('shows +N more button when film has multiple providers', async ({ page }) => {
    // The Godfather has 2 providers — should show "+1 more"
    await expect(page.getByRole('button', { name: '+1 more ▾' })).toBeVisible()
  })

  test('clicking +N more expands all providers', async ({ page }) => {
    await page.getByRole('button', { name: '+1 more ▾' }).click()
    await expect(page.getByText('Tubi TV')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Show less ▲' })).toBeVisible()
  })

  test('clicking Show less collapses providers', async ({ page }) => {
    await page.getByRole('button', { name: '+1 more ▾' }).click()
    await page.getByRole('button', { name: 'Show less ▲' }).click()
    await expect(page.getByRole('button', { name: '+1 more ▾' })).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Remove from list
  // -------------------------------------------------------------------------

  test('shows Remove from My List button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Remove The Godfather from My List' }).first()).toBeVisible()
  })

  test('removing a film removes its notification card', async ({ page }) => {
    await page.getByRole('button', { name: 'Remove The Godfather from My List' }).click()
    await expect(page.getByText('The Godfather')).not.toBeVisible()
    await expect(page.getByText('The Shawshank Redemption')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Remove all — two-step confirm
  // -------------------------------------------------------------------------

  test('shows Remove All button when notifications exist', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Remove All' })).toBeVisible()
  })

  test('Remove All shows confirmation row', async ({ page }) => {
    await page.getByRole('button', { name: 'Remove All' }).click()
    await expect(page.getByText('Remove all from list?')).toBeVisible()
  })

  test('confirming Remove All empties notifications', async ({ page }) => {
    await page.getByRole('button', { name: 'Remove All' }).click()
    await page.getByRole('button', { name: 'Yes' }).click()
    await expect(page.getByText('None of your favorites are currently available')).toBeVisible()
  })
})
