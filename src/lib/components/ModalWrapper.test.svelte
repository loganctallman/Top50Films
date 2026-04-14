<script>
  import { createEventDispatcher } from 'svelte'
  import Modal from './Modal.svelte'

  export let title = ''

  const dispatch = createEventDispatcher()
  let open = true

  function handleClose() {
    open = false
    dispatch('modalClosed')
  }
</script>

{#if open}
  <Modal {title} on:close={handleClose}>
    <span>Modal slot content</span>
  </Modal>
{/if}
