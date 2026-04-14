import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import TrialTracker from './TrialTracker.svelte'
import { resetStores } from '../test/resetStores.js'
import { trialNotes } from '../lib/stores.js'

beforeEach(() => {
  resetStores()
})

describe('TrialTracker', () => {
  describe('empty state', () => {
    it('shows empty state when there are no notes', () => {
      render(TrialTracker)
      expect(screen.getByText(/No notes yet/)).toBeTruthy()
    })

    it('shows "Add Your First Note" button in empty state', () => {
      render(TrialTracker)
      expect(screen.getByText('Add Your First Note')).toBeTruthy()
    })
  })

  describe('add note modal', () => {
    it('opens modal when "+ Add Note" is clicked', async () => {
      render(TrialTracker)
      await fireEvent.click(screen.getByText('+ Add Note'))
      expect(screen.getByRole('dialog')).toBeTruthy()
      expect(screen.getByLabelText('Note text')).toBeTruthy()
    })

    it('Save Note button is disabled when textarea is empty', async () => {
      render(TrialTracker)
      await fireEvent.click(screen.getByText('+ Add Note'))
      const saveBtn = screen.getByText('Save Note')
      expect(saveBtn.disabled).toBe(true)
    })

    it('Save Note button enables when text is entered', async () => {
      render(TrialTracker)
      await fireEvent.click(screen.getByText('+ Add Note'))
      const textarea = screen.getByLabelText('Note text')
      await fireEvent.input(textarea, { target: { value: 'My trial note' } })
      const saveBtn = screen.getByText('Save Note')
      expect(saveBtn.disabled).toBe(false)
    })

    it('saves note and closes modal on Save Note click', async () => {
      render(TrialTracker)
      await fireEvent.click(screen.getByText('+ Add Note'))
      const textarea = screen.getByLabelText('Note text')
      await fireEvent.input(textarea, { target: { value: 'My trial note' } })
      await fireEvent.click(screen.getByText('Save Note'))
      expect(screen.queryByRole('dialog')).toBeFalsy()
      expect(screen.getByText('My trial note')).toBeTruthy()
    })

    it('closes modal on Cancel click', async () => {
      render(TrialTracker)
      await fireEvent.click(screen.getByText('+ Add Note'))
      await fireEvent.click(screen.getByText('Cancel'))
      expect(screen.queryByRole('dialog')).toBeFalsy()
    })

    it('does not add note when Cancel is clicked (blank textarea)', async () => {
      render(TrialTracker)
      await fireEvent.click(screen.getByText('+ Add Note'))
      await fireEvent.click(screen.getByText('Cancel'))
      // Still in empty state
      expect(screen.getByText(/No notes yet/)).toBeTruthy()
    })

    it('shows character count as user types', async () => {
      render(TrialTracker)
      await fireEvent.click(screen.getByText('+ Add Note'))
      const textarea = screen.getByLabelText('Note text')
      await fireEvent.input(textarea, { target: { value: 'Hello' } })
      expect(screen.getByText(/5 \/ 500/)).toBeTruthy()
    })
  })

  describe('notes list', () => {
    beforeEach(() => {
      trialNotes.set([
        { id: 'note-1', text: 'First note about Netflix', created_at: new Date('2025-01-01').toISOString() },
        { id: 'note-2', text: 'Second note about Hulu',   created_at: new Date('2025-01-02').toISOString() }
      ])
    })

    it('renders notes in the list', () => {
      render(TrialTracker)
      expect(screen.getByText('First note about Netflix')).toBeTruthy()
      expect(screen.getByText('Second note about Hulu')).toBeTruthy()
    })

    it('truncates long notes at 80 chars with ellipsis', () => {
      const longText = 'A'.repeat(100)
      trialNotes.set([{ id: 'n1', text: longText, created_at: new Date().toISOString() }])
      render(TrialTracker)
      expect(screen.getByText('A'.repeat(80) + '…')).toBeTruthy()
    })

    it('opens view modal when a note is clicked', async () => {
      render(TrialTracker)
      // Multiple note cards match /Open note from/, pick the first
      const noteCards = screen.getAllByLabelText(/Open note from/)
      await fireEvent.click(noteCards[0])
      expect(screen.getByRole('dialog')).toBeTruthy()
    })

    it('closes view modal on Close button click', async () => {
      render(TrialTracker)
      await fireEvent.click(screen.getByText('First note about Netflix'))
      // There's a Close button in the view modal
      await fireEvent.click(screen.getByText('Close'))
      expect(screen.queryByRole('dialog')).toBeFalsy()
    })

    it('deletes note when Delete Note is clicked in view modal', async () => {
      render(TrialTracker)
      await fireEvent.click(screen.getByText('First note about Netflix'))
      await fireEvent.click(screen.getByText('Delete Note'))
      expect(screen.queryByText('First note about Netflix')).toBeFalsy()
    })

    it('closes view modal after deleting note', async () => {
      render(TrialTracker)
      await fireEvent.click(screen.getByText('First note about Netflix'))
      await fireEvent.click(screen.getByText('Delete Note'))
      expect(screen.queryByRole('dialog')).toBeFalsy()
    })
  })
})
