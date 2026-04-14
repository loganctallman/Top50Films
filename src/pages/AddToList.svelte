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
  const LOAD_MORE_SIZE = 12

  let films = []
  let clientBuffer = []        // fetched but not yet shown
  let isFetchingBuffer = false // prevent concurrent background fetches
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

  // Person / Director / Actor search
  let searchMode = 'film' // 'film' | 'person'
  let modeOpen = false
  let personResults = []
  let selectedPerson = null
  let personSearching = false
  let personError = null
  let personDebounce

  function selectMode(mode) {
    searchMode = mode
    modeOpen = false
    handleModeChange()
  }

  function handleWindowClick(e) {
    if (!e.target.closest('.mode-dropdown-wrap')) modeOpen = false
  }

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
    isFetchingBuffer = false
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
    prefetchGenreBuffer()
  }

  // Background: fetch next genre page into buffer if not already fetching
  async function prefetchGenreBuffer() {
    if (isFetchingBuffer || !hasMoreServerPages) return
    isFetchingBuffer = true
    const nextPage = currentPage + 1
    try {
      const data = await apiService.genreTop50(selectedGenre.id, nextPage)
      const newFilms = data.results || []
      currentPage = nextPage
      hasMoreServerPages = newFilms.length === 20
      clientBuffer = [...clientBuffer, ...newFilms]
      if (newFilms.length > 0) fetchProvidersForFilms(newFilms)
    } catch {
      // silently fail — buffer stays as-is
    } finally {
      isFetchingBuffer = false
    }
  }

  async function loadMoreGenre() {
    if (loadingMore) return
    loadingMore = true

    // If buffer is unexpectedly empty, do a blocking fetch
    if (clientBuffer.length === 0 && hasMoreServerPages) {
      await prefetchGenreBuffer()
    }

    const toShow = clientBuffer.slice(0, LOAD_MORE_SIZE)
    clientBuffer = clientBuffer.slice(LOAD_MORE_SIZE)
    films = [...films, ...toShow]
    if (toShow.length > 0) fetchProvidersForFilms(toShow)

    loadingMore = false

    // Refill buffer in background after every display
    prefetchGenreBuffer()
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

  function handleModeChange() {
    searchQuery = ''
    films = []
    clientBuffer = []
    isFetchingBuffer = false
    providerMap = {}
    filmsError = null
    searchError = null
    personResults = []
    selectedPerson = null
    personError = null
    if (searchMode === 'film') loadGenre(selectedGenre)
  }

  function handleSearchInput() {
    if (searchMode === 'person') {
      handlePersonSearchInput()
      return
    }
    clearTimeout(searchDebounce)
    if (!searchQuery.trim()) {
      loadGenre(selectedGenre)
      return
    }
    searchDebounce = setTimeout(() => runSearch(searchQuery), 400)
  }

  function handlePersonSearchInput() {
    if (selectedPerson) {
      selectedPerson = null
      films = []
      clientBuffer = []
      providerMap = {}
      filmsError = null
    }
    clearTimeout(personDebounce)
    if (!searchQuery.trim()) {
      personResults = []
      personError = null
      return
    }
    personDebounce = setTimeout(() => runPersonSearch(searchQuery), 400)
  }

  async function runPersonSearch(query) {
    personSearching = true
    personError = null
    personResults = []
    try {
      const data = await apiService.personSearch(query)
      personResults = data.results || []
      if (personResults.length === 0) personError = 'no-results'
    } catch {
      personError = 'network'
    } finally {
      personSearching = false
    }
  }

  async function loadPersonFilmography(person) {
    selectedPerson = person
    personResults = []
    films = []
    clientBuffer = []
    providerMap = {}
    filmsError = null
    loadingFilms = true
    try {
      const data = await apiService.personFilmography(person.id)
      const all = data.results || []
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

  function clearSelectedPerson() {
    selectedPerson = null
    searchQuery = ''
    films = []
    clientBuffer = []
    providerMap = {}
    filmsError = null
    personResults = []
    personError = null
  }

  function loadMorePerson() {
    const toShow = clientBuffer.slice(0, LOAD_MORE_SIZE)
    clientBuffer = clientBuffer.slice(LOAD_MORE_SIZE)
    films = [...films, ...toShow]
    if (toShow.length > 0) fetchProvidersForFilms(toShow)
  }

  async function runSearch(query) {
    films = []
    clientBuffer = []
    isFetchingBuffer = false
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
    prefetchSearchBuffer()
  }

  // Background: fetch next search page into buffer if not already fetching
  async function prefetchSearchBuffer() {
    if (isFetchingBuffer || !hasMoreSearchPages) return
    isFetchingBuffer = true
    const nextPage = searchPage + 1
    try {
      const data = await apiService.search(searchQuery, nextPage)
      const newFilms = data.results || []
      searchPage = nextPage
      hasMoreSearchPages = newFilms.length === 20
      clientBuffer = [...clientBuffer, ...newFilms]
      if (newFilms.length > 0) fetchProvidersForFilms(newFilms)
    } catch {
      // silently fail
    } finally {
      isFetchingBuffer = false
    }
  }

  async function loadMoreSearch() {
    if (loadingMore) return
    loadingMore = true

    // If buffer is unexpectedly empty, do a blocking fetch
    if (clientBuffer.length === 0 && hasMoreSearchPages) {
      await prefetchSearchBuffer()
    }

    const toShow = clientBuffer.slice(0, LOAD_MORE_SIZE)
    clientBuffer = clientBuffer.slice(LOAD_MORE_SIZE)
    films = [...films, ...toShow]
    if (toShow.length > 0) fetchProvidersForFilms(toShow)

    loadingMore = false

    // Refill buffer in background after every display
    prefetchSearchBuffer()
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

  $: displayError = searchMode === 'person'
    ? (selectedPerson ? filmsError : null)
    : (searchQuery.trim() ? searchError : filmsError)
  $: loading = loadingFilms || (searchMode === 'film' && isSearching)
  $: showLoadMore = !loading && !displayError && (
    searchMode === 'person'
      ? (!!selectedPerson && clientBuffer.length > 0)
      : searchQuery.trim()
        ? (clientBuffer.length > 0 || hasMoreSearchPages)
        : (clientBuffer.length > 0 || hasMoreServerPages)
  )
</script>

<svelte:window on:click={handleWindowClick} />

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
    <div class="mode-dropdown-wrap">
      <button
        class="mode-btn"
        on:click|stopPropagation={() => modeOpen = !modeOpen}
        aria-haspopup="listbox"
        aria-expanded={modeOpen}
      >
        {searchMode === 'film' ? 'Film' : 'Director / Actor'}
        <span class="mode-arrow" aria-hidden="true">▾</span>
      </button>
      {#if modeOpen}
        <ul class="mode-options" role="listbox">
          <li>
            <button
              class="mode-option"
              class:selected={searchMode === 'film'}
              role="option"
              aria-selected={searchMode === 'film'}
              on:click={() => selectMode('film')}
            >Film</button>
          </li>
          <li>
            <button
              class="mode-option"
              class:selected={searchMode === 'person'}
              role="option"
              aria-selected={searchMode === 'person'}
              on:click={() => selectMode('person')}
            >Director / Actor</button>
          </li>
        </ul>
      {/if}
    </div>
    <input
      class="search-input"
      type="search"
      placeholder={searchMode === 'film' ? 'Search films…' : 'Search directors & actors…'}
      bind:value={searchQuery}
      on:input={handleSearchInput}
      aria-label={searchMode === 'film' ? 'Search films' : 'Search directors and actors'}
    />
    {#if isSearching || personSearching}
      <span class="search-spinner" aria-hidden="true">⏳</span>
    {/if}
  </div>

  <!-- Genre filters (film mode only, hidden while searching) -->
  {#if searchMode === 'film' && !searchQuery.trim()}
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

  <!-- Person search results -->
  {#if searchMode === 'person' && !selectedPerson}
    {#if personSearching}
      <div class="person-searching">Searching…</div>
    {:else if personResults.length > 0}
      <ul class="person-list" role="list">
        {#each personResults as person (person.id)}
          <li>
            <button class="person-item" on:click={() => loadPersonFilmography(person)}>
              <span class="person-name">{person.name}</span>
              <span class="person-dept">{person.known_for_department}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else if personError === 'no-results'}
      <div class="error-state"><p>No results found for that name.</p></div>
    {:else if personError === 'network'}
      <div class="error-state">
        <p>Couldn't connect — check your internet connection.</p>
        <button class="retry-btn" on:click={() => runPersonSearch(searchQuery)}>Try Again</button>
      </div>
    {:else}
      <div class="person-prompt">
        <p>Search for a director or actor above to browse their filmography.</p>
      </div>
    {/if}

  {:else}
    <!-- Person filmography breadcrumb -->
    {#if searchMode === 'person' && selectedPerson && !loading}
      <div class="person-breadcrumb">
        <button class="breadcrumb-back" on:click={clearSelectedPerson}>← Back</button>
        <span class="breadcrumb-name">{selectedPerson.name}</span>
        <span class="breadcrumb-dept">{selectedPerson.known_for_department}</span>
      </div>
    {/if}

    <!-- Film grid (both modes) -->
    {#if loading}
      <div class="grid">
        <SkeletonCard count={12} />
      </div>
    {:else if displayError}
      <div class="error-state">
        {#if displayError === 'no-results'}
          <p>{searchMode === 'person' ? 'No films found for this person.' : searchQuery.trim() ? 'No films found for that search.' : 'No results for this genre right now.'}</p>
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
          on:click={searchMode === 'person' ? loadMorePerson : (searchQuery.trim() ? loadMoreSearch : loadMoreGenre)}
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
    display: flex;
    align-items: stretch;
  }

  .mode-dropdown-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .mode-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0 0.875rem;
    height: 100%;
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    border-right: none;
    border-radius: var(--radius) 0 0 var(--radius);
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 0.15s, color 0.15s;
  }

  .mode-btn:hover,
  .mode-btn:focus {
    border-color: var(--accent);
    color: var(--text-primary);
    outline: none;
  }

  .mode-arrow {
    font-size: 0.6rem;
    color: var(--text-muted);
  }

  .mode-options {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 160px;
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    list-style: none;
    padding: 0.25rem;
    margin: 0;
    z-index: 100;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  }

  .mode-option {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: none;
    border: none;
    border-radius: calc(var(--radius) - 2px);
    color: var(--text-secondary);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }

  .mode-option:hover {
    background: var(--surface);
    color: var(--text-primary);
  }

  .mode-option.selected {
    color: var(--accent);
    font-weight: 600;
  }

  .search-input {
    flex: 1;
    min-width: 0;
    padding: 0.65rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 0 var(--radius) var(--radius) 0;
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
    pointer-events: none;
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
    color: var(--bg);
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

  /* Person search */
  .person-prompt {
    padding: 3rem 1rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .person-searching {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .person-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .person-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
  }

  .person-item:hover {
    border-color: var(--accent);
    background: var(--surface-elevated);
  }

  .person-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .person-dept {
    font-size: 0.75rem;
    color: var(--text-secondary);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Person filmography breadcrumb */
  .person-breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .breadcrumb-back {
    background: none;
    border: none;
    padding: 0;
    color: var(--accent);
    font-size: 0.875rem;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.15s;
  }

  .breadcrumb-back:hover { opacity: 0.75; }

  .breadcrumb-name {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .breadcrumb-dept {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
</style>
