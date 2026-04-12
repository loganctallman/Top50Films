<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte'

  export let title = ''

  const dispatch = createEventDispatcher()

  let dialogEl

  function close() { dispatch('close') }

  function handleBackdrop(e) {
    if (e.target === dialogEl) close()
  }

  function trapFocus(e) {
    if (!dialogEl) return
    const focusable = dialogEl.querySelectorAll(
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus() }
      }
    }

    if (e.key === 'Escape') close()
  }

  onMount(() => {
    // Move focus into modal
    const firstFocusable = dialogEl?.querySelector(
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()

    document.body.style.overflow = 'hidden'
  })

  onDestroy(() => {
    document.body.style.overflow = ''
  })
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label={title}
  bind:this={dialogEl}
  on:click={handleBackdrop}
  on:keydown={trapFocus}
>
  <div class="modal">
    <div class="modal-header">
      {#if title}
        <h2 class="modal-title">{title}</h2>
      {/if}
      <button class="close-btn" aria-label="Close" on:click={close}>✕</button>
    </div>

    <div class="modal-body">
      <slot />
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 200;
  }

  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border);
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 1rem;
    padding: 4px 8px;
    border-radius: var(--radius);
    transition: color 0.15s, background 0.15s;
  }

  .close-btn:hover {
    color: var(--text-primary);
    background: var(--surface-elevated);
  }

  .modal-body {
    padding: 1.25rem;
    overflow-y: auto;
    flex: 1;
  }
</style>
