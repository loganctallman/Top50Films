<script>
  import { trialNotes } from '../lib/stores.js'
  import Modal from '../lib/components/Modal.svelte'

  const MAX_CHARS = 500
  const PREVIEW_LEN = 80

  let showAddModal = false
  let noteText = ''
  let viewNote = null // the note currently being read

  function openAdd() {
    noteText = ''
    showAddModal = true
  }

  function saveNote() {
    const text = noteText.trim()
    if (!text) return
    trialNotes.update(notes => [
      ...notes,
      { id: crypto.randomUUID(), text, created_at: new Date().toISOString() }
    ])
    showAddModal = false
  }

  function deleteNote(id) {
    trialNotes.update(notes => notes.filter(n => n.id !== id))
    viewNote = null
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    })
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>Free Trial Tracker</h1>
      <p class="disclaimer">Notes are stored only on this device. Nothing is sent anywhere.</p>
    </div>
    <button class="btn-primary" on:click={openAdd}>+ Add Note</button>
  </div>

  {#if $trialNotes.length === 0}
    <div class="empty-state">
      <p class="empty-icon">📝</p>
      <p>No notes yet — track your free trials here</p>
      <button class="btn-primary" on:click={openAdd}>Add Your First Note</button>
    </div>
  {:else}
    <ul class="notes-list" role="list">
      {#each [...$trialNotes].reverse() as note (note.id)}
        <li>
          <button
            class="note-card"
            on:click={() => viewNote = note}
            aria-label="Open note from {formatDate(note.created_at)}"
          >
            <p class="note-preview">
              {note.text.length > PREVIEW_LEN
                ? note.text.slice(0, PREVIEW_LEN) + '…'
                : note.text}
            </p>
            <span class="note-date">{formatDate(note.created_at)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<!-- Add Note Modal -->
{#if showAddModal}
  <Modal title="Add Note" on:close={() => showAddModal = false}>
    <div class="add-form">
      <textarea
        class="note-textarea"
        bind:value={noteText}
        maxlength={MAX_CHARS}
        placeholder="Type your note here…"
        rows="6"
        aria-label="Note text"
      ></textarea>
      <p class="char-count" class:near-limit={noteText.length > MAX_CHARS * 0.85}>
        {noteText.length} / {MAX_CHARS}
      </p>
      <div class="modal-actions">
        <button
          class="btn-primary"
          disabled={!noteText.trim()}
          on:click={saveNote}
        >Save Note</button>
        <button class="btn-ghost" on:click={() => showAddModal = false}>Cancel</button>
      </div>
    </div>
  </Modal>
{/if}

<!-- View Note Modal -->
{#if viewNote}
  <Modal title="Note" on:close={() => viewNote = null}>
    <div class="view-form">
      <p class="view-date">{formatDate(viewNote.created_at)}</p>
      <p class="view-text">{viewNote.text}</p>
      <div class="modal-actions">
        <button
          class="btn-delete"
          on:click={() => deleteNote(viewNote.id)}
        >Delete Note</button>
        <button class="btn-ghost" on:click={() => viewNote = null}>Close</button>
      </div>
    </div>
  </Modal>
{/if}

<style>
  .page {
    max-width: 680px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
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

  .notes-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .note-card {
    width: 100%;
    text-align: left;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 1rem 1.25rem;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.15s;
  }

  .note-card:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }

  .note-preview {
    color: var(--text-primary);
    font-size: 0.9rem;
    margin: 0 0 0.5rem;
    line-height: 1.5;
    word-break: break-word;
  }

  .note-date {
    font-size: 0.75rem;
    color: var(--text-muted);
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

  /* Modal content */
  .add-form,
  .view-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .note-textarea {
    width: 100%;
    padding: 0.75rem;
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-primary);
    font-size: 0.9375rem;
    line-height: 1.6;
    resize: vertical;
    outline: none;
    font-family: inherit;
    transition: border-color 0.15s;
  }

  .note-textarea:focus { border-color: var(--accent); }
  .note-textarea::placeholder { color: var(--text-muted); }

  .char-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: right;
    margin: 0;
  }

  .char-count.near-limit { color: var(--warning); }

  .view-date {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0;
  }

  .view-text {
    color: var(--text-primary);
    font-size: 0.9375rem;
    line-height: 1.6;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .modal-actions {
    display: flex;
    gap: 0.625rem;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .btn-primary {
    padding: 0.55rem 1.25rem;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .btn-primary:not(:disabled):hover { background: #c73550; }

  .btn-ghost {
    padding: 0.55rem 1.25rem;
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.875rem;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .btn-ghost:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
  }

  .btn-delete {
    padding: 0.55rem 1.25rem;
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-delete:hover {
    background: rgba(233, 69, 96, 0.12);
  }
</style>
