<script>
  import { createEventDispatcher } from 'svelte'
  import StreamingBadge from './StreamingBadge.svelte'

  // film: { tmdb_id, title, year, poster_path, genre_ids, vote_average, watch_providers }
  export let film
  export let streamingPrefs = {}
  export let isInList = false
  // variant: 'add' (AddToList / Home suggestions) | 'remove' (MyList)
  export let variant = 'add'
  // When true, shows skeleton badge placeholders (providers still loading)
  export let loadingProviders = false

  const dispatch = createEventDispatcher()

  const POSTER_BASE = 'https://image.tmdb.org/t/p/w342'
  const TMDB_BASE = 'https://www.themoviedb.org/movie/'

  $: providers = film.watch_providers || []
  $: rating = film.vote_average ? film.vote_average.toFixed(1) : null

  let expanded = false
  $: firstProvider = providers[0] ?? null
  $: extraCount = providers.length - 1
</script>

<article class="film-card">
  <!-- Poster -->
  <div class="poster-wrap">
    {#if film.poster_path}
      <img
        src="{POSTER_BASE}{film.poster_path}"
        alt="Poster for {film.title}"
        class="poster"
        loading="lazy"
      />
    {:else}
      <div class="poster-placeholder">🎬</div>
    {/if}

    {#if rating}
      <span class="rating-badge" title="TMDB rating">⭐ {rating}</span>
    {/if}
  </div>

  <!-- Body -->
  <div class="card-body">
    <h2 class="card-title">
      <a
        href="{TMDB_BASE}{film.tmdb_id}"
        target="_blank"
        rel="noopener noreferrer"
        title={film.title}
      >{film.title}</a>
    </h2>

    {#if film.year}
      <span class="year">{film.year}</span>
    {/if}

    <!-- Streaming badges -->
    <div class="badges-section" aria-label="Streaming availability">
      {#if loadingProviders}
        <span class="badge-loading">Loading…</span>
      {:else if providers.length === 0}
        <span
          class="no-providers"
          title="Streaming info unavailable — Availability updated daily"
        >No streaming info</span>
      {:else if expanded}
        <div class="badges-row">
          {#each providers as provider (provider.provider_id)}
            <StreamingBadge
              {provider}
              filmId={film.tmdb_id}
              subscribed={!!streamingPrefs[provider.provider_id]}
            />
          {/each}
        </div>
        <button class="see-more-btn" on:click|stopPropagation={() => expanded = false}>
          Show less ▲
        </button>
      {:else}
        <div class="badges-row badges-collapsed">
          <StreamingBadge
            provider={firstProvider}
            subscribed={!!streamingPrefs[firstProvider.provider_id]}
          />
          {#if extraCount > 0}
            <button class="see-more-btn" on:click|stopPropagation={() => expanded = true}>
              +{extraCount} more ▾
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Action button -->
    {#if variant === 'add' && isInList}
      <button
        class="btn btn-remove"
        on:click={() => dispatch('remove', film)}
        aria-label="Remove {film.title} from your list"
      >
        − Remove from List
      </button>
    {:else if variant === 'add'}
      <button
        class="btn btn-add"
        on:click={() => dispatch('add', film)}
        title="Add to your favorites"
      >
        + Add to Favorites
      </button>
    {:else}
      <button
        class="btn btn-remove"
        on:click={() => dispatch('remove', film)}
        aria-label="Remove {film.title} from your list"
      >
        − Remove
      </button>
    {/if}
  </div>
</article>

<style>
  .film-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color 0.2s, transform 0.2s;
  }

  .film-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
  }

  .poster-wrap {
    position: relative;
    aspect-ratio: 2 / 3;
    background: var(--surface-elevated);
    overflow: hidden;
  }

  .poster {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .poster-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    color: var(--text-muted);
  }

  .rating-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(0,0,0,0.75);
    color: #fbbf24;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 3px 6px;
    border-radius: 4px;
    backdrop-filter: blur(4px);
  }

  .card-body {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex: 1;
  }

  .card-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.3;
    min-height: calc(0.875rem * 1.3 * 2);
  }

  .card-title a {
    color: inherit;
    text-decoration: none;
  }

  .card-title a:hover {
    color: var(--accent);
  }

  .year {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .badges-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0.15rem 0;
    min-height: 26px;
  }

  .badges-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }

  /* Collapsed state: single badge + button must share one line */
  .badges-collapsed {
    flex-wrap: nowrap;
    overflow: hidden;
  }

  /* Allow the badge to shrink so the "+X more" button always fits */
  .badges-collapsed :global(.badge) {
    min-width: 0;
    flex-shrink: 1;
    overflow: hidden;
  }

  .see-more-btn {
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

  .see-more-btn:hover {
    color: var(--accent);
  }

  .badge-loading,
  .no-providers {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .btn {
    margin-top: auto;
    padding: 0.45rem 0.75rem;
    border: none;
    border-radius: var(--radius);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-add {
    background: var(--accent);
    color: var(--bg);
  }

  .btn-add:hover:not(:disabled) {
    background: var(--accent-dark);
  }

  .btn-add.in-list,
  .btn-add:disabled {
    background: var(--surface-elevated);
    color: var(--text-muted);
    cursor: default;
  }

  .btn-remove {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }

  .btn-remove:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-dim);
  }
</style>
