import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import FilmCard from './FilmCard.svelte'
import { resetStores } from '../../test/resetStores.js'

const baseFilm = {
  tmdb_id: 238,
  title: 'The Godfather',
  year: '1972',
  poster_path: '/poster.jpg',
  genre_ids: [18, 80],
  vote_average: 9.2,
  watch_providers: []
}

beforeEach(() => {
  resetStores()
})

describe('FilmCard', () => {
  describe('rendering', () => {
    it('renders the film title', () => {
      render(FilmCard, { props: { film: baseFilm } })
      expect(screen.getByText('The Godfather')).toBeTruthy()
    })

    it('renders the film year', () => {
      render(FilmCard, { props: { film: baseFilm } })
      expect(screen.getByText('1972')).toBeTruthy()
    })

    it('renders the rating badge', () => {
      render(FilmCard, { props: { film: baseFilm } })
      expect(screen.getByText(/9\.2/)).toBeTruthy()
    })

    it('renders poster image with alt text', () => {
      render(FilmCard, { props: { film: baseFilm } })
      const img = screen.getByAltText('Poster for The Godfather')
      expect(img).toBeTruthy()
    })

    it('renders placeholder when no poster_path', () => {
      render(FilmCard, { props: { film: { ...baseFilm, poster_path: null } } })
      expect(screen.queryByAltText('Poster for The Godfather')).toBeFalsy()
    })

    it('does not render year when year is null', () => {
      const { container } = render(FilmCard, { props: { film: { ...baseFilm, year: null } } })
      expect(container.querySelector('.year')).toBeFalsy()
    })
  })

  describe('streaming badges', () => {
    it('shows "No streaming info" when watch_providers is empty', () => {
      render(FilmCard, { props: { film: baseFilm } })
      expect(screen.getByText('No streaming info')).toBeTruthy()
    })

    it('shows "Loading…" when loadingProviders is true', () => {
      render(FilmCard, { props: { film: baseFilm, loadingProviders: true } })
      expect(screen.getByText('Loading…')).toBeTruthy()
    })

    it('shows first provider badge when providers exist', () => {
      const film = {
        ...baseFilm,
        watch_providers: [
          { provider_id: 8, provider_name: 'Netflix', logo_path: null, streaming_type: 'flatrate', watch_link: null }
        ]
      }
      render(FilmCard, { props: { film } })
      expect(screen.getByText('Netflix')).toBeTruthy()
    })

    it('shows "+N more" button when there are multiple providers', () => {
      const film = {
        ...baseFilm,
        watch_providers: [
          { provider_id: 8,  provider_name: 'Netflix', logo_path: null, streaming_type: 'flatrate', watch_link: null },
          { provider_id: 9,  provider_name: 'Hulu',    logo_path: null, streaming_type: 'flatrate', watch_link: null },
          { provider_id: 73, provider_name: 'Tubi',    logo_path: null, streaming_type: 'free',     watch_link: 'http://x' }
        ]
      }
      render(FilmCard, { props: { film } })
      expect(screen.getByText(/\+2 more/)).toBeTruthy()
    })

    it('expands to show all providers on "+N more" click', async () => {
      const film = {
        ...baseFilm,
        watch_providers: [
          { provider_id: 8,  provider_name: 'Netflix', logo_path: null, streaming_type: 'flatrate', watch_link: null },
          { provider_id: 9,  provider_name: 'Hulu',    logo_path: null, streaming_type: 'flatrate', watch_link: null }
        ]
      }
      render(FilmCard, { props: { film } })
      await fireEvent.click(screen.getByText(/\+1 more/))
      expect(screen.getByText('Netflix')).toBeTruthy()
      expect(screen.getByText('Hulu')).toBeTruthy()
      expect(screen.getByText(/Show less/)).toBeTruthy()
    })

    it('collapses back on "Show less" click', async () => {
      const film = {
        ...baseFilm,
        watch_providers: [
          { provider_id: 8, provider_name: 'Netflix', logo_path: null, streaming_type: 'flatrate', watch_link: null },
          { provider_id: 9, provider_name: 'Hulu',    logo_path: null, streaming_type: 'flatrate', watch_link: null }
        ]
      }
      render(FilmCard, { props: { film } })
      await fireEvent.click(screen.getByText(/\+1 more/))
      await fireEvent.click(screen.getByText(/Show less/))
      expect(screen.getByText(/\+1 more/)).toBeTruthy()
    })
  })

  describe('action buttons', () => {
    it('renders "Add to Favorites" button in add variant (not in list)', () => {
      render(FilmCard, { props: { film: baseFilm, variant: 'add', isInList: false } })
      expect(screen.getByText('+ Add to Favorites')).toBeTruthy()
    })

    it('renders "Remove from List" button in add variant when isInList=true', () => {
      render(FilmCard, { props: { film: baseFilm, variant: 'add', isInList: true } })
      expect(screen.getByText(/Remove from List/)).toBeTruthy()
    })

    it('renders "Remove" button in remove variant', () => {
      render(FilmCard, { props: { film: baseFilm, variant: 'remove' } })
      expect(screen.getByText(/− Remove/)).toBeTruthy()
    })

    it('dispatches "add" event when add button is clicked', async () => {
      const { component } = render(FilmCard, { props: { film: baseFilm, variant: 'add' } })
      const events = []
      component.$on('add', e => events.push(e.detail))
      await fireEvent.click(screen.getByText('+ Add to Favorites'))
      expect(events).toHaveLength(1)
      expect(events[0].tmdb_id).toBe(238)
    })

    it('dispatches "remove" event when remove button is clicked', async () => {
      const { component } = render(FilmCard, { props: { film: baseFilm, variant: 'remove' } })
      const events = []
      component.$on('remove', e => events.push(e.detail))
      await fireEvent.click(screen.getByText(/− Remove/))
      expect(events).toHaveLength(1)
      expect(events[0].tmdb_id).toBe(238)
    })

    it('dispatches "remove" event from add variant when isInList=true', async () => {
      const { component } = render(FilmCard, { props: { film: baseFilm, variant: 'add', isInList: true } })
      const events = []
      component.$on('remove', e => events.push(e.detail))
      await fireEvent.click(screen.getByText(/Remove from List/))
      expect(events).toHaveLength(1)
    })
  })
})
