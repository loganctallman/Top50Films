<script>
  // provider: { provider_id, provider_name, logo_path }
  // subscribed: boolean — whether user has this service in streaming_prefs
  export let provider
  export let subscribed = false

  const LOGO_BASE = 'https://image.tmdb.org/t/p/original'
</script>

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
    transition: border-color 0.15s;
    max-width: 100%;
    overflow: hidden;
  }

  .badge.subscribed {
    border-color: var(--success);
    background: var(--success-dim);
    color: var(--success);
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
