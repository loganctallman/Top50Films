/**
 * In-memory localStorage implementation for injecting into createStorageService()
 * Implements the same interface as window.localStorage.
 */
export function createMockStorage(initial = {}) {
  let store = { ...initial }

  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value) },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i) => Object.keys(store)[i] ?? null,
    _store: () => store,
    _reset: (initial = {}) => { store = { ...initial } }
  }
}

/** Creates a mock storage that throws on setItem (quota exceeded simulation) */
export function createQuotaExceededStorage() {
  const base = createMockStorage()
  base.setItem = () => {
    throw new DOMException('QuotaExceededError', 'QuotaExceededError')
  }
  return base
}
