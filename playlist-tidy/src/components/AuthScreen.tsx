import { useAuth } from '../hooks/useAuth';

export default function AuthScreen() {
  const { authorize, isLoading, error } = useAuth();

  const handleAuthorize = async () => {
    await authorize();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mb-6">
            <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to Playlist Tidy
          </h1>
          
          <p className="text-gray-600 mb-8">
            Connect your Apple Music account to start organizing your playlists with AI assistance.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-medium mb-2">{error}</p>
              {error.includes('developer token') && (
                <div className="text-red-600 text-xs space-y-1">
                  <p>For local development:</p>
                  <p>1. Visit <a href="https://developer.apple.com/account/" target="_blank" rel="noopener noreferrer" className="underline">Apple Developer Portal</a></p>
                  <p>2. Create a MusicKit identifier and private key</p>
                  <p>3. Generate a JWT token and add it to your .env file as VITE_APPLE_MUSIC_TOKEN</p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleAuthorize}
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Connecting...' : 'Connect Apple Music'}
          </button>

          <div className="mt-6 text-xs text-gray-500 space-y-2">
            <p>• Your music data stays private and secure</p>
            <p>• We only access your playlists to help organize them</p>
            <p>• You can disconnect at any time</p>
          </div>
        </div>
      </div>
    </div>
  );
} 