// Fixtures for /api/suggestions

export const suggestionsValid = {
  results: [
    { tmdb_id: 550, title: 'Fight Club', year: '1999', poster_path: '/path.jpg', genre_ids: [18], vote_average: 8.4, vote_count: 26000, watch_providers: [] },
    { tmdb_id: 680, title: 'Pulp Fiction', year: '1994', poster_path: '/path2.jpg', genre_ids: [80, 18], vote_average: 8.9, vote_count: 24000, watch_providers: [] }
  ],
  total_results: 2,
  total_pages: 1,
  page: 1
}

export const suggestionsEmpty = { results: [], total_results: 0, total_pages: 0, page: 1 }
