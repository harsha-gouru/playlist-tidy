import { useState, useEffect, useCallback } from 'react';
import appleMusicAPI from '../lib/apple';

interface AuthState {
  isAuthorized: boolean;
  isLoading: boolean;
  error: string | null;
  music: any;
  storefront: string;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthorized: false,
    isLoading: true,
    error: null,
    music: null,
    storefront: ''
  });

  const initialize = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      await appleMusicAPI.initialize();
      
      const isAuthorized = appleMusicAPI.isAuthorized;
      console.log('🔄 useAuth: Setting initial state after initialization', { isAuthorized });
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isAuthorized,
        music: appleMusicAPI.musicInstance,
        storefront: appleMusicAPI.userStorefront
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize Apple Music'
      }));
    }
  }, []);

  const authorize = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const success = await appleMusicAPI.authorize();
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isAuthorized: success,
        music: appleMusicAPI.musicInstance,
        storefront: appleMusicAPI.userStorefront
      }));

      return success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authorization failed'
      }));
      return false;
    }
  }, []);

  const unauthorize = useCallback(() => {
    if (state.music) {
      state.music.unauthorize();
    }
    
    setState(prev => ({
      ...prev,
      isAuthorized: false,
      music: null
    }));
  }, [state.music]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Listen for authorization changes
  useEffect(() => {
    if (state.music) {
      const handleAuthorizationStatusDidChange = (event: any) => {
        setState(prev => ({
          ...prev,
          isAuthorized: event.authorizationStatus === 3 // MusicKit.AuthorizationStatus.authorized
        }));
      };

      state.music.addEventListener('authorizationStatusDidChange', handleAuthorizationStatusDidChange);

      return () => {
        state.music.removeEventListener('authorizationStatusDidChange', handleAuthorizationStatusDidChange);
      };
    }
  }, [state.music]);

  return {
    ...state,
    authorize,
    unauthorize,
    initialize
  };
} 