import { test, expect } from '@playwright/test'
import { mockAllApis } from './helpers.js'

/**
 * Onboarding flow — fresh app start (no localStorage).
 * The install prompt (beforeinstallprompt) is not fired in Chromium headless,
 * so only the non-install variant of step 1 is tested here.
 */

test.describe('Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    // Mock APIs so the main app works after onboarding completes
    await mockAllApis(page)
  })

  test('step 1: shows welcome screen with Get Started button', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Welcome to My Top 50')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible()
  })

  test('step 1: shows tagline text', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Track your favorite films and get notified when they hit streaming.')).toBeVisible()
  })

  test('step 1 → step 2: clicking Get Started shows How it works screen', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Get Started' }).click()
    await expect(page.getByText('How it works')).toBeVisible()
  })

  test('step 2: shows all three feature cards', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Get Started' }).click()
    await expect(page.getByText('Build your list')).toBeVisible()
    await expect(page.getByText('Pick your services')).toBeVisible()
    await expect(page.getByText('Get notified')).toBeVisible()
  })

  test('step 2: shows privacy note', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Get Started' }).click()
    await expect(page.getByText('All data stays on your device')).toBeVisible()
  })

  test("step 2 → app: clicking Let's Go shows main app with NavBar", async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Get Started' }).click()
    await page.getByRole('button', { name: "Let's Go →" }).click()
    // NavBar should now be visible — look for a nav element or a link it contains
    await expect(page.locator('nav')).toBeVisible()
  })

  test("step 2 → app: onboarding not shown on next visit after Let's Go", async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Get Started' }).click()
    await page.getByRole('button', { name: "Let's Go →" }).click()
    await expect(page.locator('nav')).toBeVisible()

    // Reload — onboardingComplete should be persisted to localStorage
    await page.reload()
    await expect(page.locator('nav')).toBeVisible()
    await expect(page.getByText('Welcome to My Top 50')).not.toBeVisible()
  })
})
