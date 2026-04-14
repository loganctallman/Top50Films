// Fixtures for /api/person/search and /api/person/:id

export const personSearchValid = {
  results: [
    { id: 1032, name: 'Francis Ford Coppola', known_for_department: 'Directing' },
    { id: 2710,  name: 'Steven Spielberg',     known_for_department: 'Directing' },
    { id: 31,    name: 'Tom Hanks',            known_for_department: 'Acting' }
  ]
}

export const personSearchEmpty = { results: [] }

export const personFilmographyValid = {
  results: [
    { tmdb_id: 238,  title: 'The Godfather',           year: '1972', poster_path: '/path.jpg',  genre_ids: [18, 80], vote_average: 9.2, vote_count: 18000, watch_providers: [] },
    { tmdb_id: 242,  title: 'The Godfather Part II',   year: '1974', poster_path: '/path2.jpg', genre_ids: [18, 80], vote_average: 9.0, vote_count: 11000, watch_providers: [] },
    { tmdb_id: 1450, title: 'Apocalypse Now',          year: '1979', poster_path: '/path3.jpg', genre_ids: [18, 10752], vote_average: 8.5, vote_count: 10000, watch_providers: [] }
  ],
  total_results: 3
}

// Raw TMDB person movie_credits response
export const tmdbPersonCreditsRaw = {
  cast: [
    { id: 550,  title: 'Fight Club',          release_date: '1999-10-15', poster_path: '/path.jpg',  genre_ids: [18],     vote_average: 8.4, vote_count: 26000 }
  ],
  crew: [
    { id: 238,  title: 'The Godfather',       release_date: '1972-03-24', poster_path: '/path2.jpg', genre_ids: [18, 80], vote_average: 9.2, vote_count: 18000, job: 'Director', department: 'Directing' },
    { id: 550,  title: 'Fight Club',          release_date: '1999-10-15', poster_path: '/path.jpg',  genre_ids: [18],     vote_average: 8.4, vote_count: 26000, job: 'Producer', department: 'Production' }
  ]
}

// Raw TMDB person search response
export const tmdbPersonSearchRaw = {
  results: [
    { id: 1032, name: 'Francis Ford Coppola', known_for_department: 'Directing', known_for: [] },
    { id: 31,   name: 'Tom Hanks',            known_for_department: 'Acting',    known_for: [] }
  ],
  total_results: 2,
  total_pages: 1,
  page: 1
}
