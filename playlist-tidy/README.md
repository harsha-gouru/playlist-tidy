# Playlist Tidy v0.1

A **local-first** web app that helps you declutter and organize your Apple Music playlists with AI assistance. Built with React, TypeScript, and Tailwind CSS.

## ✨ Features

- **🎵 Apple Music Integration** - Connect with automatic developer token generation
- **🤖 AI-Powered Organization** - Generate smart playlist names, auto-group tracks, and get recommendations
- **🎯 Drag & Drop Interface** - Intuitive track reordering and playlist management
- **⏪ Undo/Redo** - Full history tracking with keyboard shortcuts (⌘Z / ⇧⌘Z)
- **💾 Local-First** - Your data persists locally with IndexedDB
- **🔄 Sync Status** - Visual indicators for unsaved changes with push/revert options
- **📱 Responsive Design** - Works on desktop and mobile devices

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Apple Music subscription
- OpenAI API key (for AI features)

### Installation

```bash
# Clone and install dependencies
git clone <repository-url>
cd playlist-tidy
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your OpenAI API key:
# VITE_OPENAI_API_KEY=your_openai_api_key_here

# Start development server
pnpm dev
```

### Apple Music Setup

1. **Automatic Token Strategy** (Recommended)
   - The app uses Apple's automatic developer token generation
   - No manual JWT setup required
   - Just authorize when prompted

2. **Manual Token Setup** (Optional)
   - Visit [Apple Developer Portal](https://developer.apple.com/account/)
   - Create a Media Identifier and private key
   - Generate JWT tokens manually if needed

## 🎯 Usage

### Getting Started

1. **Connect Apple Music** - Authorize the app to access your music library
2. **Browse Playlists** - View all your playlists in the sidebar
3. **Select & Edit** - Click a playlist to start organizing tracks
4. **Use AI Features** - Generate names, group tracks, or get recommendations

### AI Features

#### 🏷️ Smart Naming
- Select tracks and click "AI Name" to generate creative playlist names
- AI analyzes genre, mood, and themes to suggest relevant names

#### 🎼 Auto-Grouping
- Use "AI Group" to automatically organize tracks into logical playlists
- Groups by genre, mood, energy level, or thematic similarity

#### 💡 Recommendations
- Click "AI Recommend" to discover similar tracks from Apple Music catalog
- Based on your selected tracks' style and characteristics

### Keyboard Shortcuts

- `⌘Z` / `Ctrl+Z` - Undo last action
- `⇧⌘Z` / `Ctrl+Shift+Z` - Redo action
- `↑/↓` - Navigate playlist selection
- `⌘/Ctrl + Drag` - Multi-select tracks

### Sync Management

- **Dirty Badge** - Shows when playlists have unsaved changes
- **Push Changes** - Sync local changes to Apple Music
- **Revert Changes** - Discard local changes and reload from Apple Music

## 🛠️ Development

### Project Structure

```
src/
├── components/          # React components
│   ├── PlaylistSidebar.tsx
│   ├── PlaylistEditor.tsx
│   └── TrackTable.tsx
├── hooks/              # Custom React hooks
│   └── useAuth.ts
├── lib/                # Core libraries
│   └── apple.ts        # Apple Music API wrapper
├── store/              # Zustand state management
│   └── playlists.ts
├── ai/                 # AI integration
│   └── index.ts        # OpenAI function calls
├── types/              # TypeScript definitions
│   └── index.ts
└── test/               # Test setup and utilities
    └── setup.ts
```

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm test         # Run tests
pnpm test:ui      # Run tests with UI
pnpm lint         # Lint code
pnpm preview      # Preview production build
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:run --coverage

# Run tests in watch mode
pnpm test --watch
```

## 🔧 Configuration

### Environment Variables

```bash
# Required for AI features
VITE_OPENAI_API_KEY=your_openai_api_key_here

# Optional: Manual Apple Music token
VITE_APPLE_MUSIC_TOKEN=your_apple_music_token_here
```

### Apple Music API

The app uses Apple's MusicKit JS with automatic developer token strategy:

- **Library Access**: `/v1/me/library/playlists`
- **Catalog Search**: `/v1/catalog/{storefront}/search`
- **Automatic Tokens**: No manual JWT setup required

## 🧪 Testing Strategy

- **Unit Tests** - Hooks, utilities, and pure functions
- **Integration Tests** - API wrappers and state management
- **Component Tests** - UI components with React Testing Library
- **MSW Mocking** - Apple Music API responses for testing

## 📦 Tech Stack

- **Frontend**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS + Headless UI
- **State**: Zustand with IndexedDB persistence
- **Drag & Drop**: react-dnd
- **Tables**: @tanstack/react-table
- **AI**: OpenAI GPT-4 with function calling
- **Testing**: Vitest + React Testing Library + MSW

## 🚧 Roadmap

### v0.2 (Planned)
- [ ] Batch operations for large playlists
- [ ] Export/import playlist data
- [ ] Advanced filtering and search
- [ ] Playlist templates and presets

### v0.3 (Future)
- [ ] Collaborative playlist editing
- [ ] Cloud sync plugin (Firestore/iCloud)
- [ ] Advanced AI features (mood analysis, BPM matching)
- [ ] Integration with other music services

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Apple Music API and MusicKit JS
- OpenAI for AI capabilities
- React and TypeScript communities
- All the amazing open-source libraries used

---

**Note**: This app requires an Apple Music subscription and OpenAI API access. Your music data remains private and is processed locally. 