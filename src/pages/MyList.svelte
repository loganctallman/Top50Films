<script>
  import { push } from 'svelte-spa-router'
  import { favorites, streamingCache, streamingPrefs } from '../lib/stores.js'
  import { removeFavorite } from '../lib/logic/favoritesLogic.js'
  import FilmCard from '../lib/components/FilmCard.svelte'

  let removeAllStep = 0 // 0 = idle, 1 = confirming

  function handleRemove(e) {
    favorites.set(removeFavorite($favorites, e.detail.tmdb_id))
  }

  function removeAll() {
    favorites.set([])
    removeAllStep = 0
  }

  function filmWithProviders(film) {
    const entry = $streamingCache[film.tmdb_id]
    return {
      ...film,
      watch_providers: entry?.providers || []
    }
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>My List</h1>
    <div class="header-actions">
      {#if $favorites.length > 0}
        {#if removeAllStep === 0}
          <button class="remove-all-btn" on:click={() => removeAllStep = 1}>
            Remove All
          </button>
        {:else}
          <div class="confirm-row">
            <span class="confirm-label">Remove all?</span>
            <button class="confirm-yes" on:click={removeAll}>Yes</button>
            <button class="confirm-cancel" on:click={() => removeAllStep = 0}>Cancel</button>
          </div>
        {/if}
      {/if}
      {#if $favorites.length < 50}
        <button class="add-more-btn" on:click={() => push('/add')}>
          + Add More
        </button>
      {/if}
    </div>
  </div>

  {#if $favorites.length === 0}
    <div class="empty-state">
      <p class="empty-icon">🎬</p>
      <p>Your list is empty — add your favorite films</p>
      <button class="btn-primary" on:click={() => push('/add')}>Browse Films</button>
    </div>
  {:else}
    <p class="list-count">{$favorites.length} / 50 favorites</p>
    <div class="grid">
      {#each $favorites as film (film.tmdb_id)}
        <FilmCard
          film={filmWithProviders(film)}
          streamingPrefs={$streamingPrefs}
          variant="remove"
          on:remove={handleRemove}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
    box-sizing: border-box;
    overflow-x: hidden;
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

  .list-count {
    font-size: 0.8125rem;
    color: var(--text-muted);
    margin: 0 0 1rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .remove-all-btn {
    padding: 0.4rem 1rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 0.15s, color 0.15s;
  }

  .remove-all-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .confirm-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .confirm-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .confirm-yes {
    padding: 0.35rem 0.75rem;
    background: var(--accent);
    border: none;
    border-radius: var(--radius);
    color: #fff;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .confirm-yes:hover { background: var(--accent-dark); }

  .confirm-cancel {
    padding: 0.35rem 0.75rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-secondary);
    font-size: 0.8rem;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .confirm-cancel:hover {
    border-color: var(--text-secondary);
    color: var(--text-primary);
  }

  .add-more-btn {
    padding: 0.4rem 1rem;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .add-more-btn:hover { background: var(--accent-dark); }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1rem;
  }

  @media (max-width: 480px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }

  .empty-state {
    text-align: center;
    padding: 4rem 1rem;
    color: var(--text-secondary);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .empty-icon { font-size: 3rem; margin: 0; }

  .btn-primary {
    padding: 0.65rem 1.5rem;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-primary:hover { background: var(--accent-dark); }
</style>
