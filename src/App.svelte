<script>
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
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
    streamingCache,
    onboardingComplete,
    notifications,
    providerList
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

  // Fetch streaming data for any favorites missing from (or expired in) cache
  async function refreshStaleCache(favs) {
    const staleIds = getExpiredOrMissingIds(favs, get(streamingCache))
    if (staleIds.length === 0) return
    const results = await Promise.allSettled(staleIds.map(id => apiService.movie(id)))
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        const providers = result.value.watch_providers || []
        streamingCache.update(cache => setCacheEntry(cache, staleIds[i], providers))
      }
    })
  }

  // Re-run cache refresh whenever favorites changes (e.g. user adds a new film)
  $: refreshStaleCache($favorites)

  // Keep notifications in sync with favorites + cache — updates immediately on any change
  $: notifications.set(generateNotifications($favorites, $streamingCache))

  onMount(async () => {
    // Load provider list for logos in Home/Settings
    try {
      const data = await apiService.providers()
      providerList.set(data.results || [])
    } catch { /* non-critical, Home degrades gracefully */ }

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
