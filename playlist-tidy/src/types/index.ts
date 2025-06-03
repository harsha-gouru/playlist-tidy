// Core Apple Music types
export interface Track {
  id: string;
  type: 'songs';
  attributes: {
    name: string;
    artistName: string;
    albumName: string;
    durationInMillis: number;
    playParams?: {
      id: string;
      kind: 'song';
    };
    artwork?: {
      url: string;
      width: number;
      height: number;
    };
  };
}

export interface Playlist {
  id: string;
  type: 'playlists';
  attributes: {
    name: string;
    description?: string;
    canEdit: boolean;
    isPublic: boolean;
    dateAdded: string;
    lastModifiedDate: string;
  };
  relationships?: {
    tracks?: {
      data: Track[];
    };
  };
}

export interface CatalogTrack extends Track {
  type: 'songs';
}

// AI Integration types
export type AIMode = 'name' | 'group' | 'recommend';

export interface AIPayload {
  mode: AIMode;
  tracks: Track[];
  context?: string; // Additional context for AI operations
}

export interface AIResult {
  mutations?: Mutation[];
  recommendations?: CatalogTrack[];
  suggestions?: string[]; // For naming suggestions
}

// State management types
export interface Mutation {
  op: 'add' | 'remove' | 'move' | 'rename' | 'create' | 'delete';
  playlistId: string;
  trackId?: string;
  fromIndex?: number;
  toIndex?: number;
  name?: string;
  tracks?: Track[];
}

export interface PlaylistState {
  entities: Record<string, Playlist>;
  order: string[];
  selectedId: string | null;
  history: Snapshot[];
  historyIndex: number;
  isDirty: Record<string, boolean>; // Track which playlists have unsaved changes
}

export interface Snapshot {
  entities: Record<string, Playlist>;
  order: string[];
  timestamp: number;
  description: string;
}

// Apple Music API types
export interface AppleMusicAPI {
  music: any; // MusicKit instance
  storefront: string;
}

export interface SearchResult {
  songs?: {
    data: CatalogTrack[];
  };
}

// UI Component types
export interface DragItem {
  type: 'track';
  trackId: string;
  playlistId: string;
  index: number;
}

export interface TableColumn {
  id: string;
  header: string;
  accessorKey?: string;
  cell?: (info: any) => any;
  size?: number;
}

// Error handling
export interface AppError {
  code: string;
  message: string;
  details?: any;
} 