import type { Playlist, Track, CatalogTrack, SearchResult, Mutation } from '../types';
import { isJWTExpired, getTokenExpirationInfo } from './jwt-browser';

declare global {
  interface Window {
    MusicKit: any;
  }
}

class AppleMusicAPI {
  private music: any = null;
  private storefront: string = '';
  private isInitializing: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    // Prevent multiple concurrent initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Return early if already initialized
    if (this.music && window.MusicKit?.getInstance?.()) {
      console.log('🎵 MusicKit already initialized, skipping...');
      return;
    }

    if (this.isInitializing) {
      console.log('🎵 MusicKit initialization already in progress...');
      return;
    }

    console.log('🎵 Initializing Apple Music API...');
    this.isInitializing = true;
    
    this.initializationPromise = this._doInitialize();
    
    try {
      await this.initializationPromise;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  private async _doInitialize(): Promise<void> {
    // Wait for MusicKit to load if not already available
    if (!window.MusicKit) {
      console.log('⏳ Waiting for MusicKit to load...');
      await this.waitForMusicKit();
    }
    // Log the state of window.MusicKit early
    console.log('🔍 Early window.MusicKit object state:', window.MusicKit);
    if (window.MusicKit && typeof window.MusicKit.getInstance === 'function') {
        try {
            const earlyInstance = window.MusicKit.getInstance();
            console.log('🔍 Early MusicKit instance (if available):', earlyInstance);
            console.log('🔍 Early instance has requestAuthorization:', !!earlyInstance?.requestAuthorization);
            console.log('🔍 Early instance has authorize:', !!earlyInstance?.authorize);
        } catch (e) {
            console.log('🔍 Could not get early MusicKit instance, or it errored.');
        }
    } else {
        console.log('🔍 window.MusicKit.getInstance is not a function at this stage.');
    }

    // Check if MusicKit is already configured
    try {
      const existingInstance = window.MusicKit.getInstance();
      if (existingInstance) {
        console.log('🔄 Using existing MusicKit instance');
        this.music = existingInstance;
        this.storefront = 'us';
        return;
      }
    } catch (error) {
      // MusicKit not configured yet, continue with configuration
    }

    // Check for token strategies
    const manualToken = import.meta.env.VITE_APPLE_MUSIC_TOKEN;
    
    const config: any = {
      app: {
        name: 'Playlist Tidy',
        build: '1.0.0'
      },
      // Add library permissions for playlist access
      permissions: {
        library: true,
        playlists: true,
        playback: false  // We don't need playback for playlist management
      },
      bitrate: window.MusicKit?.PlaybackBitrate?.HIGH || 256,
      suppressErrorDialog: false  // Show errors for debugging
    };

    if (manualToken) {
      // Use pre-generated token
      config.developerToken = manualToken;
      console.log('🔧 Using pre-generated developer token');
      
      // Check if token is expired
      if (isJWTExpired(manualToken)) {
        console.warn('⚠️ Your JWT token appears to be expired. Please generate a new one.');
      } else {
        const tokenInfo = getTokenExpirationInfo(manualToken);
        if (tokenInfo.daysUntilExpiry !== null) {
          console.log(`🕒 Token expires in ${tokenInfo.daysUntilExpiry} days`);
        }
      }
    } else {
      // Fall back to automatic strategy
      config.developerTokenStrategy = 'automatic';
      console.log('🔧 Using automatic token strategy');
      console.log('💡 For local development, consider generating a JWT token using: pnpm generate-jwt');
    }

    try {
      console.log('⚙️ Configuring MusicKit with:', { ...config, developerToken: manualToken ? '[REDACTED]' : undefined });
      await window.MusicKit.configure(config);
      console.log('✅ MusicKit configured successfully');
    } catch (error) {
      console.error('❌ MusicKit configuration failed:', error);
      throw new Error(
        'Apple Music setup failed. For local development, you may need to provide a manual developer token. ' +
        'See the README for setup instructions.'
      );
    }

    this.music = window.MusicKit.getInstance();
    
    // Set default storefront (we'll get the user's actual storefront after authorization)
    this.storefront = 'us';
    console.log('🌍 Using default storefront: US (will update after user authorization)');
  }

  async authorize(): Promise<boolean> {
    console.log('🔐 Starting Apple Music authorization...');
    
    if (!this.music) {
      console.log('🔄 Music instance not found, re-initializing...');
      // Make sure initialization is complete before proceeding
      // Initialize should set up this.music if successful
      await this.initialize(); 
      if (!this.music) {
        console.error('❌ Music instance still not available after re-initialization attempt. Cannot authorize.');
        return false;
      }
    }

    try {
      // Stricter check: ensure library API is also available if we think we are authorized
      const isFullyReady = 
        this.music.isAuthorized && 
        this.music.api?.music && 
        this.music.api?.library && // Ensure library is part of this check
        this.music.authorizationStatus === 3;

      if (isFullyReady) {
        console.log('✅ Already authorized with working music AND library API. No need to re-authorize.');
        return true;
      }
      
      console.log('ℹ️ Current state before attempting authorization flow:', {
        isAuthorized: this.music.isAuthorized,
        hasMusicAPI: !!this.music.api?.music,
        hasLibraryAPI: !!this.music.api?.library,
        authorizationStatus: this.music.authorizationStatus,
        isFullyReady: isFullyReady // Log the result of our stricter check
      });

      // If we have stale authorization (e.g., authorized but library is missing, or status isn't 3)
      // or if not authorized at all, we need to proceed with authorization.
      if (this.music.isAuthorized && !isFullyReady) {
        console.log('🔄 Stale or incomplete authorization detected (e.g., library missing). Unauthorizing first, then will re-authorize...');
        // Attempt to unauthorize to ensure a fresh session attempt.
        try {
          await this.music.unauthorize();
          console.log('✅ Successfully called unauthorize(). Waiting briefly...');
          await new Promise(resolve => setTimeout(resolve, 500)); // Give unauth a moment to settle
        } catch (unauthError) {
          console.error('❌ Error during unauthorize():', unauthError);
          // Decide if you want to proceed with authorize anyway or return false.
          // For now, let's log and proceed, as authorize might still fix it.
        }
      }

      console.log('📱 Requesting user authorization via MusicKit instance...');
      
      // Debug what's actually available on the music instance
      console.log('🔍 MusicKit instance debug:', {
        musicExists: !!this.music,
        musicType: typeof this.music,
        musicMethods: this.music ? Object.getOwnPropertyNames(this.music).filter(prop => typeof this.music[prop] === 'function') : 'no music',
        hasAuthorize: !!this.music?.authorize,
        hasRequestAuthorization: !!this.music?.requestAuthorization,
        authorizationStatus: this.music?.authorizationStatus
      });
      
      // Try the correct authorization method
      let authResult;
      try {
        if (this.music.requestAuthorization) {
          console.log('Using requestAuthorization()...');
          authResult = await this.music.requestAuthorization();
        } else if (this.music.authorize) {
          console.log('Using authorize()...');
          authResult = await this.music.authorize();
        } else {
          throw new Error('No authorization method found on MusicKit instance');
        }
        
        console.log('🎉 Authorization result (raw):', authResult);
        console.log('🎉 Authorization status immediately after call:', this.music.authorizationStatus);
        console.log('🎉 IsAuthorized flag immediately after call:', this.music.isAuthorized);
      } catch (authError) {
        console.error('Authorization request failed:', authError);
        throw authError;
      }
      
              if (authResult) {
          console.log('🔍 Post-authorization state:', {
            isAuthorized: this.music.isAuthorized,
            authStatus: this.music.authorizationStatus,
            hasAPI: !!this.music.api,
            apiKeys: this.music.api ? Object.keys(this.music.api) : 'no api',
            hasLibrary: !!this.music.api?.library
          });
          
          // Wait for music API to be fully initialized
          console.log('⏳ Waiting for music API initialization...');
          const musicAPIReady = await this.waitForMusicAPI();
          
          if (!musicAPIReady) {
            console.error('❌ Music API not available after authorization. waitForMusicAPI returned false.');
            console.log('🔍 Final API state during waitForMusicAPI failure:', {
              hasAPI: !!this.music.api,
              apiStructure: this.music.api ? Object.keys(this.music.api) : 'no api',
              hasMusicAPI: !!this.music.api?.music,
              hasV1: !!this.music.api?.v1,
              authStatus: this.music.authorizationStatus
            });
            return false;
          }
        
        // Get user's actual storefront after successful authorization
        try {
          // Try different methods to get storefront
          let storefrontResponse;
          if (this.music.api.library?.storefront) {
            storefrontResponse = await this.music.api.library.storefront();
          } else if (this.music.api.music?.session) {
            storefrontResponse = await this.music.api.music.session.request({
              url: '/v1/me/storefront',
              method: 'GET'
            });
          } else {
            throw new Error('No storefront access method available');
          }
          
          this.storefront = storefrontResponse.data[0].id;
          console.log('🌍 Updated storefront to:', this.storefront);
        } catch (error) {
          console.warn('Could not get user storefront, keeping default US:', error);
        }
        
        console.log('✅ Authorization and API initialization complete');
        return true;
      }
      
      console.log('❌ Authorization flow concluded with authResult being falsy or API not becoming ready.');
      return false;
    } catch (error) {
      console.error('❌ Authorization failed:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      return false;
    }
  }

  get isAuthorized(): boolean {
    const musicInstanceExists = !!this.music;
    const musicAuthorized = this.music?.isAuthorized || false;
    const hasMusicAPI = !!this.music?.api?.music;
    const hasLibraryAPI = !!this.music?.api?.library;
    const authStatus = this.music?.authorizationStatus;
    const fullyAuthorized = musicInstanceExists && musicAuthorized && hasMusicAPI && hasLibraryAPI && authStatus === 3;
    
    console.log('🔐 Getter: appleMusicAPI.isAuthorized check:', { 
      musicInstanceExists,
      musicAuthorized,
      hasMusicAPI,
      hasLibraryAPI,
      authStatus,
      returned: fullyAuthorized
    });
    return fullyAuthorized;
  }

  get musicInstance(): any {
    return this.music;
  }

  get userStorefront(): string {
    return this.storefront;
  }

  // Playlist management methods
  async listPlaylists(limit: number = 100, offset: number = 0): Promise<Playlist[]> {
    console.log('📋 === COMPREHENSIVE PLAYLIST FETCH DEBUGGING ===');
    
    // 1. AUTHORIZATION STATUS
    console.log('🔐 Authorization Status:', {
      isAuthorized: this.isAuthorized,
      musicExists: !!this.music,
      authorizationStatus: this.music?.authorizationStatus,
      isConfigured: !!window.MusicKit?.getInstance?.()
    });
    
    if (!this.isAuthorized) {
      console.log('❌ User not authorized - throwing error');
      throw new Error('User not authorized');
    }

    // 2. ENVIRONMENT DETAILS
    console.log('🌍 Environment Details:', {
      userAgent: navigator.userAgent.substring(0, 100) + '...',
      currentURL: window.location.href,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      port: window.location.port,
      framework: 'React',
      musicKitVersion: 'v3'
    });

    // 3. MUSICKIT INSTANCE DETAILS
    console.log('🎵 MusicKit Instance Details:', {
      musicKitExists: !!window.MusicKit,
      instanceExists: !!this.music,
      instanceType: typeof this.music,
      hasAPI: !!this.music?.api,
      apiStructure: this.music?.api ? Object.keys(this.music.api) : 'no api',
      hasLibrary: !!this.music?.api?.library,
      libraryMethods: this.music?.api?.library ? Object.keys(this.music.api.library) : 'no library'
    });

    // 4. SUBSCRIPTION STATUS CHECK
    console.log('💳 Subscription Status Check:');
    try {
      const subscriptionStatus = this.music?.subscriptionStatus;
      console.log('Subscription Status:', subscriptionStatus);
    } catch (subError) {
      console.log('Could not check subscription status:', subError);
    }

    try {
      console.log('🚀 === ATTEMPTING PLAYLIST FETCH ===');
      console.log('📞 API Call Details:', {
        method: 'this.music.api.library.playlists()',
        parameters: { limit, offset },
        timestamp: new Date().toISOString(),
        calledFrom: 'listPlaylists method'
      });
      
      let response;
      const startTime = performance.now();
      
      try {
        console.log('🎯 Executing: this.music.api.library.playlists()');
        response = await this.music.api.library.playlists();
        const endTime = performance.now();
        
        console.log('✅ === API CALL SUCCESSFUL ===', {
          duration: `${(endTime - startTime).toFixed(2)}ms`,
          responseType: typeof response,
          hasData: !!response?.data,
          dataLength: response?.data?.length || 0,
          responseKeys: response ? Object.keys(response) : 'no response'
        });
        
        console.log('📋 Raw API Response:', response);
        
      } catch (error) {
        const endTime = performance.now();
        console.log('❌ === API CALL FAILED ===', {
          duration: `${(endTime - startTime).toFixed(2)}ms`,
          errorType: typeof error,
          errorName: error instanceof Error ? error.name : 'unknown',
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        
        // Try with parameters as fallback
        console.log('🔄 Trying fallback with parameters...');
        try {
          response = await this.music.api.library.playlists({ limit, offset });
          console.log('✅ Fallback succeeded:', response);
        } catch (paramError) {
          console.log('❌ Fallback also failed:', paramError);
          throw new Error(`All playlist fetch attempts failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // 5. RESPONSE PROCESSING
      console.log('📊 === PROCESSING RESPONSE ===');
      if (!response) {
        throw new Error('No response received from API');
      }

      if (!response.data) {
        console.log('⚠️ Response missing data property:', response);
        throw new Error('Response missing data property');
      }

      console.log('📈 Response Data Analysis:', {
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        length: response.data.length,
        firstItemStructure: response.data[0] ? {
          id: response.data[0].id,
          type: response.data[0].type,
          hasAttributes: !!response.data[0].attributes,
          attributeKeys: response.data[0].attributes ? Object.keys(response.data[0].attributes) : 'no attributes'
        } : 'no items'
      });

      const playlists = response.data.map((playlist: any, index: number) => {
        if (index < 3) { // Log first 3 playlists for debugging
          console.log(`Processing playlist ${index + 1}:`, {
            id: playlist.id,
            name: playlist.attributes?.name,
            trackCount: playlist.attributes?.trackCount,
            canEdit: playlist.attributes?.canEdit
          });
        }
        
        return {
          id: playlist.id,
          name: playlist.attributes.name,
          description: playlist.attributes.description?.standard || '',
          trackCount: playlist.attributes.trackCount || 0,
          artwork: playlist.attributes.artwork,
          canEdit: playlist.attributes.canEdit || false,
          tracks: []
        };
      });

      console.log(`✅ === SUCCESS: Processed ${playlists.length} playlists ===`);
      return playlists;

    } catch (error) {
      console.log('💥 === FINAL ERROR ===', {
        errorType: typeof error,
        errorName: error instanceof Error ? error.name : 'unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack?.substring(0, 500) : 'no stack'
      });
      
      throw new Error(`Failed to fetch playlists: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getPlaylist(id: string): Promise<Playlist> {
    if (!this.isAuthorized) {
      throw new Error('User not authorized');
    }

    try {
      const response = await this.music.api.library.playlist(id, { include: 'tracks' });
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

  // Wait for music API to be available after authorization
  private async waitForMusicAPI(): Promise<boolean> {
    const maxRetries = 20; // ~10 seconds
    const retryDelay = 500; // ms

    for (let i = 0; i < maxRetries; i++) {
      const checkMusicAPI = () => {
        console.log(`[waitForMusicAPI Attempt ${i + 1}/${maxRetries}] Checking API state...`);
        const apiState = {
          musicInstanceExists: !!this.music,
          apiObjectExists: !!this.music?.api,
          apiMusicExists: !!this.music?.api?.music,
          apiLibraryExists: !!this.music?.api?.library, // Also check for library as it's crucial
          authorizationStatus: this.music?.authorizationStatus,
          isAuthorizedFlag: this.music?.isAuthorized
        };
        console.log(`[waitForMusicAPI Attempt ${i + 1}/${maxRetries}] Current API state:`, apiState);
        return this.music && this.music.api && this.music.api.music && this.music.api.library && this.music.authorizationStatus === 3;
      };

      if (checkMusicAPI()) {
        console.log('[waitForMusicAPI] Music API is ready.');
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    console.error('[waitForMusicAPI] Music API did not become ready after multiple retries.');
    return false;
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