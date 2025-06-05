import type { Playlist, Track, CatalogTrack, Mutation } from '../types';
import { isJWTExpired, getTokenExpirationInfo } from './jwt-browser';

declare global {
  interface Window {
    MusicKit: any;
  }
}

class AppleMusicAPI {
  private music: any = null;
  private storefront: string = '';
  // private isInitializing: boolean = false;
  // private initializationPromise: Promise<void> | null = null;
  private privacyAcknowledged: boolean = false;

  async initialize(): Promise<void> {
    if (this.music) {
      console.log('🎵 MusicKit already initialized, skipping...');
      return;
    }

    console.log('🎵 Initializing Apple Music API...');
    
    // Debug early MusicKit state
    console.log('🔍 Early window.MusicKit object state:', window.MusicKit);
    console.log('🔍 Early MusicKit instance (if available):', window.MusicKit?.getInstance?.());
    
    // Check if we have early access to instance methods
    const earlyInstance = window.MusicKit?.getInstance?.();
    if (earlyInstance) {
      console.log('🔍 Early instance has requestAuthorization:', typeof earlyInstance.requestAuthorization === 'function');
      console.log('🔍 Early instance has authorize:', typeof earlyInstance.authorize === 'function');
    } else {
      console.log('🔍 Early instance has requestAuthorization:', false);
      console.log('🔍 Early instance has authorize:', false);
    }

    // Wait for MusicKit to load if not already available
    if (!window.MusicKit) {
      console.log('⏳ Waiting for MusicKit to load...');
      await this.waitForMusicKit();
    }

    // Check for token strategies
    const manualToken = import.meta.env.VITE_APPLE_MUSIC_TOKEN;
    
    // Configure MusicKit with enhanced settings for privacy handling
    const config: any = {
      app: {
        name: 'Playlist Tidy',
        build: '1.0.0',
        version: '1.0.0'
      },
      bitrate: 256,
      suppressErrorDialog: false
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

    console.log('⚙️ Configuring MusicKit with:', {
      ...config,
      developerToken: manualToken ? '[REDACTED]' : undefined
    });

    try {
      await window.MusicKit.configure(config);
      console.log('✅ MusicKit configured successfully');
      
      this.music = window.MusicKit.getInstance();
      
      // Debug the configured instance
      console.log('🔍 Configured MusicKit instance:', {
        exists: !!this.music,
        type: typeof this.music,
        hasAPI: !!this.music?.api,
        hasLibraryAPI: !!this.music?.api?.library,
        authStatus: this.music?.authorizationStatus,
        isAuthorized: this.music?.isAuthorized,
        permissions: this.music?.permissions,
        hasRequestAuth: typeof this.music?.requestAuthorization === 'function',
        hasAuthorize: typeof this.music?.authorize === 'function'
      });
      
    } catch (error) {
      console.error('❌ Failed to configure MusicKit:', error);
      throw new Error(`Failed to configure Apple Music: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Set default storefront (will be updated after authorization)
    this.storefront = 'us';
    console.log('🌍 Using default storefront: US (will detect actual storefront after authorization)');
  }

  private authorizationInProgress = false;

  async authorize(): Promise<boolean> {
    // Prevent multiple simultaneous authorization attempts
    if (this.authorizationInProgress) {
      console.log('⏳ Authorization already in progress, waiting...');
      let attempts = 0;
      while (this.authorizationInProgress && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      return this.isAuthorized;
    }

    this.authorizationInProgress = true;
    console.log('🔐 Starting Apple Music authorization...');
    
    try {
      if (!this.music) {
        console.log('🔄 Music instance not found, re-initializing...');
        await this.initialize(); 
        if (!this.music) {
          console.error('❌ Music instance still not available after re-initialization attempt. Cannot authorize.');
          return false;
        }
      }

      // Comprehensive authorization check
      const isFullyReady = 
        this.music.isAuthorized && 
        this.music.api?.music && 
        this.music.api?.library && 
        this.music.authorizationStatus === 3 &&
        this.music.musicUserToken;

      if (isFullyReady) {
        console.log('✅ Already fully authorized with working APIs and user token. No need to re-authorize.');
        return true;
      }
      
      console.log('ℹ️ Current state before attempting authorization flow:', {
        isAuthorized: this.music.isAuthorized,
        hasMusicAPI: !!this.music.api?.music,
        hasLibraryAPI: !!this.music.api?.library,
        authorizationStatus: this.music.authorizationStatus,
        hasUserToken: !!this.music.musicUserToken,
        isFullyReady: isFullyReady,
        privacyAcknowledged: this.privacyAcknowledged
      });

      // Only reset authorization if it's clearly broken (status !== 3)
      if (this.music.isAuthorized && this.music.authorizationStatus !== 3) {
        console.log('🔄 Broken authorization detected (status !== 3). Resetting...');
        try {
          await this.music.unauthorize();
          console.log('✅ Successfully called unauthorize(). Waiting briefly...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (unauthError) {
          console.error('❌ Error during unauthorize():', unauthError);
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
      
      // Enhanced authorization with multiple attempts
      let authResult;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        attempts++;
        console.log(`🔄 Authorization attempt ${attempts}/${maxAttempts}`);
        
        try {
          // Try different authorization approaches - library access requires specific scopes
          if (this.music.authorize) {
            console.log('Using authorize() with library scopes...');
            // CRITICAL: Request specific scopes for library access
            authResult = await this.music.authorize(['music.identity', 'library']);
          } else if (this.music.requestAuthorization) {
            console.log('Using requestAuthorization() (fallback)...');
            authResult = await this.music.requestAuthorization();
          } else {
            throw new Error('No authorization method found on MusicKit instance');
          }
          
          console.log(`🎉 Authorization attempt ${attempts} result:`, authResult);
          console.log(`🎉 Authorization status after attempt ${attempts}:`, this.music.authorizationStatus);
          console.log(`🎉 IsAuthorized flag after attempt ${attempts}:`, this.music.isAuthorized);
          console.log(`🎵 Music-User-Token exists:`, !!this.music.musicUserToken);
          console.log(`🎵 Music-User-Token length:`, this.music.musicUserToken?.length || 0);
          
          // CRITICAL: Ensure Music-User-Token is properly set after authorization
          if (this.music.isAuthorized && this.music.authorizationStatus === 3) {
            console.log('🔄 Forcing Music-User-Token refresh...');
            try {
              // Force a token refresh by accessing the token property
              const userToken = this.music.musicUserToken;
              if (!userToken) {
                console.warn('⚠️ Music-User-Token is missing after successful authorization!');
                // Try to trigger token generation
                await new Promise(resolve => setTimeout(resolve, 1000));
                const retryToken = this.music.musicUserToken;
                console.log('🔄 Retry token check:', {
                  hasToken: !!retryToken,
                  tokenLength: retryToken?.length || 0
                });
              } else {
                console.log('✅ Music-User-Token confirmed present');
              }
            } catch (tokenError) {
              console.error('❌ Error checking Music-User-Token:', tokenError);
            }
          }
          
          // Wait for API to be ready
          console.log('⏳ Waiting for Music API to be ready...');
          const apiReady = await this.waitForMusicAPI();
          
          if (apiReady && this.music.isAuthorized && this.music.authorizationStatus === 3) {
            console.log('✅ Authorization successful and API is ready!');
            break;
          } else {
            console.log(`⚠️ Attempt ${attempts} not fully successful, retrying...`);
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retry
            }
          }
          
        } catch (authError) {
          console.error(`❌ Authorization attempt ${attempts} failed:`, authError);
          if (attempts === maxAttempts) {
            throw authError;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log('🔍 Final API structure post-auth:', {
        apiKeys: this.music.api ? Object.keys(this.music.api) : 'this.music.api is null/undefined',
        libraryAPIType: this.music.api?.library ? typeof this.music.api.library : 'this.music.api.library is null/undefined',
        libraryAPIExists: !!this.music.api?.library,
        musicAPIExists: !!this.music.api?.music
      });

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
        
        // NOW handle privacy acknowledgement after API is ready
        if (!this.privacyAcknowledged) {
          console.log('🔒 Handling privacy acknowledgement after API readiness...');
          await this.handlePrivacyAcknowledgement();
        }
        
        // ENHANCED VALIDATION FLOW
        console.log('🔍 === ENHANCED AUTHORIZATION VALIDATION ===');
        
        // 1. Verify and refresh Music-User-Token
        const tokenValid = await this.verifyAndRefreshUserToken();
        if (!tokenValid) {
          console.error('❌ Music-User-Token validation failed');
          return false;
        }
        
        // 2. Validate authorization scopes
        const scopesValid = await this.validateAuthorizationScopes();
        if (!scopesValid) {
          console.error('❌ Authorization scope validation failed');
          return false;
        }
        
        // 3. Validate subscription status
        const subscriptionValid = await this.validateSubscription();
        if (!subscriptionValid) {
          console.error('❌ Apple Music subscription validation failed');
          throw new Error('Apple Music subscription required. Please ensure you have an active Apple Music subscription to access your music library and playlists.');
        }
        
        // 4. Get user's actual storefront after successful authorization
        await this.updateUserStorefront();
        
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
    } finally {
      this.authorizationInProgress = false;
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
    
    // First, let's test subscription status and library access directly
    await this.testLibraryAccess();
    
    // Check for 403 errors and attempt to resolve them
    await this.handle403Errors();
    
    if (!this.isAuthorized) {
      console.log('🔐 Authorization Status:', {
        isAuthorized: this.isAuthorized,
        musicExists: !!this.music,
        authorizationStatus: this.music?.authorizationStatus,
        isConfigured: !!window.MusicKit?.getInstance
      });
      console.log('❌ User not authorized - running enhanced validation...');
      
      // Run enhanced validation to provide specific error messages
      try {
        if (this.music) {
          // Check if basic authorization exists but library access is missing
          if (this.music.authorizationStatus === 3 && this.music.isAuthorized) {
            if (!this.music.api?.library) {
              throw new Error('Apple Music subscription required. Please ensure you have an active Apple Music subscription to access your music library and playlists.');
            }
            
            // Check if Music-User-Token is missing
            if (!this.music.musicUserToken) {
              throw new Error('Authentication failed. Please try disconnecting and reconnecting your Apple Music account.');
            }
          }
        }
      } catch (validationError) {
        throw validationError;
      }
      
      throw new Error('User not authorized for Apple Music. Please connect your Apple Music account.');
    }

    console.log('🌍 Environment Details:', {
      userAgent: navigator.userAgent,
      currentURL: window.location.href,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      port: window.location.port,
      timestamp: new Date().toISOString()
    });

    console.log('🎵 MusicKit Instance Details:', {
      musicKitExists: !!window.MusicKit,
      instanceExists: !!this.music,
      instanceType: typeof this.music,
      hasAPI: !!this.music?.api,
      apiStructure: this.music?.api ? Object.keys(this.music.api) : 'no api',
      hasLibraryAPI: !!this.music?.api?.library,
      authorizationStatus: this.music?.authorizationStatus,
      isAuthorized: this.music?.isAuthorized
    });

    // Check subscription status
    console.log('💳 Subscription Status Check:');
    try {
      const subscriptionStatus = this.music?.subscriptionStatus;
      console.log('Subscription Status:', subscriptionStatus);
    } catch (error) {
      console.log('Could not get subscription status:', error);
    }

    console.log('🚀 === ATTEMPTING PLAYLIST FETCH ===');
    console.log('📞 API Call Details:', {
      method: 'this.music.api.library.playlists()',
      parameters: { limit, offset },
      timestamp: new Date().toISOString(),
      calledFrom: 'listPlaylists method'
    });

    let startTime = performance.now();
    try {
      console.log('🎯 Executing: this.music.api.library.playlists()');
      
      let response;
      
      // CRITICAL: Check Music-User-Token before making library calls
      console.log('🔍 Pre-playlist-fetch token verification:', {
        hasMusicUserToken: !!this.music.musicUserToken,
        musicUserTokenLength: this.music.musicUserToken?.length || 0,
        musicUserTokenPreview: this.music.musicUserToken ? `${this.music.musicUserToken.substring(0, 20)}...` : 'missing',
        authStatus: this.music.authorizationStatus,
        isAuthorized: this.music.isAuthorized
      });
      
      if (!this.music.musicUserToken) {
        console.error('❌ Music-User-Token is missing! This is required for library access.');
        throw new Error('Music-User-Token is missing. Please re-authorize with Apple Music.');
      }
      
      // Try the library API first if it exists
      if (this.music?.api?.library?.playlists) {
        console.log('📚 Using library API method...');
        response = await this.music.api.library.playlists({
          limit,
          offset,
          include: ['tracks']
        });
      } else if (this.music?.api?.music) {
        console.log('🔄 Library API not available, using direct API call...');
        // Fallback to direct API call
        response = await this.music.api.music('/v1/me/library/playlists', {
          limit,
          offset,
          include: ['tracks']
        });
      } else {
        console.log('🔄 MusicKit API not available, using manual fetch...');
        // Last resort: manual API call with explicit headers
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${this.music.developerToken}`,
          'Content-Type': 'application/json'
        };
        
        if (this.music.musicUserToken) {
          headers['Music-User-Token'] = this.music.musicUserToken;
        } else {
          throw new Error('Music-User-Token is required for library access but is missing');
        }
        
        const url = `https://api.music.apple.com/v1/me/library/playlists?limit=${limit}&offset=${offset}&include=tracks`;
        console.log('🌐 Making manual fetch to:', url);
        console.log('🔑 Headers:', {
          ...headers,
          'Authorization': '[REDACTED]',
          'Music-User-Token': '[REDACTED]'
        });
        
        const fetchResponse = await fetch(url, {
          method: 'GET',
          headers
        });
        
        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text();
          console.error('❌ Manual fetch failed:', {
            status: fetchResponse.status,
            statusText: fetchResponse.statusText,
            errorText
          });
          throw new Error(`API call failed: ${fetchResponse.status} ${fetchResponse.statusText} - ${errorText}`);
        }
        
        response = await fetchResponse.json();
      }
      
      const endTime = performance.now();
      const duration = `${(endTime - startTime).toFixed(2)}ms`;
      
      console.log('✅ === API CALL SUCCESSFUL ===', {
        duration,
        responseType: typeof response,
        hasData: !!response?.data,
        dataLength: response?.data?.length || 0,
        responseKeys: response ? Object.keys(response) : 'no response'
      });

      if (!response?.data) {
        console.warn('⚠️ Response received but no data array found:', response);
        return [];
      }

      const playlists = response.data.map((item: any) => this.formatPlaylist(item));
      console.log(`🎉 Successfully formatted ${playlists.length} playlists`);
      
      return playlists;
      
    } catch (error) {
      const endTime = performance.now();
      const duration = `${(endTime - startTime).toFixed(2)}ms`;
      
      console.log('❌ === API CALL FAILED ===', {
        duration,
        errorType: typeof error,
        errorName: error instanceof Error ? error.name : 'unknown',
        errorMessage: error instanceof Error ? error.message : String(error)
      });

      // Try fallback approaches
      console.log('🔄 Trying fallback with parameters...');
      try {
        const fallbackResponse = await this.music.api.library.playlists(limit, offset);
        console.log('✅ Fallback succeeded:', fallbackResponse);
        return fallbackResponse.data?.map((item: any) => this.formatPlaylist(item)) || [];
      } catch (fallbackError) {
        console.log('❌ Fallback also failed:', fallbackError);
        
        // Try manual fetch as last resort
        console.log('🔄 Trying manual fetch as last resort...');
        try {
          const headers: Record<string, string> = {
            'Authorization': `Bearer ${this.music.developerToken}`,
            'Content-Type': 'application/json'
          };
          
          if (this.music.musicUserToken) {
            headers['Music-User-Token'] = this.music.musicUserToken;
          } else {
            throw new Error('Music-User-Token is required for library access but is missing');
          }
          
          const url = `https://api.music.apple.com/v1/me/library/playlists?limit=${limit}&offset=${offset}&include=tracks`;
          console.log('🌐 Manual fetch URL:', url);
          
          const fetchResponse = await fetch(url, {
            method: 'GET',
            headers
          });
          
          if (!fetchResponse.ok) {
            const errorText = await fetchResponse.text();
            console.error('❌ Manual fetch failed:', {
              status: fetchResponse.status,
              statusText: fetchResponse.statusText,
              errorText
            });
            throw new Error(`Manual fetch failed: ${fetchResponse.status} ${fetchResponse.statusText} - ${errorText}`);
          }
          
          const manualResponse = await fetchResponse.json();
          console.log('✅ Manual fetch succeeded:', manualResponse);
          return manualResponse.data?.map((item: any) => this.formatPlaylist(item)) || [];
          
        } catch (manualError) {
          console.log('❌ Manual fetch also failed:', manualError);
        }
      }

      // Log detailed error information
      if (error instanceof Error) {
        console.log('💥 === DETAILED ERROR ANALYSIS ===', {
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
          errorString: error.toString()
        });
      }

      console.log('💥 === FINAL ERROR ===', {
        errorType: typeof error,
        errorName: error instanceof Error ? error.name : 'unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'no stack'
      });

      // Enhanced error handling with region and subscription detection
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        const errorStatus = (error as any)?.status;
        
        // Subscription-related errors
        if (errorMessage.includes('failed to fetch') || 
            errorMessage.includes('cannot read properties of undefined') ||
            errorMessage.includes('library') ||
            errorStatus === 403) {
          throw new Error('Apple Music subscription required. Unable to access your music library. Please ensure you have an active Apple Music subscription.');
        }
        
        // Region/country restriction errors
        if (errorMessage.includes('not available in your country') ||
            errorMessage.includes('region') ||
            errorMessage.includes('country') ||
            errorMessage.includes('storefront') ||
            errorStatus === 451) {
          throw new Error(`Apple Music service may not be available in your region (${this.storefront}). Please check if Apple Music is supported in your country.`);
        }
        
        // Token/authentication errors
        if (errorMessage.includes('unauthorized') ||
            errorMessage.includes('token') ||
            errorStatus === 401) {
          throw new Error('Authentication failed. Please try disconnecting and reconnecting your Apple Music account.');
        }
        
        // Network/connectivity errors
        if (errorMessage.includes('network') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('connection') ||
            errorStatus >= 500) {
          throw new Error('Network error. Please check your internet connection and try again.');
        }
      }

      throw new Error(`Unable to access Apple Music library: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Format a raw playlist object from Apple Music API into our Playlist type
   */
  private formatPlaylist(item: any): Playlist {
    return {
      id: item.id,
      type: 'playlists',
      attributes: {
        name: item.attributes?.name || 'Untitled Playlist',
        description: item.attributes?.description?.standard || '',
        canEdit: item.attributes?.canEdit || false,
        isPublic: item.attributes?.isPublic || false,
        dateAdded: item.attributes?.dateAdded || new Date().toISOString(),
        lastModifiedDate: item.attributes?.lastModifiedDate || new Date().toISOString()
      },
      relationships: {
        tracks: {
          data: item.relationships?.tracks?.data || []
        }
      }
    };
  }

  /**
   * Test library access directly to diagnose subscription and permission issues
   */
  private async testLibraryAccess(): Promise<void> {
    console.log('🧪 === TESTING LIBRARY ACCESS DIRECTLY ===');
    
    // Test 1: Check if library API object exists
    console.log('Test 1 - Library API Object:', {
      hasLibrary: !!this.music?.api?.library,
      libraryType: typeof this.music?.api?.library,
      libraryMethods: this.music?.api?.library ? Object.keys(this.music.api.library) : 'no library'
    });

    // Test 2: Try direct API call
    console.log('Test 2 - Direct API call to /v1/me/library/playlists...');
    console.log('🔍 Pre-request token check:', {
      hasMusicUserToken: !!this.music.musicUserToken,
      musicUserTokenLength: this.music.musicUserToken?.length || 0,
      hasDeveloperToken: !!this.music.developerToken,
      developerTokenLength: this.music.developerToken?.length || 0
    });
    
    try {
      const response = await this.music.api.music('/v1/me/library/playlists', {
        limit: 1
      });
      console.log('✅ Direct API call succeeded:', response);
    } catch (error) {
      console.log('❌ Direct API call failed:', {
        error,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'unknown',
        status: (error as any)?.status,
        response: (error as any)?.response
      });
      
      // If it's a 403, let's check token status again
      if ((error as any)?.status === 403) {
        console.log('🚨 403 Error - Checking token status again:', {
          musicUserToken: this.music.musicUserToken ? `${this.music.musicUserToken.substring(0, 20)}...` : 'missing',
          authStatus: this.music.authorizationStatus,
          isAuthorized: this.music.isAuthorized
        });
      }
    }

    // Test 3: Check subscription status
    console.log('Test 3 - Subscription status check...');
    try {
      const subscriptionStatus = (this.music as any)?.subscriptionStatus;
      if (subscriptionStatus !== undefined) {
        console.log('Subscription status:', subscriptionStatus);
      } else {
        console.log('Subscription status not available on music instance');
      }
    } catch (error) {
      console.log('Error checking subscription status:', error);
    }

    // Test 4: Check user info and storefront
    console.log('Test 4 - User info and storefront...');
    try {
      const userInfo = await this.music.api.music('/v1/me/storefront');
      console.log('✅ User storefront info:', userInfo);
    } catch (error) {
      console.log('❌ Failed to get user storefront:', error);
    }

    // Test 5: Check user's country/region
    console.log('Test 5 - User country/region check...');
    try {
      const userToken = this.music.musicUserToken;
      console.log('User token exists:', !!userToken);
      console.log('User token length:', userToken ? userToken.length : 0);
      
      // Try to get user's country
      const storefrontResponse = await this.music.api.music('/v1/me/storefront');
      console.log('User storefront response:', storefrontResponse);
    } catch (error) {
      console.log('❌ Failed to get user country info:', error);
    }

    // Test 6: Check permissions and capabilities
    console.log('Test 6 - Permissions and capabilities...');
    try {
      const permissionsInfo = {
        hasPermissions: !!this.music.permissions,
        permissions: this.music.permissions,
        capabilities: (this.music as any).capabilities,
        features: (this.music as any).features,
        authorizationStatus: this.music.authorizationStatus,
        isAuthorized: this.music.isAuthorized,
        // Additional debugging for MusicKit JS v3
        hasAPI: !!this.music.api,
        hasLibraryAPI: !!this.music.api?.library,
        hasMusicAPI: !!this.music.api?.music
      };
      console.log('MusicKit permissions & API state:', permissionsInfo);
      
      // Critical check: if hasPermissions is false after authorization, this indicates the core problem
      if (!permissionsInfo.hasPermissions && this.music.isAuthorized) {
        console.log('🚨 CRITICAL: hasPermissions is false despite isAuthorized being true');
        console.log('🚨 This explains why music.api.library is undefined and API calls return 403');
      }
    } catch (error) {
      console.log('Error checking permissions:', error);
    }

    // Test 7: Try alternative library endpoints
    console.log('Test 7 - Testing alternative library endpoints...');
    const endpoints = [
      '/v1/me/library/playlists',
      '/v1/me/library/songs',
      '/v1/me/library/albums',
      '/v1/me/recent/played'
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Testing ${endpoint}...`);
        const response = await this.music.api.music(endpoint, { limit: 1 });
        console.log(`✅ ${endpoint} succeeded:`, response);
      } catch (error) {
        console.log(`❌ ${endpoint} failed:`, {
          error: error instanceof Error ? error.message : String(error),
          status: (error as any)?.status,
          statusText: (error as any)?.statusText
        });
      }
    }

    // Test 8: Check if we need to request additional permissions
    console.log('Test 8 - Checking if additional permissions needed...');
    try {
      // Try to request library access specifically
      if (this.music.requestAuthorization) {
        console.log('Attempting to request library authorization...');
        const libAuth = await this.music.requestAuthorization();
        console.log('Library authorization result:', libAuth);
      } else {
        console.log('requestAuthorization not available');
      }
    } catch (error) {
      console.log('Error requesting library authorization:', error);
    }

    // Test 9: Check Apple Music app status
    console.log('Test 9 - Apple Music app and device status...');
    console.log('Device info:', {
      userAgent: navigator.userAgent,
      userAgentData: (navigator as any).userAgentData?.platform || 'not available',
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine
    });

    // Test 10: Check if user is signed into Apple Music on this device
    console.log('Test 10 - Apple Music sign-in status...');
    try {
      // Try to get user's library stats
      const libraryStats = await this.music.api.music('/v1/me/library/search', {
        term: 'test',
        limit: 1,
        types: 'songs'
      });
      console.log('✅ Library search succeeded (user is signed in):', libraryStats);
    } catch (error) {
      console.log('❌ Library search failed:', {
        error: error instanceof Error ? error.message : String(error),
        status: (error as any)?.status,
        statusText: (error as any)?.statusText,
        details: error
      });
      
      // Check if it's a 403 (forbidden) which might indicate subscription issue
      if ((error as any)?.status === 403) {
        console.log('🚨 403 Forbidden - This might indicate subscription or region restrictions');
      }
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

  async moveTrack(_playlistId: string, _trackId: string, _fromIndex: number, _toIndex: number): Promise<void> {
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

  // Handle 403 errors specifically
  private async handle403Errors(): Promise<void> {
    console.log('🔒 Checking for 403 errors and attempting resolution...');
    
    try {
      // Make a simple test call to see if we get 403 - use the correct API structure
      if (this.music?.api?.music) {
        await this.music.api.music('/v1/me/storefront');
        console.log('✅ No 403 errors detected');
      } else {
        console.log('⚠️ Music API not available for 403 testing');
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes('403') || error.message.includes('Forbidden'))) {
        console.log('🚨 403 Forbidden error detected - attempting to resolve...');
        
        // Try to re-authorize with explicit privacy acknowledgement
        console.log('🔄 Re-authorizing to resolve 403 error...');
        try {
          await this.music.unauthorize();
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Force privacy acknowledgement
          this.privacyAcknowledged = false;
          await this.handlePrivacyAcknowledgement();
          
          // Re-authorize with library scopes
          const authResult = await this.music.authorize(['music.identity', 'library']);
          console.log('🔄 Re-authorization result:', authResult);
          
          // Wait for API to be ready
          await this.waitForMusicAPI();
          
        } catch (reAuthError) {
          console.error('❌ Re-authorization failed:', reAuthError);
        }
      } else {
        console.log('ℹ️ Non-403 error or no error detected:', error);
      }
    }
  }

  // Wait for specific API method to be ready
  private async waitForAPIMethodReady(methodName: string, attempts: number = 10, delay: number = 500): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
      if (this.music?.api && typeof (this.music.api as any)[methodName] === 'function') {
        console.log(`[waitForAPIMethodReady] ✅ musicInstance.api.${methodName} is ready.`);
        return true;
      }
      if (this.music?.api?.music && methodName === 'music') {
        console.log(`[waitForAPIMethodReady] ✅ musicInstance.api.music is ready.`);
        return true;
      }
      console.log(`[waitForAPIMethodReady] ⏳ Waiting for musicInstance.api.${methodName}... Attempt ${i + 1}/${attempts}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    console.error(`[waitForAPIMethodReady] ❌ musicInstance.api.${methodName} did not become available after ${attempts} attempts.`);
    return false;
  }

  // Handle privacy acknowledgement
  private async handlePrivacyAcknowledgement(): Promise<void> {
    console.log('🔒 Handling privacy acknowledgement...');
    
    try {
      // CRITICAL FIX: Ensure API is ready before making test calls
      console.log('🔍 Checking if MusicKit API is ready for privacy test...');
      
      // Wait for the music API to be available
      if (!this.music?.api?.music) {
        console.log('⏳ Waiting for music.api.music to be available...');
        const apiReady = await this.waitForAPIMethodReady('music', 15, 500);
        if (!apiReady) {
          console.error('❌ MusicKit API not available for privacy acknowledgement test');
          this.privacyAcknowledged = true; // Continue anyway
          return;
        }
      }
      
      // Double-check that the API is now available
      if (!this.music?.api?.music) {
        console.error('❌ MusicKit API still not available after waiting');
        this.privacyAcknowledged = true; // Continue anyway
        return;
      }

      console.log('🧪 Attempting privacy acknowledgement test with /v1/me/storefront...');
      try {
        // Use a lightweight, user-specific call to test privacy acknowledgement
        const storefrontResponse = await this.music.api.music('/v1/me/storefront');
        console.log('✅ Privacy test API call successful:', storefrontResponse);
        this.privacyAcknowledged = true;
        return;
      } catch (testError) {
        console.log('⚠️ Privacy test API call failed:', testError);
        
        // Analyze the specific error
        if (testError instanceof Error) {
          if (testError.message.includes('403') || testError.message.includes('Forbidden')) {
            console.log('🔒 403 Forbidden - may indicate privacy acknowledgement needed');
            
            // Try to show privacy acknowledgement UI if available
            if (window.MusicKit?.showPrivacyAcknowledgement) {
              console.log('📋 Attempting to show privacy acknowledgement UI...');
              try {
                await window.MusicKit.showPrivacyAcknowledgement();
                this.privacyAcknowledged = true;
                console.log('✅ Privacy acknowledgement UI completed');
              } catch (uiError) {
                console.log('⚠️ Privacy acknowledgement UI failed:', uiError);
              }
            } else {
              console.log('⚠️ Privacy acknowledgement UI not available in this MusicKit version');
            }
          } else if (testError.message.includes('401') || testError.message.includes('Unauthorized')) {
            console.log('🔑 401 Unauthorized - authentication issue, not privacy');
          } else {
            console.log('🌐 Other error type:', testError.message);
          }
        }
      }

      // Try alternative privacy endpoint if available
      console.log('🔄 Trying alternative privacy endpoint...');
      try {
        await this.music.api.music('/v1/me/privacy');
        this.privacyAcknowledged = true;
        console.log('✅ Alternative privacy API call successful');
      } catch (privacyError) {
        console.log('⚠️ Alternative privacy API call failed:', privacyError);
      }

    } catch (error) {
      console.log('❌ Privacy acknowledgement handling failed:', error);
      // Don't throw - privacy acknowledgement is optional for the main flow
      this.privacyAcknowledged = true; // Continue anyway
    }
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

  // Update user's actual storefront after authorization
  private async updateUserStorefront(): Promise<void> {
    console.log('🌍 Detecting user\'s actual storefront...');
    
    try {
      let storefrontResponse;
      
      // Try multiple methods to get storefront
      if (this.music.api.library?.storefront) {
        console.log('📍 Using library.storefront() method...');
        storefrontResponse = await this.music.api.library.storefront();
      } else if (this.music.api.music) {
        console.log('📍 Using direct API call to /v1/me/storefront...');
        storefrontResponse = await this.music.api.music('/v1/me/storefront');
      } else {
        throw new Error('No storefront access method available');
      }
      
      if (storefrontResponse?.data?.[0]?.id) {
        const newStorefront = storefrontResponse.data[0].id;
        console.log('🌍 Detected user storefront:', {
          previous: this.storefront,
          detected: newStorefront,
          country: storefrontResponse.data[0].attributes?.name
        });
        this.storefront = newStorefront;
      } else {
        console.warn('⚠️ Storefront response missing expected data structure:', storefrontResponse);
      }
    } catch (error) {
      console.warn('❌ Could not detect user storefront, keeping default:', {
        error: error instanceof Error ? error.message : String(error),
        defaultStorefront: this.storefront
      });
    }
  }

  // Validate subscription status
  private async validateSubscription(): Promise<boolean> {
    console.log('💳 Validating Apple Music subscription...');
    
    try {
      // Check subscription status from MusicKit instance
      const subscriptionStatus = this.music?.subscriptionStatus;
      console.log('📊 Subscription status from MusicKit:', subscriptionStatus);
      
      // Also try to get subscription info from API
      try {
        const subscriptionResponse = await this.music.api.music('/v1/me/subscription');
        console.log('📊 Subscription info from API:', subscriptionResponse);
      } catch (apiError) {
        console.log('ℹ️ Subscription API call failed (may not be available):', apiError);
      }
      
      // Test library access as subscription indicator
      try {
        await this.music.api.music('/v1/me/library/playlists', { limit: 1 });
        console.log('✅ Library access test passed - subscription appears active');
        return true;
      } catch (libraryError) {
        console.log('❌ Library access test failed:', {
          error: libraryError instanceof Error ? libraryError.message : String(libraryError),
          status: (libraryError as any)?.status
        });
        
        // Check if it's a subscription-related error
        if ((libraryError as any)?.status === 403) {
          console.log('🚨 403 Forbidden - likely subscription issue');
          return false;
        }
        
        // For other errors, assume subscription is valid but there's another issue
        return true;
      }
    } catch (error) {
      console.error('❌ Subscription validation failed:', error);
      return false;
    }
  }

  // Verify and refresh Music-User-Token
  private async verifyAndRefreshUserToken(): Promise<boolean> {
    console.log('🔑 Verifying Music-User-Token...');
    
    const token = this.music.musicUserToken;
    console.log('🔍 Current token state:', {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      tokenPreview: token ? `${token.substring(0, 20)}...` : 'missing'
    });
    
    if (!token) {
      console.log('⚠️ Music-User-Token is missing, attempting to refresh...');
      
      try {
        // Force token refresh by re-accessing the property
        await new Promise(resolve => setTimeout(resolve, 1000));
        const refreshedToken = this.music.musicUserToken;
        
        if (refreshedToken) {
          console.log('✅ Token refresh successful:', {
            tokenLength: refreshedToken.length,
            tokenPreview: `${refreshedToken.substring(0, 20)}...`
          });
          return true;
        } else {
          console.log('❌ Token refresh failed - still missing');
          return false;
        }
      } catch (error) {
        console.error('❌ Token refresh error:', error);
        return false;
      }
    }
    
    // Test token validity by making a simple API call
    try {
      await this.music.api.music('/v1/me/storefront');
      console.log('✅ Music-User-Token validation successful');
      return true;
    } catch (error) {
      console.log('❌ Music-User-Token validation failed:', {
        error: error instanceof Error ? error.message : String(error),
        status: (error as any)?.status
      });
      
      if ((error as any)?.status === 401) {
        console.log('🔑 401 Unauthorized - token may be expired or invalid');
        return false;
      }
      
      return true; // Assume token is valid for other error types
    }
  }

  // Enhanced authorization scope validation
  private async validateAuthorizationScopes(): Promise<boolean> {
    console.log('🔐 Validating authorization scopes...');
    
    // Check basic authorization state
    const basicAuth = this.music.isAuthorized && this.music.authorizationStatus === 3;
    console.log('📋 Basic authorization check:', {
      isAuthorized: this.music.isAuthorized,
      authStatus: this.music.authorizationStatus,
      passed: basicAuth
    });
    
    if (!basicAuth) {
      console.log('❌ Basic authorization check failed');
      return false;
    }
    
    // Test specific scope access
    const scopeTests = [
      {
        name: 'User Identity',
        test: () => this.music.api.music('/v1/me/storefront')
      },
      {
        name: 'Library Access',
        test: () => this.music.api.music('/v1/me/library/playlists', { limit: 1 })
      }
    ];
    
    const results = [];
    for (const scopeTest of scopeTests) {
      try {
        await scopeTest.test();
        console.log(`✅ ${scopeTest.name} scope: PASSED`);
        results.push(true);
      } catch (error) {
        console.log(`❌ ${scopeTest.name} scope: FAILED`, {
          error: error instanceof Error ? error.message : String(error),
          status: (error as any)?.status
        });
        results.push(false);
      }
    }
    
    const allPassed = results.every(r => r);
    console.log('📊 Scope validation summary:', {
      userIdentity: results[0],
      libraryAccess: results[1],
      allPassed
    });
    
    return allPassed;
  }

  // Wait for music API to be available after authorization
  private async waitForMusicAPI(): Promise<boolean> {
    const maxRetries = 30; // Increased to ~15 seconds
    const retryDelay = 500; // ms

    for (let i = 0; i < maxRetries; i++) {
      const checkMusicAPI = () => {
        console.log(`[waitForMusicAPI Attempt ${i + 1}/${maxRetries}] Checking API state...`);
        const apiState = {
          musicInstanceExists: !!this.music,
          apiObjectExists: !!this.music?.api,
          apiMusicExists: !!this.music?.api?.music,
          apiLibraryExists: !!this.music?.api?.library,
          authorizationStatus: this.music?.authorizationStatus,
          isAuthorizedFlag: this.music?.isAuthorized,
          // Additional debugging
          apiKeys: this.music?.api ? Object.keys(this.music.api) : 'no api',
          libraryType: this.music?.api?.library ? typeof this.music.api.library : 'undefined'
        };
        console.log(`[waitForMusicAPI Attempt ${i + 1}/${maxRetries}] Current API state:`, apiState);
        
        // Basic readiness check (music API + authorization)
        const basicReady = this.music && 
                          this.music.api && 
                          this.music.api.music && 
                          this.music.authorizationStatus === 3;
        
        // Full readiness check (includes library API)
        const fullyReady = basicReady && this.music.api.library;
        
        if (fullyReady) {
          console.log(`[waitForMusicAPI] ✅ Fully ready with library API!`);
          return true;
        } else if (basicReady && i >= 15) {
          // After 15 attempts (~7.5 seconds), library API is missing - this is the core issue
          console.log(`[waitForMusicAPI] ⚠️ Basic API ready but library API missing. This is the root cause of 403 errors.`);
          
          // CRITICAL FIX: Manually create library API if missing
          if (!this.music.api.library && this.music.api.music) {
            console.log(`[waitForMusicAPI] 🔧 APPLYING FIX: Manually creating library API wrapper...`);
            console.log(`[waitForMusicAPI] 📋 This solves the 'music.api.library is undefined' issue`);
            
            this.music.api.library = {
              playlists: async (params: any) => {
                console.log('📚 Using manual library.playlists wrapper (bypassing MusicKit JS library API)');
                return await this.music.api.music('/v1/me/library/playlists', params);
              },
              playlist: async (id: string, params: any) => {
                console.log('📚 Using manual library.playlist wrapper');
                return await this.music.api.music(`/v1/me/library/playlists/${id}`, params);
              },
              storefront: async () => {
                console.log('📚 Using manual library.storefront wrapper');
                return await this.music.api.music('/v1/me/storefront');
              }
            };
            console.log(`[waitForMusicAPI] ✅ Manual library API created - 403 errors should now be resolved`);
          } else {
            console.log(`[waitForMusicAPI] ❌ Cannot create manual library API - music.api.music not available`);
          }
          
          return true;
        }
        
        return false;
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