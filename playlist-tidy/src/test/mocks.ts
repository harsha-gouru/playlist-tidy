import { http, HttpResponse } from 'msw';
import type { Playlist, Track } from '../types';

// Mock track data
export const mockTracks: Track[] = [
  {
    id: 'track-1',
    type: 'songs',
    attributes: {
      name: 'Bohemian Rhapsody',
      artistName: 'Queen',
      albumName: 'A Night at the Opera',
      durationInMillis: 355000,
      artwork: {
        url: 'https://example.com/artwork/{w}x{h}.jpg',
        width: 300,
        height: 300
      }
    }
  },
  {
    id: 'track-2',
    type: 'songs',
    attributes: {
      name: 'Stairway to Heaven',
      artistName: 'Led Zeppelin',
      albumName: 'Led Zeppelin IV',
      durationInMillis: 482000
    }
  },
  {
    id: 'track-3',
    type: 'songs',
    attributes: {
      name: 'Hotel California',
      artistName: 'Eagles',
      albumName: 'Hotel California',
      durationInMillis: 391000
    }
  }
];

// Mock playlist data
export const mockPlaylists: Playlist[] = [
  {
    id: 'playlist-1',
    type: 'playlists',
    attributes: {
      name: 'Classic Rock Hits',
      description: 'The best classic rock songs',
      canEdit: true,
      isPublic: false,
      dateAdded: '2024-01-01T00:00:00Z',
      lastModifiedDate: '2024-01-15T00:00:00Z'
    },
    relationships: {
      tracks: {
        data: mockTracks
      }
    }
  },
  {
    id: 'playlist-2',
    type: 'playlists',
    attributes: {
      name: 'Chill Vibes',
      description: 'Relaxing music for any time',
      canEdit: true,
      isPublic: true,
      dateAdded: '2024-01-10T00:00:00Z',
      lastModifiedDate: '2024-01-20T00:00:00Z'
    },
    relationships: {
      tracks: {
        data: [mockTracks[1]]
      }
    }
  }
];

// MSW handlers for Apple Music API
export const handlers = [
  // Get user's playlists
  http.get('*/v1/me/library/playlists', () => {
    return HttpResponse.json({
      data: mockPlaylists
    });
  }),

  // Get specific playlist
  http.get('*/v1/me/library/playlists/:id', ({ params }) => {
    const playlist = mockPlaylists.find(p => p.id === params.id);
    if (!playlist) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      data: [playlist]
    });
  }),

  // Search catalog
  http.get('*/v1/catalog/*/search', ({ request }) => {
    const url = new URL(request.url);
    const term = url.searchParams.get('term');
    
    // Return mock search results based on term
    const results = mockTracks.filter(track =>
      track.attributes.name.toLowerCase().includes(term?.toLowerCase() || '') ||
      track.attributes.artistName.toLowerCase().includes(term?.toLowerCase() || '')
    );

    return HttpResponse.json({
      results: {
        songs: {
          data: results
        }
      }
    });
  }),

  // Get storefront
  http.get('*/v1/me/storefront', () => {
    return HttpResponse.json({
      data: [{ id: 'us' }]
    });
  })
]; 