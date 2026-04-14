/**
 * Resets all Svelte stores to their initial values between tests.
 * Import and call resetStores() in beforeEach to prevent test pollution.
 */
import { favorites, streamingPrefs, streamingCache, trialNotes, onboardingComplete, notifications, providerList, installPrompt } from '../lib/stores.js'

export function resetStores() {
  favorites.set([])
  streamingPrefs.set({})
  streamingCache.set({})
  trialNotes.set([])
  onboardingComplete.set(false)
  notifications.set([])
  providerList.set([])
  installPrompt.set(null)
}
