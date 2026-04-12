<script>
  import { onMount } from 'svelte'
  import { push } from 'svelte-spa-router'
  import { favorites, streamingPrefs } from '../lib/stores.js'
  import { apiService } from '../lib/services/apiService.js'
  import { addFavorite, isDuplicate, MAX_FAVORITES } from '../lib/logic/favoritesLogic.js'
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
  let films = []
  let loadingFilms = false
  let loadingProviders = false
  let filmsError = null

  let searchQuery = ''
  let searchDebounce
  let isSearching = false
  let searchError = null

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
    providerMap = {}
    filmsError = null
    loadingFilms = true

    try {
      const data = await apiService.genreTop50(genre.id)
      films = data.results || []
      if (films.length === 0) filmsError = 'no-results'
    } catch {
      filmsError = 'network'
    } finally {
      loadingFilms = false
    }

    if (films.length > 0) fetchProvidersForFilms(films)
  }

  async function fetchProvidersForFilms(filmList) {
    loadingProviders = true
    const ids = filmList.map(f => f.tmdb_id)
    const results = await Promise.allSettled(ids.map(id => apiService.movie(id)))
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        providerMap[ids[i]] = result.value.watch_providers || []
      } else {
        providerMap[ids[i]] = null // null = failed
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
    providerMap = {}
    searchError = null
    isSearching = true

    try {
      const data = await apiService.search(query)
      films = data.results || []
      if (films.length === 0) searchError = 'no-results'
    } catch {
      searchError = 'network'
    } finally {
      isSearching = false
    }

    if (films.length > 0) fetchProvidersForFilms(films)
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

  function filmWithProviders(film) {
    const providers = providerMap[film.tmdb_id]
    return { ...film, watch_providers: providers || [] }
  }

  $: displayError = searchQuery.trim() ? searchError : filmsError
  $: loading = loadingFilms || isSearching
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
        {@const enriched = filmWithProviders(film)}
        <div class="card-wrap">
          <FilmCard
            film={enriched}
            streamingPrefs={$streamingPrefs}
            isInList={isDuplicate($favorites, film.tmdb_id)}
            loadingProviders={loadingProviders && providerMap[film.tmdb_id] === undefined}
            on:add={handleAdd}
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
</div>

<style>
  .page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
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
  }

  .search-input {
    width: 100%;
    padding: 0.65rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-primary);
    font-size: 0.9375rem;
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
  }

  @media (max-width: 480px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }

  .card-wrap {
    position: relative;
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
</style>
