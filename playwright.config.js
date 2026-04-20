import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  snapshotDir: 'tests/snapshots',
  // Omit OS/browser from snapshot paths so one baseline works across platforms.
  // maxDiffPixelRatio in each toHaveScreenshot() call handles rendering variance.
  snapshotPathTemplate: '{snapshotDir}/{testFileName}/{arg}{ext}'
})
