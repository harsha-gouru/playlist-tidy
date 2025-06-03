import { useState } from 'react';
import { usePlaylistStore } from '../store/playlists';
import { callAI } from '../ai';
import type { Track } from '../types';

interface PlaylistEditorProps {
  playlistId: string;
}

export default function PlaylistEditor({ playlistId }: PlaylistEditorProps) {
  const { entities, isDirty, pushChanges, revertChanges } = usePlaylistStore();
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [isAILoading, setIsAILoading] = useState(false);

  const playlist = entities[playlistId];
  const tracks = playlist?.relationships?.tracks?.data || [];
  const hasUnsavedChanges = isDirty[playlistId];

  const handleAIAction = async (mode: 'name' | 'group' | 'recommend') => {
    if (selectedTracks.length === 0) return;
    
    setIsAILoading(true);
    try {
      const selectedTrackData = tracks.filter(track => selectedTracks.includes(track.id));
      const result = await callAI({ mode, tracks: selectedTrackData });
      
      // Handle AI results based on mode
      if (mode === 'name' && result.suggestions) {
        console.log('AI Name Suggestions:', result.suggestions);
        // TODO: Show suggestions in a modal
      } else if (mode === 'group' && result.mutations) {
        console.log('AI Grouping:', result.mutations);
        // TODO: Apply mutations
      } else if (mode === 'recommend' && result.recommendations) {
        console.log('AI Recommendations:', result.recommendations);
        // TODO: Show recommendations
      }
    } catch (error) {
      console.error('AI action failed:', error);
    } finally {
      setIsAILoading(false);
    }
  };

  if (!playlist) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Playlist not found
          </h2>
          <p className="text-gray-600">
            The selected playlist could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {playlist.attributes.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {tracks.length} tracks
              {hasUnsavedChanges && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                  Unsaved changes
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {hasUnsavedChanges && (
              <>
                <button
                  onClick={() => revertChanges(playlistId)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Revert
                </button>
                <button
                  onClick={() => pushChanges(playlistId)}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Push Changes
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* AI Controls */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-700">
            AI Actions ({selectedTracks.length} selected):
          </span>
          <button
            onClick={() => handleAIAction('name')}
            disabled={selectedTracks.length === 0 || isAILoading}
            className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
          >
            Generate Names
          </button>
          <button
            onClick={() => handleAIAction('group')}
            disabled={selectedTracks.length === 0 || isAILoading}
            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
          >
            Auto Group
          </button>
          <button
            onClick={() => handleAIAction('recommend')}
            disabled={selectedTracks.length === 0 || isAILoading}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
          >
            Recommend Similar
          </button>
          {isAILoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
          )}
        </div>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-auto">
        {tracks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No tracks in this playlist
              </h3>
              <p className="text-gray-600">
                Add some tracks to get started organizing!
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-12 px-6 py-3">
                      <input
                        type="checkbox"
                        checked={selectedTracks.length === tracks.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTracks(tracks.map(t => t.id));
                          } else {
                            setSelectedTracks([]);
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Track
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Artist
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Album
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tracks.map((track, index) => (
                    <tr
                      key={track.id}
                      className={`hover:bg-gray-50 ${
                        selectedTracks.includes(track.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedTracks.includes(track.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTracks([...selectedTracks, track.id]);
                            } else {
                              setSelectedTracks(selectedTracks.filter(id => id !== track.id));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {track.attributes.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {track.attributes.artistName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {track.attributes.albumName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {Math.floor(track.attributes.durationInMillis / 60000)}:
                        {String(Math.floor((track.attributes.durationInMillis % 60000) / 1000)).padStart(2, '0')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 