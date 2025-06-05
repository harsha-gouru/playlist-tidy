import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { get, set } from 'idb-keyval';
import type { PlaylistState, Playlist, Track, Mutation, Snapshot } from '../types';
import appleMusicAPI from '../lib/apple';

interface PlaylistStore extends PlaylistState {
  // Actions
  loadPlaylists: () => Promise<void>;
  selectPlaylist: (id: string | null) => void;
  addPlaylist: (playlist: Playlist) => void;
  updatePlaylist: (id: string, updates: Partial<Playlist>) => void;
  deletePlaylist: (id: string) => void;
  addTrackToPlaylist: (playlistId: string, track: Track) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  moveTrack: (playlistId: string, fromIndex: number, toIndex: number) => void;
  applyMutations: (playlistId: string, mutations: Mutation[]) => void;
  
  // History management
  createSnapshot: (description: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // Sync with Apple Music
  syncPlaylist: (id: string) => Promise<void>;
  pushChanges: (id: string) => Promise<void>;
  revertChanges: (id: string) => void;
}

// Custom persist storage using IndexedDB
const storage = {
  getItem: async (name: string) => {
    const value = await get(name);
    return value || null;
  },
  setItem: async (name: string, value: string) => {
    await set(name, value);
  },
  removeItem: async (name: string) => {
    await set(name, undefined);
  },
};

export const usePlaylistStore = create<PlaylistStore>()(
  persist(
    (set, get) => ({
      // Initial state
      entities: {},
      order: [],
      selectedId: null,
      history: [],
      historyIndex: -1,
      isDirty: {},

      // Actions
      loadPlaylists: async () => {
        console.log('🏪 === PLAYLIST STORE: loadPlaylists called ===');
        console.log('📍 Called from:', new Error().stack?.split('\n')[2]?.trim());
        console.log('⏰ Timestamp:', new Date().toISOString());
        
        try {
          console.log('📞 Store calling appleMusicAPI.listPlaylists()...');
          const playlists = await appleMusicAPI.listPlaylists();
          
          console.log('✅ Store received playlists:', {
            count: playlists.length,
            firstPlaylist: playlists[0] ? {
              id: playlists[0].id,
              name: playlists[0].attributes?.name || 'no name'
            } : 'no playlists'
          });
          
          const entities: Record<string, Playlist> = {};
          const order: string[] = [];

          playlists.forEach(playlist => {
            entities[playlist.id] = playlist;
            order.push(playlist.id);
          });

          set({ entities, order });
          get().createSnapshot('Loaded playlists from Apple Music');
          
          console.log('🏪 Store updated successfully with', playlists.length, 'playlists');
        } catch (error) {
          console.error('🏪 Store failed to load playlists:', error);
        }
      },

      selectPlaylist: (id: string | null) => {
        set({ selectedId: id });
      },

      addPlaylist: (playlist: Playlist) => {
        set(state => ({
          entities: { ...state.entities, [playlist.id]: playlist },
          order: [...state.order, playlist.id],
          isDirty: { ...state.isDirty, [playlist.id]: false }
        }));
        get().createSnapshot(`Added playlist: ${playlist.attributes.name}`);
      },

      updatePlaylist: (id: string, updates: Partial<Playlist>) => {
        set(state => {
          const playlist = state.entities[id];
          if (!playlist) return state;

          return {
            entities: {
              ...state.entities,
              [id]: { ...playlist, ...updates }
            },
            isDirty: { ...state.isDirty, [id]: true }
          };
        });
      },

      deletePlaylist: (id: string) => {
        set(state => {
          const { [id]: deleted, ...entities } = state.entities;
          const { [id]: deletedDirty, ...isDirty } = state.isDirty;
          
          return {
            entities,
            order: state.order.filter(playlistId => playlistId !== id),
            selectedId: state.selectedId === id ? null : state.selectedId,
            isDirty
          };
        });
        get().createSnapshot(`Deleted playlist`);
      },

      addTrackToPlaylist: (playlistId: string, track: Track) => {
        set(state => {
          const playlist = state.entities[playlistId];
          if (!playlist) return state;

          const tracks = playlist.relationships?.tracks?.data || [];
          const updatedPlaylist = {
            ...playlist,
            relationships: {
              ...playlist.relationships,
              tracks: {
                data: [...tracks, track]
              }
            }
          };

          return {
            entities: { ...state.entities, [playlistId]: updatedPlaylist },
            isDirty: { ...state.isDirty, [playlistId]: true }
          };
        });
      },

      removeTrackFromPlaylist: (playlistId: string, trackId: string) => {
        set(state => {
          const playlist = state.entities[playlistId];
          if (!playlist) return state;

          const tracks = playlist.relationships?.tracks?.data || [];
          const updatedPlaylist = {
            ...playlist,
            relationships: {
              ...playlist.relationships,
              tracks: {
                data: tracks.filter(track => track.id !== trackId)
              }
            }
          };

          return {
            entities: { ...state.entities, [playlistId]: updatedPlaylist },
            isDirty: { ...state.isDirty, [playlistId]: true }
          };
        });
      },

      moveTrack: (playlistId: string, fromIndex: number, toIndex: number) => {
        set(state => {
          const playlist = state.entities[playlistId];
          if (!playlist) return state;

          const tracks = [...(playlist.relationships?.tracks?.data || [])];
          const [movedTrack] = tracks.splice(fromIndex, 1);
          tracks.splice(toIndex, 0, movedTrack);

          const updatedPlaylist = {
            ...playlist,
            relationships: {
              ...playlist.relationships,
              tracks: { data: tracks }
            }
          };

          return {
            entities: { ...state.entities, [playlistId]: updatedPlaylist },
            isDirty: { ...state.isDirty, [playlistId]: true }
          };
        });
      },

      applyMutations: (playlistId: string, mutations: Mutation[]) => {
        mutations.forEach(mutation => {
          switch (mutation.op) {
            case 'add':
              if (mutation.tracks) {
                mutation.tracks.forEach(track => {
                  get().addTrackToPlaylist(playlistId, track);
                });
              }
              break;
            case 'remove':
              if (mutation.trackId) {
                get().removeTrackFromPlaylist(playlistId, mutation.trackId);
              }
              break;
            case 'move':
              if (mutation.fromIndex !== undefined && mutation.toIndex !== undefined) {
                get().moveTrack(playlistId, mutation.fromIndex, mutation.toIndex);
              }
              break;
            case 'rename':
              if (mutation.name) {
                get().updatePlaylist(playlistId, {
                  attributes: { ...get().entities[playlistId].attributes, name: mutation.name }
                });
              }
              break;
          }
        });
        get().createSnapshot(`Applied ${mutations.length} mutations`);
      },

      // History management
      createSnapshot: (description: string) => {
        set(state => {
          const snapshot: Snapshot = {
            entities: { ...state.entities },
            order: [...state.order],
            timestamp: Date.now(),
            description
          };

          // Remove any future history if we're not at the end
          const newHistory = state.history.slice(0, state.historyIndex + 1);
          newHistory.push(snapshot);

          // Limit history to 50 snapshots
          if (newHistory.length > 50) {
            newHistory.shift();
          }

          return {
            history: newHistory,
            historyIndex: newHistory.length - 1
          };
        });
      },

      undo: () => {
        set(state => {
          if (state.historyIndex <= 0) return state;

          const previousSnapshot = state.history[state.historyIndex - 1];
          return {
            entities: { ...previousSnapshot.entities },
            order: [...previousSnapshot.order],
            historyIndex: state.historyIndex - 1,
            isDirty: {} // Reset dirty state after undo
          };
        });
      },

      redo: () => {
        set(state => {
          if (state.historyIndex >= state.history.length - 1) return state;

          const nextSnapshot = state.history[state.historyIndex + 1];
          return {
            entities: { ...nextSnapshot.entities },
            order: [...nextSnapshot.order],
            historyIndex: state.historyIndex + 1,
            isDirty: {} // Reset dirty state after redo
          };
        });
      },

      canUndo: () => get().historyIndex > 0,
      canRedo: () => get().historyIndex < get().history.length - 1,

      // Sync with Apple Music
      syncPlaylist: async (id: string) => {
        try {
          const playlist = await appleMusicAPI.getPlaylist(id);
          set(state => ({
            entities: { ...state.entities, [id]: playlist },
            isDirty: { ...state.isDirty, [id]: false }
          }));
        } catch (error) {
          console.error('Failed to sync playlist:', error);
        }
      },

      pushChanges: async (id: string) => {
        const state = get();
        const playlist = state.entities[id];
        if (!playlist || !state.isDirty[id]) return;

        try {
          // This would contain the logic to generate mutations and push to Apple Music
          // For now, we'll just mark as clean
          set(state => ({
            isDirty: { ...state.isDirty, [id]: false }
          }));
        } catch (error) {
          console.error('Failed to push changes:', error);
        }
      },

      revertChanges: (id: string) => {
        get().syncPlaylist(id);
      }
    }),
    {
      name: 'playlist-store',
      storage: storage as any,
      partialize: (state) => ({
        entities: state.entities,
        order: state.order,
        history: state.history,
        historyIndex: state.historyIndex,
        selectedId: state.selectedId,
        isDirty: state.isDirty
      }) as any
    }
  )
); 