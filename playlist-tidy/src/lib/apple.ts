import type { Playlist, Track, CatalogTrack, SearchResult, Mutation } from '../types';

declare global {
  interface Window {
    MusicKit: any;
  }
}

class AppleMusicAPI {
  private music: any = null;
  private storefront: string = '';

  async initialize(): Promise<void> {
    // Wait for MusicKit to load if not already available
    if (!window.MusicKit) {
      await this.waitForMusicKit();
    }

    // Check if we have a manual token, otherwise use automatic strategy
    const manualToken = import.meta.env.VITE_APPLE_MUSIC_TOKEN;
    
    const config: any = {
      app: {
        name: 'Playlist Tidy',
        build: '1.0.0'
      }
    };

    if (manualToken) {
      config.developerToken = manualToken;
    } else {
      config.developerTokenStrategy = 'automatic';
    }

    try {
      await window.MusicKit.configure(config);
    } catch (error) {
      console.error('MusicKit configuration failed:', error);
      throw new Error(
        'Apple Music setup failed. For local development, you may need to provide a manual developer token. ' +
        'See the README for setup instructions.'
      );
    }

    this.music = window.MusicKit.getInstance();
    
    // Get user's storefront
    try {
      const storefrontResponse = await this.music.api.v1.me.storefront();
      this.storefront = storefrontResponse.data[0].id;
    } catch (error) {
      console.warn('Could not get storefront, using default US:', error);
      this.storefront = 'us';
    }
  }

  async authorize(): Promise<boolean> {
    if (!this.music) {
      await this.initialize();
    }

    try {
      const userToken = await this.music.authorize();
      return !!userToken;
    } catch (error) {
      console.error('Authorization failed:', error);
      return false;
    }
  }

  get isAuthorized(): boolean {
    return this.music?.isAuthorized || false;
  }

  get musicInstance(): any {
    return this.music;
  }

  get userStorefront(): string {
    return this.storefront;
  }

  // Playlist management methods
  async listPlaylists(limit: number = 100, offset: number = 0): Promise<Playlist[]> {
    if (!this.isAuthorized) {
      throw new Error('User not authorized');
    }

    try {
      const response = await this.music.api.v1.me.library.playlists({
        limit,
        offset,
        include: 'tracks'
      });

      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
      throw new Error('Failed to fetch playlists');
    }
  }

  async getPlaylist(id: string): Promise<Playlist> {
    if (!this.isAuthorized) {
      throw new Error('User not authorized');
    }

    try {
      const response = await this.music.api.v1.me.library.playlists[id]({
        include: 'tracks'
      });

      return response.data[0];
    } catch (error) {
      console.error('Failed to fetch playlist:', error);
      throw new Error('Failed to fetch playlist');
    }
  }

  async createPlaylist(payload: {
    name: string;
    description?: string;
    tracks?: string[];
  }): Promise<Playlist> {
    if (!this.isAuthorized) {
      throw new Error('User not authorized');
    }

    try {
      const response = await this.music.api.v1.me.library.playlists.post({
        attributes: {
          name: payload.name,
          description: payload.description || ''
        },
        relationships: payload.tracks ? {
          tracks: {
            data: payload.tracks.map(id => ({ id, type: 'songs' }))
          }
        } : undefined
      });

      return response.data[0];
    } catch (error) {
      console.error('Failed to create playlist:', error);
      throw new Error('Failed to create playlist');
    }
  }

  async patchPlaylist(id: string, operations: Mutation[]): Promise<void> {
    if (!this.isAuthorized) {
      throw new Error('User not authorized');
    }

    try {
      // Process operations sequentially to maintain order
      for (const op of operations) {
        await this.executeMutation(id, op);
      }
    } catch (error) {
      console.error('Failed to patch playlist:', error);
      throw new Error('Failed to update playlist');
    }
  }

  private async executeMutation(playlistId: string, mutation: Mutation): Promise<void> {
    switch (mutation.op) {
      case 'add':
        if (mutation.tracks) {
          await this.addTracks(playlistId, mutation.tracks.map(t => t.id));
        }
        break;
      
      case 'remove':
        if (mutation.trackId) {
          await this.removeTrack(playlistId, mutation.trackId);
        }
        break;
      
      case 'move':
        if (mutation.trackId && mutation.fromIndex !== undefined && mutation.toIndex !== undefined) {
          await this.moveTrack(playlistId, mutation.trackId, mutation.fromIndex, mutation.toIndex);
        }
        break;
      
      case 'rename':
        if (mutation.name) {
          await this.renamePlaylist(playlistId, mutation.name);
        }
        break;
      
      default:
        console.warn('Unknown mutation operation:', mutation.op);
    }
  }

  async addTracks(playlistId: string, trackIds: string[]): Promise<void> {
    if (!this.isAuthorized) {
      throw new Error('User not authorized');
    }

    try {
      await this.music.api.v1.me.library.playlists[playlistId].tracks.post({
        data: trackIds.map(id => ({ id, type: 'songs' }))
      });
    } catch (error) {
      console.error('Failed to add tracks:', error);
      throw new Error('Failed to add tracks to playlist');
    }
  }

  async removeTrack(playlistId: string, trackId: string): Promise<void> {
    if (!this.isAuthorized) {
      throw new Error('User not authorized');
    }

    try {
      await this.music.api.v1.me.library.playlists[playlistId].tracks[trackId].delete();
    } catch (error) {
      console.error('Failed to remove track:', error);
      throw new Error('Failed to remove track from playlist');
    }
  }

  async moveTrack(playlistId: string, trackId: string, fromIndex: number, toIndex: number): Promise<void> {
    // Note: Apple Music API doesn't have direct move operation
    // This would require removing and re-adding at specific position
    // For now, we'll implement this as a client-side operation
    console.warn('Move operation not directly supported by Apple Music API');
  }

  async renamePlaylist(playlistId: string, name: string): Promise<void> {
    if (!this.isAuthorized) {
      throw new Error('User not authorized');
    }

    try {
      await this.music.api.v1.me.library.playlists[playlistId].patch({
        attributes: { name }
      });
    } catch (error) {
      console.error('Failed to rename playlist:', error);
      throw new Error('Failed to rename playlist');
    }
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    if (!this.isAuthorized) {
      throw new Error('User not authorized');
    }

    try {
      await this.music.api.v1.me.library.playlists[playlistId].delete();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      throw new Error('Failed to delete playlist');
    }
  }

  // Catalog search methods
  async searchCatalog(term: string, limit: number = 25): Promise<CatalogTrack[]> {
    if (!this.storefront) {
      throw new Error('Storefront not available');
    }

    try {
      const response = await this.music.api.v1.catalog[this.storefront].search({
        term,
        limit,
        types: 'songs'
      });

      return response.results?.songs?.data || [];
    } catch (error) {
      console.error('Failed to search catalog:', error);
      throw new Error('Failed to search Apple Music catalog');
    }
  }

  async getRecommendations(seedTracks: Track[], limit: number = 25): Promise<CatalogTrack[]> {
    // Note: Apple Music doesn't have a direct recommendations API
    // This would typically use the seed tracks to search for similar content
    // For now, we'll search based on the first track's artist
    if (seedTracks.length === 0) return [];

    const firstTrack = seedTracks[0];
    return this.searchCatalog(firstTrack.attributes.artistName, limit);
  }

  // Wait for MusicKit to load
  private async waitForMusicKit(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MusicKit failed to load within 10 seconds'));
      }, 10000);

      const checkMusicKit = () => {
        if (window.MusicKit) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkMusicKit, 100);
        }
      };

      checkMusicKit();
    });
  }

  // Utility methods
  formatArtworkUrl(url: string, size: number = 300): string {
    return url.replace('{w}', size.toString()).replace('{h}', size.toString());
  }

  formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

// Export singleton instance
export const appleMusicAPI = new AppleMusicAPI();
export default appleMusicAPI; 