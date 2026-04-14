import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import Settings from './Settings.svelte'
import { resetStores } from '../test/resetStores.js'
import { streamingPrefs, installPrompt } from '../lib/stores.js'

const mockProviders = [
  { provider_id: 8,   provider_name: 'Netflix',      logo_path: '/netflix.jpg' },
  { provider_id: 9,   provider_name: 'Amazon Prime', logo_path: '/amazon.jpg' },
  { provider_id: 73,  provider_name: 'Tubi TV',      logo_path: '/tubi.jpg' },
  { provider_id: 337, provider_name: 'Disney Plus',  logo_path: '/disney.jpg' }
]

beforeEach(() => {
  resetStores()
})

describe('Settings page', () => {
  describe('provider loading', () => {
    it('shows loading skeleton initially', () => {
      render(Settings)
      expect(document.querySelector('.provider-skeleton')).toBeTruthy()
    })

    it('shows providers after they load', async () => {
      render(Settings)
      await waitFor(() => {
        expect(screen.getByText('Netflix')).toBeTruthy()
      })
    })

    it('shows all provider names', async () => {
      render(Settings)
      await waitFor(() => {
        expect(screen.getByText('Netflix')).toBeTruthy()
        expect(screen.getByText('Amazon Prime')).toBeTruthy()
        expect(screen.getByText('Tubi TV')).toBeTruthy()
      })
    })
  })

  describe('provider toggles', () => {
    it('marks provider as active (aria-pressed) when clicked', async () => {
      render(Settings)
      await waitFor(() => screen.getByText('Netflix'))
      const netflixBtn = screen.getByTitle('Netflix')
      expect(netflixBtn.getAttribute('aria-pressed')).toBe('false')
      await fireEvent.click(netflixBtn)
      expect(netflixBtn.getAttribute('aria-pressed')).toBe('true')
    })

    it('updates streamingPrefs store when provider is toggled', async () => {
      render(Settings)
      await waitFor(() => screen.getByText('Netflix'))
      await fireEvent.click(screen.getByTitle('Netflix'))
      let prefs = {}
      streamingPrefs.subscribe(v => { prefs = v })()
      // Netflix provider_id is 8 (from MSW providers fixture)
      expect(prefs[8]).toBe(true)
    })

    it('deselects provider on second click', async () => {
      render(Settings)
      await waitFor(() => screen.getByText('Netflix'))
      const btn = screen.getByTitle('Netflix')
      await fireEvent.click(btn)
      await fireEvent.click(btn)
      expect(btn.getAttribute('aria-pressed')).toBe('false')
    })

    it('shows "Select All Services" button when providers are loaded', async () => {
      render(Settings)
      await waitFor(() => screen.getByText(/Select All Services/))
    })

    it('"Select All Services" selects every provider', async () => {
      render(Settings)
      await waitFor(() => screen.getByText(/Select All Services/))
      await fireEvent.click(screen.getByText(/Select All Services/))
      let prefs = {}
      streamingPrefs.subscribe(v => { prefs = v })()
      // All providers from the MSW fixture (provider_ids: 8, 9, 73, 337)
      for (const id of [8, 9, 73, 337]) {
        expect(prefs[id]).toBe(true)
      }
    })

    it('shows "Deselect All Services" after all are selected', async () => {
      render(Settings)
      await waitFor(() => screen.getByText(/Select All Services/))
      await fireEvent.click(screen.getByText(/Select All Services/))
      expect(screen.getByText(/Deselect All Services/)).toBeTruthy()
    })

    it('"Deselect All Services" deselects every provider', async () => {
      render(Settings)
      await waitFor(() => screen.getByText(/Select All Services/))
      await fireEvent.click(screen.getByText(/Select All Services/))
      await fireEvent.click(screen.getByText(/Deselect All Services/))
      let prefs = {}
      streamingPrefs.subscribe(v => { prefs = v })()
      for (const id of [8, 9, 73, 337]) {
        expect(prefs[id]).toBe(false)
      }
    })
  })

  describe('provider search', () => {
    it('filters providers by search term', async () => {
      render(Settings)
      await waitFor(() => screen.getByLabelText('Search streaming services'))
      const input = screen.getByLabelText('Search streaming services')
      await fireEvent.input(input, { target: { value: 'Netflix' } })
      expect(screen.getByText('Netflix')).toBeTruthy()
      expect(screen.queryByText('Tubi TV')).toBeFalsy()
    })

    it('shows "No services match" when search has no results', async () => {
      render(Settings)
      await waitFor(() => screen.getByLabelText('Search streaming services'))
      await fireEvent.input(
        screen.getByLabelText('Search streaming services'),
        { target: { value: 'xyznotaprovider' } }
      )
      expect(screen.getByText(/No services match/)).toBeTruthy()
    })

    it('shows Clear Search button when search has text', async () => {
      render(Settings)
      await waitFor(() => screen.getByLabelText('Search streaming services'))
      await fireEvent.input(
        screen.getByLabelText('Search streaming services'),
        { target: { value: 'Netflix' } }
      )
      expect(screen.getByText('Clear Search')).toBeTruthy()
    })

    it('clears search when Clear Search is clicked', async () => {
      render(Settings)
      await waitFor(() => screen.getByLabelText('Search streaming services'))
      const input = screen.getByLabelText('Search streaming services')
      await fireEvent.input(input, { target: { value: 'Netflix' } })
      await fireEvent.click(screen.getByText('Clear Search'))
      expect(screen.getByText('Tubi TV')).toBeTruthy()
    })
  })

  describe('delete flow', () => {
    it('shows "Delete All My Data" button initially', () => {
      render(Settings)
      expect(screen.getByText('Delete All My Data')).toBeTruthy()
    })

    it('shows confirmation box after clicking Delete All My Data', async () => {
      render(Settings)
      await fireEvent.click(screen.getByText('Delete All My Data'))
      expect(screen.getByText('Yes, Delete Everything')).toBeTruthy()
      expect(screen.getByText('Cancel')).toBeTruthy()
    })

    it('hides confirmation and returns to initial state on Cancel', async () => {
      render(Settings)
      await fireEvent.click(screen.getByText('Delete All My Data'))
      await fireEvent.click(screen.getByText('Cancel'))
      expect(screen.queryByText('Yes, Delete Everything')).toBeFalsy()
      expect(screen.getByText('Delete All My Data')).toBeTruthy()
    })
  })

  describe('install app section', () => {
    it('does not show install section when installPrompt is null', () => {
      render(Settings)
      const headings = screen.queryAllByRole('heading', { name: /Install App/i })
      expect(headings).toHaveLength(0)
    })

    it('shows install section when installPrompt is set', async () => {
      installPrompt.set({ prompt: vi.fn(), userChoice: new Promise(() => {}) })
      render(Settings)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Install App/i })).toBeTruthy()
      })
    })

    it('calls prompt() when Install App button is clicked', async () => {
      const mockPrompt = vi.fn()
      installPrompt.set({ prompt: mockPrompt, userChoice: new Promise(() => {}) })
      render(Settings)
      await waitFor(() => screen.getByText('Install App', { selector: 'button' }))
      await fireEvent.click(screen.getByText('Install App', { selector: 'button' }))
      expect(mockPrompt).toHaveBeenCalledOnce()
    })

    it('shows success message after accepted install', async () => {
      const mockPrompt = vi.fn()
      installPrompt.set({
        prompt: mockPrompt,
        userChoice: Promise.resolve({ outcome: 'accepted' })
      })
      render(Settings)
      await waitFor(() => screen.getByText('Install App', { selector: 'button' }))
      await fireEvent.click(screen.getByText('Install App', { selector: 'button' }))
      await waitFor(() => {
        expect(screen.getByText(/App installed/)).toBeTruthy()
      })
    })
  })
})
