<script>
  import { onMount, onDestroy } from 'svelte'

  let offline = false

  function update() { offline = !navigator.onLine }

  onMount(() => {
    update()
    window.addEventListener('online',  update)
    window.addEventListener('offline', update)
  })

  onDestroy(() => {
    window.removeEventListener('online',  update)
    window.removeEventListener('offline', update)
  })
</script>

{#if offline}
  <div class="banner" role="status" aria-live="polite">
    <span class="icon">⚠️</span>
    You're offline — some features are unavailable
  </div>
{/if}

<style>
  .banner {
    position: sticky;
    top: 56px; /* below navbar */
    z-index: 99;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #7c3a00;
    color: #fde68a;
    font-size: 0.875rem;
    text-align: center;
  }

  .icon { font-size: 1rem; }
</style>
