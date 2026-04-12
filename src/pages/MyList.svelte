<script>
  import { push } from 'svelte-spa-router'
  import { favorites, streamingCache, streamingPrefs } from '../lib/stores.js'
  import { removeFavorite } from '../lib/logic/favoritesLogic.js'
  import FilmCard from '../lib/components/FilmCard.svelte'

  function handleRemove(e) {
    favorites.set(removeFavorite($favorites, e.detail.tmdb_id))
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
    {#if $favorites.length < 50}
      <button class="add-more-btn" on:click={() => push('/add')}>
        + Add More
      </button>
    {/if}
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

  .list-count {
    font-size: 0.8125rem;
    color: var(--text-muted);
    margin: 0 0 1rem;
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

  .add-more-btn:hover { background: #c73550; }

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

  .btn-primary:hover { background: #c73550; }
</style>
