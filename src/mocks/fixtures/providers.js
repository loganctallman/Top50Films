// Fixtures for /api/providers

export const providersValid = {
  results: [
    { provider_id: 8,  provider_name: 'Netflix',        logo_path: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg' },
    { provider_id: 9,  provider_name: 'Amazon Prime',   logo_path: '/emthp39XA2yngMLFSQ3Yf6GDFzk.jpg' },
    { provider_id: 73, provider_name: 'Tubi TV',        logo_path: '/pZgeSWpfvD59x6b2mHQnGwAQbEr.jpg' },
    { provider_id: 337, provider_name: 'Disney Plus',   logo_path: '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg' }
  ]
}

// Raw TMDB upstream response for providers
export const tmdbProvidersRaw = {
  results: [
    { provider_id: 8,  provider_name: 'Netflix',        logo_path: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg', display_priority: 1 },
    { provider_id: 9,  provider_name: 'Amazon Prime',   logo_path: '/emthp39XA2yngMLFSQ3Yf6GDFzk.jpg', display_priority: 2 },
    { provider_id: 73, provider_name: 'Tubi TV',        logo_path: '/pZgeSWpfvD59x6b2mHQnGwAQbEr.jpg', display_priority: 3 },
    { provider_id: 337, provider_name: 'Disney Plus',   logo_path: '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg', display_priority: 4 }
  ]
}
