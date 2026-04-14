import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  resolve: {
    // Force browser-mode module resolution so vite-plugin-svelte compiles
    // components with generate:'dom' (not 'server'), enabling onMount to fire
    // in Vitest's jsdom environment.
    conditions: ['browser']
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.js'],
    include: ['src/**/*.test.js', 'api/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/lib/**/*.js', 'api/**/*.js'],
      exclude: ['src/mocks/**', 'src/test/**', '**/*.test.js']
    }
  }
})
