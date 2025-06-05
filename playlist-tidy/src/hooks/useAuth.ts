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

  const [initializationStarted, setInitializationStarted] = useState(false);

  const initialize = useCallback(async () => {
    if (initializationStarted) {
      console.log('🔄 useAuth: Initialization already started, skipping...');
      return;
    }

    setInitializationStarted(true);
    console.log('🔄 useAuth: Starting initialization...');

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
  }, [initializationStarted]);

  const authorize = useCallback(async () => {
    // Prevent multiple rapid authorization attempts
    if (state.isLoading) {
      console.log('🔄 useAuth: Authorization already in progress, skipping...');
      return state.isAuthorized;
    }

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
  }, [state.isLoading, state.isAuthorized]);

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

  // Listen for authorization changes (with debouncing)
  useEffect(() => {
    if (state.music) {
      let timeoutId: NodeJS.Timeout;
      
      const handleAuthorizationStatusDidChange = (event: any) => {
        console.log('🔄 useAuth: Authorization status changed:', event.authorizationStatus);
        
        // Debounce the state update to prevent rapid changes
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          const newIsAuthorized = event.authorizationStatus === 3;
          if (newIsAuthorized !== state.isAuthorized) {
            console.log('🔄 useAuth: Updating authorization state:', newIsAuthorized);
            setState(prev => ({
              ...prev,
              isAuthorized: newIsAuthorized
            }));
          }
        }, 500); // 500ms debounce
      };

      state.music.addEventListener('authorizationStatusDidChange', handleAuthorizationStatusDidChange);

      return () => {
        clearTimeout(timeoutId);
        state.music.removeEventListener('authorizationStatusDidChange', handleAuthorizationStatusDidChange);
      };
    }
  }, [state.music, state.isAuthorized]);

  return {
    ...state,
    authorize,
    unauthorize,
    initialize
  };
} 