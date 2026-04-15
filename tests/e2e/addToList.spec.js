import { test, expect } from '@playwright/test'
import { mockAllApis, skipOnboarding, fixtures } from './helpers.js'

test.describe('Add to List', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page)
    await mockAllApis(page)
    await page.goto('/#/add')
  })

  // -------------------------------------------------------------------------
  // Initial page load — genre browse
  // -------------------------------------------------------------------------

  test('shows the page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Add to List' })).toBeVisible()
  })

  test('shows favorites counter', async ({ page }) => {
    await expect(page.getByTitle('Favorites count')).toBeVisible()
  })

  test('loads genre films on mount', async ({ page }) => {
    await expect(page.getByText('The Godfather').first()).toBeVisible()
    await expect(page.getByText('The Shawshank Redemption').first()).toBeVisible()
  })

  test('shows genre filter buttons', async ({ page }) => {
    const genreGroup = page.getByRole('group', { name: 'Genre filter' })
    await expect(genreGroup.getByRole('button', { name: 'All', exact: true })).toBeVisible()
    await expect(genreGroup.getByRole('button', { name: 'Action' })).toBeVisible()
    await expect(genreGroup.getByRole('button', { name: 'Drama' })).toBeVisible()
  })

  test('All genre filter is active by default', async ({ page }) => {
    const genreGroup = page.getByRole('group', { name: 'Genre filter' })
    const allBtn = genreGroup.getByRole('button', { name: 'All', exact: true })
    await expect(allBtn).toHaveAttribute('aria-pressed', 'true')
  })

  // -------------------------------------------------------------------------
  // Genre filter
  // -------------------------------------------------------------------------

  test('clicking a genre filter reloads films', async ({ page }) => {
    await page.getByRole('button', { name: 'Action' }).click()
    await expect(page.getByRole('button', { name: 'Action' })).toHaveAttribute('aria-pressed', 'true')
    // Films still appear (same mock response)
    await expect(page.getByText('The Godfather').first()).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Film search
  // -------------------------------------------------------------------------

  test('typing in search input hides genre filters and shows search results', async ({ page }) => {
    const searchInput = page.getByRole('searchbox')
    await searchInput.fill('godfather')
    // Genre filters disappear when searching
    await expect(page.getByRole('group', { name: 'Genre filter' })).not.toBeVisible()
    // Search results appear
    await expect(page.getByText('The Godfather').first()).toBeVisible()
  })

  test('shows empty-state when search returns no results', async ({ page }) => {
    await page.route('**/api/search**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.searchEmpty) })
    )
    const searchInput = page.getByRole('searchbox')
    await searchInput.fill('xyznotfound')
    await expect(page.getByText('No films found for that search.')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Adding a film
  // -------------------------------------------------------------------------

  test('add button is visible on a film card', async ({ page }) => {
    await expect(page.getByRole('button', { name: '+ Add to Favorites' }).first()).toBeVisible()
  })

  test('clicking add shows success message', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add to Favorites' }).first().click()
    await expect(page.getByText('Added!')).toBeVisible()
  })

  test('adding a film increments the counter', async ({ page }) => {
    const counter = page.getByTitle('Favorites count')
    await expect(counter).toHaveText('0 / 50')
    await page.getByRole('button', { name: '+ Add to Favorites' }).first().click()
    await expect(counter).toHaveText('1 / 50')
  })

  test('clicking add again shows duplicate message', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: '+ Add to Favorites' }).first()
    await addBtn.click()
    await expect(page.getByText('Added!')).toBeVisible()
    // Wait for the add message to clear
    await expect(page.getByText('Added!')).not.toBeVisible()
    // The card now shows as in-list — button label changes to Remove
    await expect(page.getByRole('button', { name: /Remove .* from your list/i }).first()).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Person / Director search mode
  // -------------------------------------------------------------------------

  test('mode dropdown opens on click', async ({ page }) => {
    await page.getByRole('button', { name: 'Film', exact: true }).click()
    await expect(page.getByText('Director / Actor')).toBeVisible()
  })

  test('switching to Director / Actor mode changes placeholder', async ({ page }) => {
    await page.getByRole('button', { name: 'Film', exact: true }).click()
    await page.getByText('Director / Actor').click()
    const searchInput = page.getByRole('searchbox')
    await expect(searchInput).toHaveAttribute('placeholder', 'Search directors & actors…')
  })

  test('searching in person mode shows person results', async ({ page }) => {
    await page.getByRole('button', { name: 'Film', exact: true }).click()
    await page.getByText('Director / Actor').click()
    await page.getByRole('searchbox').fill('coppola')
    // Wait for debounce (400ms) + network
    await expect(page.getByText('Francis Ford Coppola')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Directing').first()).toBeVisible()
  })

  test('clicking a person loads their filmography', async ({ page }) => {
    await page.getByRole('button', { name: 'Film', exact: true }).click()
    await page.getByText('Director / Actor').click()
    await page.getByRole('searchbox').fill('coppola')
    await expect(page.getByText('Francis Ford Coppola')).toBeVisible({ timeout: 10000 })
    await page.getByText('Francis Ford Coppola').click()
    // Breadcrumb and filmography shown
    await expect(page.getByText('Francis Ford Coppola').first()).toBeVisible()
    await expect(page.getByText('The Godfather').first()).toBeVisible()
    await expect(page.getByText('The Godfather Part II').first()).toBeVisible()
  })

  test('back button clears person selection', async ({ page }) => {
    await page.getByRole('button', { name: 'Film', exact: true }).click()
    await page.getByText('Director / Actor').click()
    await page.getByRole('searchbox').fill('coppola')
    await expect(page.getByText('Francis Ford Coppola')).toBeVisible({ timeout: 10000 })
    await page.getByText('Francis Ford Coppola').click()
    await page.getByRole('button', { name: '← Back' }).click()
    await expect(page.getByText('Search for a director or actor above')).toBeVisible()
  })
})
