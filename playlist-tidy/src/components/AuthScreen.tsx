import { useAuth } from '../hooks/useAuth';

export default function AuthScreen() {
  const { authorize, isLoading, error } = useAuth();

  const handleAuthorize = async () => {
    await authorize();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center" style={{minHeight: '100vh'}}>
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8" style={{maxWidth: '28rem', width: '100%', margin: '0 1rem'}}>
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mb-6" style={{width: '64px', height: '64px', maxWidth: '64px', maxHeight: '64px'}}>
            <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24" style={{width: '32px', height: '32px', maxWidth: '32px', maxHeight: '32px'}}>
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
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