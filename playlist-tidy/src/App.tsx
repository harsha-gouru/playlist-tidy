import { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useAuth } from './hooks/useAuth';
import { usePlaylistStore } from './store/playlists';
import PlaylistSidebar from './components/PlaylistSidebar';
import PlaylistEditor from './components/PlaylistEditor';
import AuthScreen from './components/AuthScreen';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const { isAuthorized, isLoading, error } = useAuth();
  const { loadPlaylists, selectedId } = usePlaylistStore();



  // Load playlists when authorized
  useEffect(() => {
    console.log('🎯 App useEffect triggered:', { isAuthorized, isLoading, error });
    if (isAuthorized) {
      console.log('✅ User is authorized - loading playlists...');
      loadPlaylists();
    } else {
      console.log('❌ User not authorized - skipping playlist load');
    }
  }, [isAuthorized, loadPlaylists]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { ctrlKey, metaKey, key, shiftKey } = event;
      const isModifier = ctrlKey || metaKey;

      if (isModifier && key === 'z') {
        event.preventDefault();
        const store = usePlaylistStore.getState();
        if (shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return <AuthScreen />;
  }

  return (
    <ErrorBoundary>
      <DndProvider backend={HTML5Backend}>
        <div className="h-screen flex bg-gray-50">
          {/* Sidebar */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            <PlaylistSidebar />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedId ? (
              <PlaylistEditor playlistId={selectedId} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    Welcome to Playlist Tidy
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Select a playlist from the sidebar to start organizing your music
                  </p>
                  <div className="space-y-2 text-sm text-gray-500">
                    <p>• Use AI to generate smart playlist names</p>
                    <p>• Auto-group tracks by genre, mood, or theme</p>
                    <p>• Get recommendations from Apple Music catalog</p>
                    <p>• Drag and drop to reorder tracks</p>
                    <p>• Undo/redo with ⌘Z / ⇧⌘Z</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DndProvider>
    </ErrorBoundary>
  );
}

export default App; 