// Fixtures representing what /api/movie/:id returns (our shaped response)

export const movieWithProviders = {
  tmdb_id: 238,
  title: 'The Godfather',
  year: '1972',
  poster_path: '/3bhkrj58Vtu7enYsLlegkKXKHKY.jpg',
  genre_ids: [18, 80],
  vote_average: 9.2,
  overview: 'The aging patriarch of an organized crime dynasty...',
  watch_providers: [
    {
      provider_id: 8,
      provider_name: 'Netflix',
      logo_path: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg',
      streaming_type: 'flatrate',
      watch_link: null
    },
    {
      provider_id: 73,
      provider_name: 'Tubi TV',
      logo_path: '/pZgeSWpfvD59x6b2mHQnGwAQbEr.jpg',
      streaming_type: 'free',
      watch_link: 'https://www.themoviedb.org/movie/238/watch?locale=US'
    }
  ]
}

export const movieNoProviders = {
  ...movieWithProviders,
  watch_providers: []
}

// Raw TMDB upstream response (used in API handler tests)
export const tmdbMovieRaw = {
  id: 238,
  title: 'The Godfather',
  release_date: '1972-03-24',
  poster_path: '/3bhkrj58Vtu7enYsLlegkKXKHKY.jpg',
  genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }],
  vote_average: 9.2,
  overview: 'The aging patriarch of an organized crime dynasty...',
  'watch/providers': {
    results: {
      US: {
        link: 'https://www.themoviedb.org/movie/238/watch?locale=US',
        flatrate: [
          { provider_id: 8, provider_name: 'Netflix', logo_path: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg', display_priority: 1 }
        ],
        free: [
          { provider_id: 73, provider_name: 'Tubi TV', logo_path: '/pZgeSWpfvD59x6b2mHQnGwAQbEr.jpg', display_priority: 2 }
        ]
      }
    }
  }
}

export const tmdbMovieRawNoProviders = {
  ...tmdbMovieRaw,
  'watch/providers': { results: {} }
}
