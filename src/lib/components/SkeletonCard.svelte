<script>
  export let count = 1
</script>

{#each Array(count) as _}
  <div class="skeleton-card" aria-hidden="true">
    <div class="skeleton poster"></div>
    <div class="skeleton-body">
      <div class="skeleton line title"></div>
      <div class="skeleton line short"></div>
      <div class="skeleton line medium"></div>
      <div class="skeleton-badges">
        <div class="skeleton badge-pill"></div>
        <div class="skeleton badge-pill"></div>
      </div>
      <div class="skeleton btn"></div>
    </div>
  </div>
{/each}

<style>
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }

  .skeleton {
    background: linear-gradient(
      90deg,
      var(--surface-elevated) 25%,
      var(--border) 50%,
      var(--surface-elevated) 75%
    );
    background-size: 800px 100%;
    animation: shimmer 1.4s infinite linear;
    border-radius: var(--radius);
  }

  .skeleton-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .poster {
    width: 100%;
    aspect-ratio: 2 / 3;
    border-radius: 0;
  }

  .skeleton-body {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .line { height: 14px; }
  .title  { width: 80%; }
  .short  { width: 40%; height: 11px; }
  .medium { width: 60%; height: 11px; }

  .skeleton-badges {
    display: flex;
    gap: 0.35rem;
  }

  .badge-pill {
    height: 22px;
    width: 72px;
    border-radius: 999px;
  }

  .btn {
    height: 32px;
    width: 100%;
    margin-top: 0.25rem;
  }
</style>
