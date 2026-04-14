import '@testing-library/jest-dom'
import { setupServer } from 'msw/node'
import { handlers } from '../mocks/handlers.js'
import { cleanup } from '@testing-library/svelte'

// MSW server — intercepts fetch('/api/...') calls in component tests
export const server = setupServer(...handlers)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' })
  // Node's native fetch requires absolute URLs. Patch globalThis.fetch AFTER
  // MSW's server.listen() so our wrapper sits on top of MSW's interceptor.
  // This makes fetch('/api/…') resolve to http://localhost/api/… which MSW
  // can then intercept and return mock responses.
  const mswFetch = globalThis.fetch
  globalThis.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith('/')) {
      input = `http://localhost${input}`
    }
    return mswFetch(input, init)
  }
})
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => server.close())

// jsdom doesn't implement matchMedia — provide a stub
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// Silence jsdom navigation warnings
Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() })
