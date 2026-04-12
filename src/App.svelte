<script>
  import { onMount } from 'svelte'
  import Router from 'svelte-spa-router'

  import NavBar from './lib/components/NavBar.svelte'
  import OfflineBanner from './lib/components/OfflineBanner.svelte'
  import Onboarding from './pages/Onboarding.svelte'

  import Home from './pages/Home.svelte'
  import Notifications from './pages/Notifications.svelte'
  import MyList from './pages/MyList.svelte'
  import AddToList from './pages/AddToList.svelte'
  import TrialTracker from './pages/TrialTracker.svelte'
  import Settings from './pages/Settings.svelte'

  import {
    favorites,
    streamingPrefs,
    streamingCache,
    onboardingComplete,
    notifications
  } from './lib/stores.js'
  import { apiService } from './lib/services/apiService.js'
  import { getExpiredOrMissingIds, setCacheEntry } from './lib/logic/cacheLogic.js'
  import { generateNotifications } from './lib/logic/notificationLogic.js'

  const routes = {
    '/':              Home,
    '/notifications': Notifications,
    '/my-list':       MyList,
    '/add':           AddToList,
    '/trials':        TrialTracker,
    '/settings':      Settings,
  }

  let appReady = false

  onMount(async () => {
    // Refresh expired/missing streaming cache entries for favorited films
    const staleIds = getExpiredOrMissingIds($favorites, $streamingCache)

    if (staleIds.length > 0) {
      const results = await Promise.allSettled(staleIds.map(id => apiService.movie(id)))

      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          const providers = result.value.watch_providers || []
          streamingCache.update(cache => setCacheEntry(cache, staleIds[i], providers))
        }
      })
    }

    // Generate in-memory notifications from refreshed cache
    notifications.set(
      generateNotifications($favorites, $streamingCache, $streamingPrefs)
    )

    appReady = true
  })

  function handleOnboardingComplete() {
    appReady = true
  }
</script>

{#if !$onboardingComplete}
  <Onboarding on:complete={handleOnboardingComplete} />
{:else}
  <NavBar />
  <OfflineBanner />

  <main>
    <Router {routes} />
  </main>
{/if}

<style>
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
</style>
