<script>
  // provider: { provider_id, provider_name, logo_path, streaming_type, watch_link }
  // subscribed: boolean — whether user has this service in streaming_prefs
  // filmId: tmdb_id — used to build watch link for cached providers that predate the watch_link field
  export let provider
  export let subscribed = false
  export let filmId = null

  const LOGO_BASE = 'https://image.tmdb.org/t/p/original'
  const TMDB_WATCH_BASE = 'https://www.themoviedb.org/movie/'

  // Prefer the API-supplied watch_link; fall back to client-side construction
  // for free/ads providers when filmId is available (handles stale streamingCache entries)
  $: watchLink = provider.watch_link
    || (filmId && (provider.streaming_type === 'free' || provider.streaming_type === 'ads')
      ? `${TMDB_WATCH_BASE}${filmId}/watch?locale=US`
      : null)
</script>

{#if watchLink}
  <a
    class="badge linkable"
    class:subscribed
    href={watchLink}
    target="_blank"
    rel="noopener noreferrer"
    title="Watch on {provider.provider_name} — opens TMDB streaming page"
  >
    {#if provider.logo_path}
      <img
        src="{LOGO_BASE}{provider.logo_path}"
        alt={provider.provider_name}
        class="badge-logo"
        loading="lazy"
      />
    {/if}
    <span class="badge-name">{provider.provider_name}</span>
    <span class="badge-arrow" aria-hidden="true">↗</span>
  </a>
{:else}
  <span
    class="badge"
    class:subscribed
    title="{provider.provider_name}{subscribed ? ' (subscribed)' : ''} — Availability updated daily"
  >
    {#if provider.logo_path}
      <img
        src="{LOGO_BASE}{provider.logo_path}"
        alt={provider.provider_name}
        class="badge-logo"
        loading="lazy"
      />
    {/if}
    <span class="badge-name">{provider.provider_name}</span>
  </span>
{/if}

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px 3px 4px;
    border-radius: 999px;
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    font-size: 0.7rem;
    color: var(--text-secondary);
    white-space: nowrap;
    cursor: default;
    transition: border-color 0.15s, background 0.15s;
    max-width: 100%;
    overflow: hidden;
    text-decoration: none;
  }

  .badge.linkable {
    cursor: pointer;
  }

  .badge.linkable:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-dim);
  }

  .badge.subscribed {
    border-color: var(--success);
    background: var(--success-dim);
    color: var(--success);
  }

  .badge-arrow {
    font-size: 0.65rem;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .badge-logo {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .badge-name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
