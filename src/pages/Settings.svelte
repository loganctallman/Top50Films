<script>
  import { onMount } from 'svelte'
  import { storageService } from '../lib/services/storageService.js'
  import { apiService } from '../lib/services/apiService.js'
  import { streamingPrefs, onboardingComplete, providerList } from '../lib/stores.js'

  const LOGO_BASE = 'https://image.tmdb.org/t/p/original'

  let allProviders = []
  let loadingProviders = true
  let providersError = null

  let deleteStep = 0 // 0 = idle, 1 = confirming
  let showAllProviders = false
  let providerSearch = ''

  const PROVIDER_LIMIT = 30

  $: filteredProviders = providerSearch.trim()
    ? allProviders.filter(p =>
        p.provider_name.toLowerCase().includes(providerSearch.trim().toLowerCase())
      )
    : allProviders

  $: visibleProviders = (providerSearch.trim() || showAllProviders)
    ? filteredProviders
    : filteredProviders.slice(0, PROVIDER_LIMIT)

  $: hasMore = !providerSearch.trim() && allProviders.length > PROVIDER_LIMIT

  onMount(async () => {
    try {
      const data = await apiService.providers()
      allProviders = data.results || []
      providerList.set(allProviders)
    } catch {
      providersError = 'network'
    } finally {
      loadingProviders = false
    }
  })

  function toggleProvider(id) {
    streamingPrefs.update(prefs => ({
      ...prefs,
      [id]: !prefs[id]
    }))
  }

  $: allSelected = allProviders.length > 0 && allProviders.every(p => $streamingPrefs[p.provider_id])

  function toggleAll() {
    if (allSelected) {
      // Deselect all
      streamingPrefs.update(prefs => {
        const updated = { ...prefs }
        allProviders.forEach(p => { updated[p.provider_id] = false })
        return updated
      })
    } else {
      // Select all
      streamingPrefs.update(prefs => {
        const updated = { ...prefs }
        allProviders.forEach(p => { updated[p.provider_id] = true })
        return updated
      })
    }
  }

  function deleteAllData() {
    storageService.clearAll()
    onboardingComplete.set(false)
    window.location.hash = '#/'
    window.location.reload()
  }
</script>

<div class="page">
  <h1>Settings</h1>

  <!-- Streaming Services -->
  <section class="section">
    <h2>Streaming Services</h2>
    <div class="section-desc-row">
      <p class="section-desc">Toggle the services you subscribe to. We'll highlight matching films in your list.</p>
      {#if allProviders.length > 0}
        <button class="toggle-all-btn" on:click={toggleAll}>
          {allSelected ? 'Deselect All Services' : 'Select All Services'}
        </button>
      {/if}
    </div>

    {#if allProviders.length > 0 && !loadingProviders && !providersError}
      <div class="provider-search-wrap">
        <div class="provider-search-row">
          <input
            class="provider-search"
            type="text"
            placeholder="Search services…"
            bind:value={providerSearch}
            aria-label="Search streaming services"
          />
          {#if providerSearch}
            <button
              class="clear-search-btn"
              on:click={() => providerSearch = ''}
              aria-label="Clear search"
            >Clear Search</button>
          {/if}
        </div>
        {#if providerSearch && filteredProviders.length === 0}
          <p class="provider-search-empty">No services match "{providerSearch}"</p>
        {/if}
      </div>
    {/if}

    {#if loadingProviders}
      <div class="providers-grid">
        {#each Array(12) as _}
          <div class="provider-skeleton"></div>
        {/each}
      </div>
    {:else if providersError}
      <div class="error-state">
        <p>Something went wrong loading streaming services. Try again.</p>
        <button class="retry-btn" on:click={() => { providersError = null; loadingProviders = true; apiService.providers().then(d => { allProviders = d.results || []; loadingProviders = false }).catch(() => { providersError = 'network'; loadingProviders = false }) }}>
          Try Again
        </button>
      </div>
    {:else if allProviders.length === 0}
      <p class="empty-note">No providers available.</p>
    {:else}
      <div class="providers-grid">
        {#each visibleProviders as provider (provider.provider_id)}
          {@const active = !!$streamingPrefs[provider.provider_id]}
          <button
            class="provider-card"
            class:active
            on:click={() => toggleProvider(provider.provider_id)}
            aria-pressed={active}
            title={provider.provider_name}
          >
            {#if provider.logo_path}
              <img
                src="{LOGO_BASE}{provider.logo_path}"
                alt={provider.provider_name}
                class="provider-logo"
                loading="lazy"
              />
            {:else}
              <div class="provider-logo-placeholder">📺</div>
            {/if}
            <span class="provider-name">{provider.provider_name}</span>
            {#if active}
              <span class="check-badge" aria-hidden="true">✓</span>
            {/if}
          </button>
        {/each}
      </div>
      {#if hasMore}
        <button class="show-all-btn" on:click={() => showAllProviders = !showAllProviders}>
          {showAllProviders ? 'Show less ▲' : `Show all ${allProviders.length} services ▾`}
        </button>
      {/if}
    {/if}
  </section>

  <!-- Reset -->
  <section class="section danger-section">
    <h2>Reset</h2>
    <p class="section-desc">This will permanently delete your favorites list, streaming preferences, notes, and all other app data.</p>

    {#if deleteStep === 0}
      <button
        class="btn-danger-outline"
        on:click={() => deleteStep = 1}
      >
        Delete All My Data
      </button>
    {:else}
      <div class="confirm-box">
        <p class="confirm-warning">
          ⚠️ This will erase everything and return you to the welcome screen. There is no undo.
        </p>
        <div class="confirm-actions">
          <button class="btn-danger" on:click={deleteAllData}>
            Yes, Delete Everything
          </button>
          <button class="btn-ghost" on:click={() => deleteStep = 0}>
            Cancel
          </button>
        </div>
      </div>
    {/if}
  </section>
</div>

<style>
  .page {
    max-width: 900px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 1.5rem;
    color: var(--text-primary);
  }

  .section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }

  h2 {
    font-size: 1rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
    color: var(--text-primary);
  }

  .section-desc-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .section-desc {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .toggle-all-btn {
    flex-shrink: 0;
    padding: 0.35rem 0.875rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-secondary);
    font-size: 0.8rem;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .toggle-all-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .show-all-btn {
    display: block;
    margin-top: 0.75rem;
    background: none;
    border: none;
    padding: 0;
    color: var(--text-muted);
    font-size: 0.8rem;
    cursor: pointer;
    transition: color 0.15s;
  }

  .show-all-btn:hover { color: var(--accent); }

  .provider-search-wrap {
    margin-bottom: 1rem;
  }

  .provider-search-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .provider-search {
    flex: 1;
    min-width: 0;
    padding: 0.55rem 0.875rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-primary);
    font-size: 1rem;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  /* suppress browser native clear button */
  .provider-search::-webkit-search-cancel-button { display: none; }

  .provider-search:focus { border-color: var(--accent); }
  .provider-search::placeholder { color: var(--text-muted); }

  .clear-search-btn {
    flex-shrink: 0;
    padding: 0.45rem 0.75rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: 0.8rem;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 0.15s, color 0.15s;
  }

  .clear-search-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .provider-search-empty {
    font-size: 0.8125rem;
    color: var(--text-muted);
    margin: 0.5rem 0 0;
  }

  .providers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.625rem;
  }

  .provider-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 0.75rem 0.5rem;
    background: var(--surface-elevated);
    border: 2px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    text-align: center;
  }

  .provider-card:hover { border-color: var(--text-secondary); }

  .provider-card.active {
    border-color: var(--success);
    background: var(--success-dim);
  }

  .provider-logo {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 8px;
  }

  .provider-logo-placeholder {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    background: var(--border);
    border-radius: 8px;
  }

  .provider-name {
    font-size: 0.7rem;
    color: var(--text-secondary);
    line-height: 1.2;
    word-break: break-word;
    max-width: 96px;
  }

  .active .provider-name { color: var(--success); }

  .check-badge {
    position: absolute;
    top: 6px;
    right: 8px;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--success);
  }

  .provider-skeleton {
    height: 90px;
    border-radius: var(--radius);
    background: var(--surface-elevated);
    animation: shimmer 1.4s infinite linear;
    background: linear-gradient(
      90deg,
      var(--surface-elevated) 25%,
      var(--border) 50%,
      var(--surface-elevated) 75%
    );
    background-size: 800px 100%;
  }

  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }

  .error-state {
    color: var(--text-secondary);
    font-size: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .retry-btn {
    padding: 0.45rem 1rem;
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.8125rem;
  }

  .retry-btn:hover { border-color: var(--accent); color: var(--accent); }

  .empty-note {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin: 0;
  }

  /* Danger section */
  .danger-section { border-color: rgba(233, 69, 96, 0.3); }

  .btn-danger-outline {
    padding: 0.6rem 1.25rem;
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-danger-outline:hover { background: rgba(233, 69, 96, 0.1); }

  .confirm-box {
    background: rgba(233, 69, 96, 0.08);
    border: 1px solid rgba(233, 69, 96, 0.3);
    border-radius: var(--radius);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .confirm-warning {
    color: #fca5a5;
    font-size: 0.875rem;
    margin: 0;
  }

  .confirm-actions {
    display: flex;
    gap: 0.625rem;
    flex-wrap: wrap;
  }

  .btn-danger {
    padding: 0.6rem 1.25rem;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-danger:hover { background: #c73550; }

  .btn-ghost {
    padding: 0.6rem 1.25rem;
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.875rem;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .btn-ghost:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
  }
</style>
