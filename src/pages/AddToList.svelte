<script>
  import { onMount } from 'svelte'
  import { push } from 'svelte-spa-router'
  import { favorites, streamingPrefs } from '../lib/stores.js'
  import { apiService } from '../lib/services/apiService.js'
  import { addFavorite, removeFavorite, isDuplicate, MAX_FAVORITES } from '../lib/logic/favoritesLogic.js'
  import FilmCard from '../lib/components/FilmCard.svelte'
  import SkeletonCard from '../lib/components/SkeletonCard.svelte'

  const GENRES = [
    { id: null,  name: 'All' },
    { id: 28,    name: 'Action' },
    { id: 12,    name: 'Adventure' },
    { id: 16,    name: 'Animation' },
    { id: 35,    name: 'Comedy' },
    { id: 80,    name: 'Crime' },
    { id: 18,    name: 'Drama' },
    { id: 14,    name: 'Fantasy' },
    { id: 27,    name: 'Horror' },
    { id: 9648,  name: 'Mystery' },
    { id: 10749, name: 'Romance' },
    { id: 878,   name: 'Sci-Fi' },
    { id: 53,    name: 'Thriller' },
    { id: 37,    name: 'Western' },
  ]

  let selectedGenre = GENRES[0]
  const INITIAL_DISPLAY = 24

  let films = []
  let clientBuffer = []        // fetched but not yet shown
  let loadingFilms = false
  let loadingProviders = false
  let loadingMore = false
  let filmsError = null
  let currentPage = 1
  let hasMoreServerPages = false

  let searchQuery = ''
  let searchDebounce
  let isSearching = false
  let searchError = null
  let searchPage = 1
  let hasMoreSearchPages = false

  // Per-film provider loading map
  let providerMap = {}

  // Inline add feedback
  let addMessage = null
  let addMessageFilmId = null

  $: listCount = $favorites.length
  $: isFull = listCount >= MAX_FAVORITES

  onMount(() => {
    loadGenre(selectedGenre)
  })

  async function loadGenre(genre) {
    selectedGenre = genre
    searchQuery = ''
    films = []
    clientBuffer = []
    providerMap = {}
    filmsError = null
    loadingFilms = true
    currentPage = 0
    hasMoreServerPages = false

    try {
      const [res1, res2] = await Promise.allSettled([
        apiService.genreTop50(genre.id, 1),
        apiService.genreTop50(genre.id, 2)
      ])
      const page1 = res1.status === 'fulfilled' ? (res1.value.results || []) : []
      const page2 = res2.status === 'fulfilled' ? (res2.value.results || []) : []
      const all = [...page1, ...page2]

      currentPage = res2.status === 'fulfilled' ? 2 : 1
      hasMoreServerPages = res2.status === 'fulfilled'
        ? page2.length === 20
        : page1.length === 20

      if (all.length === 0) {
        filmsError = 'no-results'
      } else {
        films = all.slice(0, INITIAL_DISPLAY)
        clientBuffer = all.slice(INITIAL_DISPLAY)
      }
    } catch {
      filmsError = 'network'
    } finally {
      loadingFilms = false
    }

    if (films.length > 0) fetchProvidersForFilms(films)
  }

  async function loadMoreGenre() {
    if (loadingMore) return
    loadingMore = true

    if (clientBuffer.length > 0) {
      const toShow = clientBuffer.slice(0, INITIAL_DISPLAY)
      clientBuffer = clientBuffer.slice(INITIAL_DISPLAY)
      films = [...films, ...toShow]
      fetchProvidersForFilms(toShow)
      loadingMore = false
      return
    }

    const nextPage = currentPage + 1
    try {
      const data = await apiService.genreTop50(selectedGenre.id, nextPage)
      const newFilms = data.results || []
      currentPage = nextPage
      hasMoreServerPages = newFilms.length === 20
      const toShow = newFilms.slice(0, INITIAL_DISPLAY)
      clientBuffer = newFilms.slice(INITIAL_DISPLAY)
      films = [...films, ...toShow]
      if (toShow.length > 0) fetchProvidersForFilms(toShow)
    } catch {
      // silently fail — existing results stay
    } finally {
      loadingMore = false
    }
  }

  async function fetchProvidersForFilms(filmList) {
    loadingProviders = true
    const ids = filmList.map(f => f.tmdb_id)
    const results = await Promise.allSettled(ids.map(id => apiService.movie(id)))
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        providerMap[ids[i]] = result.value.watch_providers || []
      } else {
        providerMap[ids[i]] = null
      }
    })
    providerMap = providerMap // trigger reactivity
    loadingProviders = false
  }

  function handleSearchInput() {
    clearTimeout(searchDebounce)
    if (!searchQuery.trim()) {
      loadGenre(selectedGenre)
      return
    }
    searchDebounce = setTimeout(() => runSearch(searchQuery), 400)
  }

  async function runSearch(query) {
    films = []
    clientBuffer = []
    providerMap = {}
    searchError = null
    isSearching = true
    searchPage = 0
    hasMoreSearchPages = false

    try {
      const [res1, res2] = await Promise.allSettled([
        apiService.search(query, 1),
        apiService.search(query, 2)
      ])
      const page1 = res1.status === 'fulfilled' ? (res1.value.results || []) : []
      const page2 = res2.status === 'fulfilled' ? (res2.value.results || []) : []
      const all = [...page1, ...page2]

      searchPage = res2.status === 'fulfilled' ? 2 : 1
      hasMoreSearchPages = res2.status === 'fulfilled'
        ? page2.length === 20
        : page1.length === 20

      if (all.length === 0) {
        searchError = 'no-results'
      } else {
        films = all.slice(0, INITIAL_DISPLAY)
        clientBuffer = all.slice(INITIAL_DISPLAY)
      }
    } catch {
      searchError = 'network'
    } finally {
      isSearching = false
    }

    if (films.length > 0) fetchProvidersForFilms(films)
  }

  async function loadMoreSearch() {
    if (loadingMore) return
    loadingMore = true

    if (clientBuffer.length > 0) {
      const toShow = clientBuffer.slice(0, INITIAL_DISPLAY)
      clientBuffer = clientBuffer.slice(INITIAL_DISPLAY)
      films = [...films, ...toShow]
      fetchProvidersForFilms(toShow)
      loadingMore = false
      return
    }

    const nextPage = searchPage + 1
    try {
      const data = await apiService.search(searchQuery, nextPage)
      const newFilms = data.results || []
      searchPage = nextPage
      hasMoreSearchPages = newFilms.length === 20
      const toShow = newFilms.slice(0, INITIAL_DISPLAY)
      clientBuffer = newFilms.slice(INITIAL_DISPLAY)
      films = [...films, ...toShow]
      if (toShow.length > 0) fetchProvidersForFilms(toShow)
    } catch {
      // silently fail
    } finally {
      loadingMore = false
    }
  }

  function handleAdd(e) {
    const film = e.detail
    const result = addFavorite($favorites, film)

    if (!result.success) {
      addMessage = result.reason === 'duplicate'
        ? 'Already in your list'
        : 'Your list is full (50/50)'
      addMessageFilmId = film.tmdb_id
      setTimeout(() => { addMessage = null; addMessageFilmId = null }, 3000)
      return
    }

    favorites.set(result.favorites)
    addMessage = 'Added!'
    addMessageFilmId = film.tmdb_id
    setTimeout(() => { addMessage = null; addMessageFilmId = null }, 1500)
  }

  function handleRemove(e) {
    favorites.set(removeFavorite($favorites, e.detail.tmdb_id))
    addMessage = 'Removed'
    addMessageFilmId = e.detail.tmdb_id
    setTimeout(() => { addMessage = null; addMessageFilmId = null }, 1500)
  }

  $: displayError = searchQuery.trim() ? searchError : filmsError
  $: loading = loadingFilms || isSearching
  $: showLoadMore = !loading && !displayError && (
    searchQuery.trim()
      ? (clientBuffer.length > 0 || hasMoreSearchPages)
      : (clientBuffer.length > 0 || hasMoreServerPages)
  )
</script>

<div class="page">
  <!-- Header row -->
  <div class="page-header">
    <h1>Add to List</h1>
    <span class="counter" class:full={isFull} title="Favorites count">
      {listCount} / {MAX_FAVORITES}
    </span>
  </div>

  <!-- Search bar -->
  <div class="search-wrap">
    <input
      class="search-input"
      type="search"
      placeholder="Search films…"
      bind:value={searchQuery}
      on:input={handleSearchInput}
      aria-label="Search films"
    />
    {#if isSearching}
      <span class="search-spinner" aria-hidden="true">⏳</span>
    {/if}
  </div>

  <!-- Genre filters (hidden while searching) -->
  {#if !searchQuery.trim()}
    <div class="genre-filters" role="group" aria-label="Genre filter">
      {#each GENRES as genre}
        <button
          class="genre-btn"
          class:active={selectedGenre.id === genre.id}
          on:click={() => loadGenre(genre)}
          aria-pressed={selectedGenre.id === genre.id}
        >
          {genre.name}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Results -->
  {#if loading}
    <div class="grid">
      <SkeletonCard count={12} />
    </div>
  {:else if displayError}
    <div class="error-state">
      {#if displayError === 'no-results'}
        <p>{searchQuery.trim() ? 'No films found for that search.' : 'No results for this genre right now.'}</p>
      {:else}
        <p>Couldn't connect — check your internet connection.</p>
        <button class="retry-btn" on:click={() => searchQuery.trim() ? runSearch(searchQuery) : loadGenre(selectedGenre)}>
          Try Again
        </button>
      {/if}
    </div>
  {:else}
    <div class="grid">
      {#each films as film (film.tmdb_id)}
        <div class="card-wrap">
          <FilmCard
            film={{...film, watch_providers: providerMap[film.tmdb_id] || []}}
            streamingPrefs={$streamingPrefs}
            isInList={isDuplicate($favorites, film.tmdb_id)}
            loadingProviders={loadingProviders && providerMap[film.tmdb_id] === undefined}
            on:add={handleAdd}
            on:remove={handleRemove}
          />
          {#if addMessageFilmId === film.tmdb_id && addMessage}
            <div class="add-message" class:success={addMessage === 'Added!'}>
              {addMessage}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if showLoadMore}
    <div class="load-more-wrap">
      <button
        class="load-more-btn"
        on:click={searchQuery.trim() ? loadMoreSearch : loadMoreGenre}
        disabled={loadingMore}
      >
        {loadingMore ? 'Loading…' : 'Load more'}
      </button>
      <button
        class="back-top-btn"
        on:click={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        ↑ Back to top
      </button>
    </div>
  {/if}
</div>

<style>
  .page {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
    min-width: 0;
    overflow: hidden;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }

  .counter {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 4px 12px;
  }

  .counter.full {
    border-color: var(--accent);
    color: var(--accent);
  }

  .search-wrap {
    position: relative;
    margin-bottom: 1rem;
    width: 100%;
  }

  .search-input {
    width: 100%;
    min-width: 0;
    padding: 0.65rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-primary);
    font-size: 1rem;
    outline: none;
    transition: border-color 0.15s;
  }

  .search-input:focus { border-color: var(--accent); }
  .search-input::placeholder { color: var(--text-muted); }

  .search-spinner {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.875rem;
  }

  .genre-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .genre-btn {
    padding: 0.35rem 0.875rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    color: var(--text-secondary);
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .genre-btn:hover,
  .genre-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1rem;
    width: 100%;
  }

  @media (max-width: 480px) {
    .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  .card-wrap {
    position: relative;
    overflow: hidden;
    min-width: 0;
  }

  .add-message {
    position: absolute;
    bottom: 0.5rem;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    background: rgba(0,0,0,0.85);
    color: var(--warning);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    pointer-events: none;
    z-index: 10;
  }

  .add-message.success {
    color: var(--success);
  }

  .error-state {
    padding: 3rem 1rem;
    text-align: center;
    color: var(--text-secondary);
  }

  .retry-btn {
    margin-top: 0.75rem;
    padding: 0.5rem 1.25rem;
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.875rem;
  }

  .retry-btn:hover { border-color: var(--accent); color: var(--accent); }

  .load-more-wrap {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
    flex-wrap: wrap;
  }

  .back-top-btn {
    padding: 0.6rem 1.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .back-top-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .load-more-btn {
    padding: 0.6rem 2rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-primary);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .load-more-btn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }

  .load-more-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
