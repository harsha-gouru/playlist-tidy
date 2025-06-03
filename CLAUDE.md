# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is **Playlist Tidy v0.1** - a local-first web app for organizing Apple Music playlists with AI assistance. The main application is located in the `playlist-tidy/` directory.

**Key Architecture Components:**

- **Local-first design**: Data persists in IndexedDB with Zustand state management
- **Apple Music Integration**: Uses MusicKit JS with automatic developer token strategy (`src/lib/apple.ts`)
- **AI-powered features**: OpenAI GPT-4 with function calling for playlist organization (`src/ai/index.ts`)
- **State Management**: Zustand store with undo/redo history and dirty state tracking (`src/store/playlists.ts`)
- **UI Framework**: React 19 + TypeScript + Tailwind CSS with Headless UI components

## Development Commands

All commands should be run from the `playlist-tidy/` directory:

```bash
# Development
pnpm dev          # Start development server
pnpm build        # Build for production (runs tsc -b && vite build)
pnpm preview      # Preview production build

# Code Quality
pnpm lint         # ESLint code checking
pnpm test         # Run Vitest tests
pnpm test:ui      # Run tests with UI
pnpm test:run     # Run tests once (with --coverage for coverage)
```

## Environment Setup

Required environment variables in `.env`:
- `VITE_OPENAI_API_KEY` - Required for AI features
- `VITE_APPLE_MUSIC_TOKEN` - Optional, uses automatic token strategy by default

## Core Architecture Patterns

**State Management Pattern:**
- Zustand store with IndexedDB persistence via `idb-keyval`
- Undo/redo history with snapshots (`createSnapshot`, `undo`, `redo`)
- Dirty state tracking for unsaved changes (`isDirty` map)
- Mutation-based operations for Apple Music API sync

**Apple Music Integration:**
- Singleton API class (`appleMusicAPI`) with MusicKit JS wrapper
- Automatic developer token configuration (no manual JWT setup)
- Mutation pattern for playlist operations (`Mutation[]` arrays)
- Storefront detection for catalog search

**AI Integration:**
- OpenAI function calling with predefined functions for playlist operations
- Three AI modes: `name` (generate names), `group` (organize tracks), `recommend` (find similar)
- Batch processing support for large playlists (`batchAIOperation`)

**Component Architecture:**
- `PlaylistSidebar` - Playlist navigation with dirty state indicators
- `PlaylistEditor` - Main editing interface with drag-and-drop
- `AuthScreen` - Apple Music authorization flow
- Error boundaries and loading states throughout

## Tech Stack Notes

- **Testing**: Vitest + React Testing Library + MSW for API mocking
- **Drag & Drop**: react-dnd with HTML5 backend
- **Tables**: @tanstack/react-table for track management
- **Persistence**: IndexedDB via idb-keyval (not localStorage)
- **Types**: Comprehensive TypeScript definitions in `src/types/index.ts`