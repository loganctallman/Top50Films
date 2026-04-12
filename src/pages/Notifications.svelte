<script>
  import { notifications, streamingPrefs } from '../lib/stores.js'
  import StreamingBadge from '../lib/components/StreamingBadge.svelte'

  const POSTER_BASE = 'https://image.tmdb.org/t/p/w92'
  const TMDB_BASE = 'https://www.themoviedb.org/movie/'

  // Per-notification expanded state keyed by notif.id
  let expanded = {}

  function toggle(id) {
    expanded = { ...expanded, [id]: !expanded[id] }
  }
</script>

<div class="page">
  <div class="page-header">
    <h1>Notifications</h1>
    <p class="disclaimer">Availability data updated daily — minor delays possible</p>
  </div>

  {#if $notifications.length === 0}
    <div class="empty-state">
      <p class="empty-icon">🔔</p>
      {#if Object.keys($streamingPrefs).filter(k => $streamingPrefs[k]).length === 0}
        <p>No streaming services selected. <a href="#/settings">Go to Settings</a> to pick your services.</p>
      {:else}
        <p>None of your favorites are currently streaming on your selected services.</p>
      {/if}
    </div>
  {:else}
    <ul class="notification-list" role="list">
      {#each $notifications as notif (notif.id)}
        {@const allProviders = notif.providers || [notif.provider]}
        {@const isExpanded = !!expanded[notif.id]}
        {@const extraCount = allProviders.length - 1}

        <li class="notif-card">
          <a
            href="{TMDB_BASE}{notif.film.tmdb_id}"
            target="_blank"
            rel="noopener noreferrer"
            class="poster-link"
          >
            {#if notif.film.poster_path}
              <img
                src="{POSTER_BASE}{notif.film.poster_path}"
                alt={notif.film.title}
                class="notif-poster"
                loading="lazy"
              />
            {:else}
              <div class="notif-poster-placeholder">🎬</div>
            {/if}
          </a>

          <div class="notif-info">
            <p class="notif-title">
              <a
                href="{TMDB_BASE}{notif.film.tmdb_id}"
                target="_blank"
                rel="noopener noreferrer"
              >{notif.film.title}</a>
              {#if notif.film.year}
                <span class="notif-year">({notif.film.year})</span>
              {/if}
            </p>

            <div class="providers-section">
              <span class="now-streaming">Streaming on</span>
              <div class="badges-row">
                {#if isExpanded}
                  {#each allProviders as provider (provider.provider_id)}
                    <StreamingBadge
                      {provider}
                      subscribed={!!$streamingPrefs[provider.provider_id]}
                    />
                  {/each}
                  {#if extraCount > 0}
                    <button class="see-more-btn" on:click={() => toggle(notif.id)}>
                      Show less ▲
                    </button>
                  {/if}
                {:else}
                  <StreamingBadge
                    provider={notif.provider}
                    subscribed={true}
                  />
                  {#if extraCount > 0}
                    <button class="see-more-btn" on:click={() => toggle(notif.id)}>
                      +{extraCount} more ▾
                    </button>
                  {/if}
                {/if}
              </div>
            </div>
          </div>

          <a
            href="{TMDB_BASE}{notif.film.tmdb_id}"
            target="_blank"
            rel="noopener noreferrer"
            class="tmdb-link"
            aria-label="View {notif.film.title} on TMDB"
          >↗</a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .page {
    max-width: 800px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }

  .page-header {
    margin-bottom: 1.5rem;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
    color: var(--text-primary);
  }

  .disclaimer {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 0;
  }

  .notification-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .notif-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 0.875rem 1rem;
    transition: border-color 0.2s;
  }

  .notif-card:hover { border-color: var(--accent); }

  .poster-link { flex-shrink: 0; }

  .notif-poster {
    width: 48px;
    height: 72px;
    object-fit: cover;
    border-radius: 4px;
    display: block;
  }

  .notif-poster-placeholder {
    width: 48px;
    height: 72px;
    background: var(--surface-elevated);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
  }

  .notif-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .notif-title {
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    font-size: 0.9375rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .notif-title a {
    color: inherit;
    text-decoration: none;
  }

  .notif-title a:hover { color: var(--accent); }

  .notif-year {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 0.8rem;
  }

  .providers-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .now-streaming {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .badges-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
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

  .see-more-btn:hover { color: var(--accent); }

  .tmdb-link {
    color: var(--text-muted);
    font-size: 1.1rem;
    text-decoration: none;
    padding: 4px;
    flex-shrink: 0;
    transition: color 0.15s;
    align-self: flex-start;
  }

  .tmdb-link:hover { color: var(--accent); }

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

  .empty-state a { color: var(--accent); }
</style>
