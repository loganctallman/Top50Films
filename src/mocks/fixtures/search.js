// Fixtures representing what /api/search returns

export const searchResultsValid = {
  results: [
    { tmdb_id: 238, title: 'The Godfather', year: '1972', poster_path: '/3bhkrj58Vtu7enYsLlegkKXKHKY.jpg', genre_ids: [18, 80], vote_average: 9.2, vote_count: 18000, watch_providers: [] },
    { tmdb_id: 278, title: 'The Shawshank Redemption', year: '1994', poster_path: '/lyQBXzOQSuE59IsHyhrp0qIiPAz.jpg', genre_ids: [18], vote_average: 9.3, vote_count: 25000, watch_providers: [] },
    { tmdb_id: 424, title: "Schindler's List", year: '1993', poster_path: '/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg', genre_ids: [18, 36], vote_average: 8.9, vote_count: 14000, watch_providers: [] }
  ],
  total_results: 3,
  total_pages: 1,
  page: 1
}

export const searchResultsEmpty = {
  results: [],
  total_results: 0,
  total_pages: 0,
  page: 1
}

// Raw TMDB upstream response
export const tmdbSearchRaw = {
  results: [
    { id: 238, title: 'The Godfather', release_date: '1972-03-24', poster_path: '/3bhkrj58Vtu7enYsLlegkKXKHKY.jpg', genre_ids: [18, 80], vote_average: 9.2, vote_count: 18000 },
    { id: 278, title: 'The Shawshank Redemption', release_date: '1994-09-23', poster_path: '/lyQBXzOQSuE59IsHyhrp0qIiPAz.jpg', genre_ids: [18], vote_average: 9.3, vote_count: 25000 }
  ],
  total_results: 2,
  total_pages: 1,
  page: 1
}

export const tmdbSearchRawEmpty = { results: [], total_results: 0, total_pages: 0, page: 1 }
