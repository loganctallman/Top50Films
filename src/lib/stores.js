import { writable } from 'svelte/store'
import { storageService, STORAGE_KEYS } from './services/storageService.js'

function localStore(key, initial) {
  const stored = storageService.get(key)
  const store = writable(stored !== null ? stored : initial)
  store.subscribe(val => storageService.set(key, val))
  return store
}

// Persisted stores — synced to localStorage
export const favorites = localStore(STORAGE_KEYS.FAVORITES, [])
export const streamingPrefs = localStore(STORAGE_KEYS.STREAMING_PREFS, {})
export const streamingCache = localStore(STORAGE_KEYS.STREAMING_CACHE, {})
export const trialNotes = localStore(STORAGE_KEYS.TRIAL_NOTES, [])
export const onboardingComplete = localStore(STORAGE_KEYS.ONBOARDING_COMPLETE, false)

// In-memory only — regenerated on each app open from cache + favorites + prefs
export const notifications = writable([])
export const providerList = writable([])
export const installPrompt = writable(null) // deferred beforeinstallprompt event
