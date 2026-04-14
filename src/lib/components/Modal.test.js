import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import { tick } from 'svelte'
import ModalWrapper from './ModalWrapper.test.svelte'

// We test Modal via a thin wrapper that provides a slot
// See ModalWrapper.test.svelte alongside this file
describe('Modal', () => {
  describe('rendering', () => {
    it('renders the title', () => {
      render(ModalWrapper, { props: { title: 'Test Title' } })
      expect(screen.getByText('Test Title')).toBeTruthy()
    })

    it('renders slot content', () => {
      render(ModalWrapper, { props: { title: 'Any' } })
      expect(screen.getByText('Modal slot content')).toBeTruthy()
    })

    it('renders a close button', () => {
      render(ModalWrapper, { props: { title: 'Any' } })
      expect(screen.getByLabelText('Close')).toBeTruthy()
    })

    it('has role="dialog"', () => {
      render(ModalWrapper, { props: { title: 'Any' } })
      expect(document.querySelector('[role="dialog"]')).toBeTruthy()
    })

    it('has aria-modal="true"', () => {
      render(ModalWrapper, { props: { title: 'Any' } })
      expect(document.querySelector('[aria-modal="true"]')).toBeTruthy()
    })
  })

  describe('close behavior', () => {
    it('dispatches "close" event when close button is clicked', async () => {
      const { component } = render(ModalWrapper, { props: { title: 'Any' } })
      const events = []
      component.$on('modalClosed', () => events.push(true))
      await fireEvent.click(screen.getByLabelText('Close'))
      expect(events).toHaveLength(1)
    })

    it('dispatches "close" on Escape key', async () => {
      const { component } = render(ModalWrapper, { props: { title: 'Any' } })
      const events = []
      component.$on('modalClosed', () => events.push(true))
      const dialog = document.querySelector('[role="dialog"]')
      await fireEvent.keyDown(dialog, { key: 'Escape' })
      expect(events).toHaveLength(1)
    })

    it('dispatches "close" when clicking the backdrop', async () => {
      const { component } = render(ModalWrapper, { props: { title: 'Any' } })
      const events = []
      component.$on('modalClosed', () => events.push(true))
      const backdrop = document.querySelector('.backdrop')
      // Simulate click directly on the backdrop element (not on .modal child)
      await fireEvent.click(backdrop)
      expect(events).toHaveLength(1)
    })
  })

  describe('scroll lock', () => {
    it('sets body overflow to hidden on mount', () => {
      render(ModalWrapper, { props: { title: 'Any' } })
      // onMount in Svelte 4 runs synchronously during the initial flush
      expect(document.body.style.overflow).toBe('hidden')
    })
  })
})
