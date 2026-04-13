<script>
  import { onMount } from 'svelte'
  import { favorites, streamingPrefs, notifications, providerList } from '../lib/stores.js'
  import { apiService } from '../lib/services/apiService.js'
  import { aggregateGenreIds } from '../lib/logic/suggestionLogic.js'
  import { addFavorite, isDuplicate } from '../lib/logic/favoritesLogic.js'
  import FilmCard from '../lib/components/FilmCard.svelte'
  import SkeletonCard from '../lib/components/SkeletonCard.svelte'
  import StreamingBadge from '../lib/components/StreamingBadge.svelte'

  const POSTER_BASE = 'https://image.tmdb.org/t/p/w92'
  const LOGO_BASE = 'https://image.tmdb.org/t/p/original'
  const TMDB_BASE = 'https://www.themoviedb.org/movie/'

  let suggestions = []
  let loadingSuggestions = true
  let suggestionsError = false

  // Per-notification expand state for "Now Streaming"
  let streamingExpanded = {}

  function toggleStreamingExpand(id) {
    streamingExpanded = { ...streamingExpanded, [id]: !streamingExpanded[id] }
  }

  $: topNotifications = $notifications.slice(0, 10)

  // Build provider lookup map from the shared store
  $: providerMap = Object.fromEntries($providerList.map(p => [p.provider_id, p]))

  $: subscribedProviders = Object.entries($streamingPrefs)
    .filter(([, v]) => v)
    .map(([id]) => providerMap[Number(id)])
    .filter(Boolean)

  onMount(async () => {
    const genreIds = aggregateGenreIds($favorites)
    if (genreIds.length === 0) {
      loadingSuggestions = false
      return
    }
    try {
      const data = await apiService.suggestions(genreIds)
      suggestions = (data.results || []).filter(f => !isDuplicate($favorites, f.tmdb_id))
    } catch {
      suggestionsError = true
    } finally {
      loadingSuggestions = false
    }

    // Fetch streaming providers for each suggestion in parallel
    if (suggestions.length > 0) {
      const results = await Promise.allSettled(suggestions.map(f => apiService.movie(f.tmdb_id)))
      suggestions = suggestions.map((film, i) => ({
        ...film,
        watch_providers: results[i].status === 'fulfilled'
          ? (results[i].value.watch_providers || [])
          : []
      }))
    }
  })

  function handleAddSuggestion(e) {
    const film = e.detail
    const result = addFavorite($favorites, film)
    if (result.success) favorites.set(result.favorites)
  }
</script>

<div class="page">
  <a href="#/add" class="search-cta">Search For Your Favorite Films</a>

  <!-- Module 1: Now Streaming -->
  <section class="module">
    <div class="module-header">
      <h2>Now Streaming</h2>
      <a href="#/notifications" class="see-all">See all →</a>
    </div>

    {#if topNotifications.length === 0}
      <p class="module-empty">
        None of your favorites are streaming anywhere right now.
        <a href="#/add">Add more favorites</a> or check back later.
      </p>
    {:else}
      <ul class="streaming-list" role="list">
        {#each topNotifications as notif (notif.id)}
          {@const allProviders = notif.providers || [notif.provider]}
          {@const extraCount = allProviders.length - 1}
          {@const isExpanded = !!streamingExpanded[notif.id]}
          <li class="streaming-item">
            {#if notif.film.poster_path}
              <img
                src="{POSTER_BASE}{notif.film.poster_path}"
                alt={notif.film.title}
                class="s-poster"
                loading="lazy"
              />
            {:else}
              <div class="s-poster s-poster-ph">🎬</div>
            {/if}
            <div class="s-info">
              <p class="s-title">
                <a href="{TMDB_BASE}{notif.film.tmdb_id}" target="_blank" rel="noopener noreferrer">
                  {notif.film.title}
                </a>
              </p>
              <div class="s-badges-row">
                {#if isExpanded}
                  {#each allProviders as provider (provider.provider_id)}
                    <StreamingBadge
                      {provider}
                      subscribed={!!$streamingPrefs[provider.provider_id]}
                    />
                  {/each}
                {:else}
                  <StreamingBadge
                    provider={notif.provider}
                    subscribed={!!$streamingPrefs[notif.provider.provider_id]}
                  />
                {/if}
              </div>
              {#if extraCount > 0}
                <button class="s-expand-btn" on:click={() => toggleStreamingExpand(notif.id)}>
                  {isExpanded ? 'Show less ▲' : `+${extraCount} more ▾`}
                </button>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!-- Module 2: My Services -->
  <section class="module">
    <div class="module-header">
      <h2>My Services</h2>
      <a href="#/settings" class="see-all">Edit →</a>
    </div>

    {#if subscribedProviders.length === 0}
      <p class="module-empty">
        No services selected. <a href="#/settings">Go to Settings</a> to add them.
      </p>
    {:else}
      <div class="services-row">
        {#each subscribedProviders.slice(0, 20) as provider (provider.provider_id)}
          <div class="service-chip">
            {#if provider.logo_path}
              <img
                src="{LOGO_BASE}{provider.logo_path}"
                alt={provider.provider_name}
                class="service-chip-logo"
              />
            {/if}
            <span>{provider.provider_name}</span>
          </div>
        {/each}
      </div>
      <p class="services-note">
        {#if subscribedProviders.length > 20}
          Showing 20 of {subscribedProviders.length} services.
          <a href="#/settings">Show all</a>
        {:else}
          {subscribedProviders.length} service{subscribedProviders.length > 1 ? 's' : ''} selected.
          <a href="#/settings">Edit</a>
        {/if}
      </p>
    {/if}
  </section>

  <!-- Module 3: Suggested For You -->
  <section class="module">
    <div class="module-header">
      <h2>Suggested For You</h2>
      <a href="#/add" class="see-all">Browse more →</a>
    </div>

    {#if $favorites.length === 0}
      <p class="module-empty">
        <a href="#/add">Add some favorites</a> and we'll suggest films you might like.
      </p>
    {:else if loadingSuggestions}
      <div class="suggestions-scroll">
        <SkeletonCard count={5} />
      </div>
    {:else if suggestionsError || suggestions.length === 0}
      <!-- Suggestions failed — hide silently per spec -->
      <p class="module-empty">No suggestions available right now.</p>
    {:else}
      <div class="suggestions-scroll">
        {#each suggestions as film (film.tmdb_id)}
          <div class="suggestion-item">
            <FilmCard
              {film}
              streamingPrefs={$streamingPrefs}
              isInList={isDuplicate($favorites, film.tmdb_id)}
              on:add={handleAddSuggestion}
            />
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .page {
    width: 100%;
    max-width: 1000px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
    overflow-x: hidden;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .module {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 1.25rem;
  }

  .module-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  h2 {
    font-size: 1.0625rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }

  .see-all {
    font-size: 0.8125rem;
    color: var(--accent);
    text-decoration: none;
  }

  .see-all:hover { text-decoration: underline; }

  .module-empty {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin: 0;
  }

  .module-empty a { color: var(--accent); }

  /* Streaming list */
  .streaming-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .streaming-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    border-radius: var(--radius);
    transition: background 0.15s;
    min-width: 0;
    overflow: hidden;
  }

  .streaming-item:hover { background: var(--surface-elevated); }

  .s-poster {
    width: 36px;
    height: 54px;
    object-fit: cover;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .s-poster-ph {
    background: var(--surface-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
  }

  .s-info { flex: 1; min-width: 0; overflow: hidden; }

  .s-title {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0 0 0.3rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-primary);
  }

  .s-title a { color: inherit; text-decoration: none; }
  .s-title a:hover { color: var(--accent); }

  .s-badges-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  .s-expand-btn {
    background: none;
    border: none;
    padding: 0;
    color: var(--text-muted);
    font-size: 0.7rem;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s;
    line-height: 1;
  }

  .s-expand-btn:hover { color: var(--accent); }

  /* My Services */
  .services-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .service-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 6px;
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .service-chip-logo {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .services-note {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0;
  }

  .services-note a { color: var(--accent); }

  /* Suggestions */
  .suggestions-scroll {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.75rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }

  @media (min-width: 600px) {
    .suggestions-scroll {
      display: flex;
      gap: 0.75rem;
      overflow-x: auto;
    }

    .suggestion-item {
      flex: 0 0 160px;
    }
  }

  .search-cta {
    display: block;
    width: 100%;
    padding: 0.875rem 1rem;
    background: var(--accent);
    color: #fff;
    text-align: center;
    font-size: 1rem;
    font-weight: 700;
    border-radius: var(--radius-lg);
    text-decoration: none;
    transition: background 0.15s, transform 0.15s;
    box-sizing: border-box;
  }

  .search-cta:hover {
    background: #c73550;
    transform: translateY(-1px);
    text-decoration: none;
  }
</style>
