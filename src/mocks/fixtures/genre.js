// Fixtures for /api/genre-top50

export const genreResultsValid = {
  results: [
    { tmdb_id: 238, title: 'The Godfather', year: '1972', poster_path: '/path.jpg', genre_ids: [18, 80], vote_average: 9.2, vote_count: 18000, watch_providers: [] },
    { tmdb_id: 278, title: 'The Shawshank Redemption', year: '1994', poster_path: '/path2.jpg', genre_ids: [18], vote_average: 9.3, vote_count: 25000, watch_providers: [] }
  ],
  total_results: 2,
  total_pages: 1,
  page: 1
}

// Raw TMDB upstream response for genre-top50
export const tmdbGenreRaw = {
  results: [
    { id: 238, title: 'The Godfather', release_date: '1972-03-24', poster_path: '/path.jpg', genre_ids: [18, 80], vote_average: 9.2, vote_count: 18000 },
    { id: 278, title: 'The Shawshank Redemption', release_date: '1994-09-23', poster_path: '/path2.jpg', genre_ids: [18], vote_average: 9.3, vote_count: 25000 }
  ],
  total_results: 2,
  total_pages: 1,
  page: 1
}
