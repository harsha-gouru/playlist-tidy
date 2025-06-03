import { useState, useMemo } from 'react';
import { usePlaylistStore } from '../store/playlists';
import { useAuth } from '../hooks/useAuth';

export default function PlaylistSidebar() {
  const { unauthorize } = useAuth();
  const { 
    entities, 
    order, 
    selectedId, 
    selectPlaylist, 
    isDirty,
    canUndo,
    canRedo,
    undo,
    redo
  } = usePlaylistStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showDirtyOnly, setShowDirtyOnly] = useState(false);

  const filteredPlaylists = useMemo(() => {
    let filtered = order.map(id => entities[id]).filter(Boolean);
    
    if (searchTerm) {
      filtered = filtered.filter(playlist =>
        playlist.attributes.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (showDirtyOnly) {
      filtered = filtered.filter(playlist => isDirty[playlist.id]);
    }
    
    return filtered;
  }, [entities, order, searchTerm, showDirtyOnly, isDirty]);

  const dirtyCount = Object.values(isDirty).filter(Boolean).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Playlists</h1>
          <button
            onClick={unauthorize}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign Out
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Search playlists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showDirtyOnly}
              onChange={(e) => setShowDirtyOnly(e.target.checked)}
              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-600">
              Unsaved only {dirtyCount > 0 && `(${dirtyCount})`}
            </span>
          </label>
        </div>
      </div>

      {/* Undo/Redo Controls */}
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <button
            onClick={undo}
            disabled={!canUndo()}
            className="flex items-center px-2 py-1 text-xs bg-white border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo()}
            className="flex items-center px-2 py-1 text-xs bg-white border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
            </svg>
            Redo
          </button>
        </div>
      </div>

      {/* Playlist List */}
      <div className="flex-1 overflow-y-auto">
        {filteredPlaylists.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {searchTerm ? 'No playlists match your search' : 'No playlists found'}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredPlaylists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => selectPlaylist(playlist.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedId === playlist.id
                    ? 'bg-blue-100 border border-blue-200'
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {playlist.attributes.name}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {playlist.relationships?.tracks?.data?.length || 0} tracks
                    </p>
                  </div>
                  
                  {isDirty[playlist.id] && (
                    <div className="ml-2 flex-shrink-0">
                      <div className="w-2 h-2 bg-orange-400 rounded-full" title="Unsaved changes" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>{filteredPlaylists.length} playlists</span>
          {dirtyCount > 0 && (
            <span className="text-orange-600 font-medium">
              {dirtyCount} unsaved
            </span>
          )}
        </div>
      </div>
    </div>
  );
} 