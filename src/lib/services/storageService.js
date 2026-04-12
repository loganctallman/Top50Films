export const STORAGE_KEYS = {
  FAVORITES: 'tmdb_favorites',
  STREAMING_PREFS: 'streaming_prefs',
  STREAMING_CACHE: 'streaming_cache',
  TRIAL_NOTES: 'trial_notes',
  ONBOARDING_COMPLETE: 'onboarding_complete'
}

export function createStorageService(storage = typeof window !== 'undefined' ? window.localStorage : null) {
  return {
    get(key) {
      if (!storage) return null
      try {
        const item = storage.getItem(key)
        return item !== null ? JSON.parse(item) : null
      } catch {
        return null
      }
    },

    set(key, value) {
      if (!storage) return
      try {
        storage.setItem(key, JSON.stringify(value))
      } catch {
        // quota exceeded or private browsing — fail silently
      }
    },

    remove(key) {
      if (!storage) return
      storage.removeItem(key)
    },

    clearAll() {
      if (!storage) return
      Object.values(STORAGE_KEYS).forEach(key => storage.removeItem(key))
    },

    keys: STORAGE_KEYS
  }
}

export const storageService = createStorageService()
