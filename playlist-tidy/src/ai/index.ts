import OpenAI from 'openai';
import type { AIPayload, AIResult, Track, CatalogTrack, Mutation } from '../types';
import appleMusicAPI from '../lib/apple';

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Please set VITE_OPENAI_API_KEY in your .env file.');
    }
    openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }
  return openai;
}

// Function definitions for OpenAI
const functions = [
  {
    name: 'generate_playlist_names',
    description: 'Generate creative playlist names based on track analysis',
    parameters: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of creative playlist name suggestions'
        }
      },
      required: ['suggestions']
    }
  },
  {
    name: 'group_tracks',
    description: 'Group tracks into logical playlists based on genre, mood, or theme',
    parameters: {
      type: 'object',
      properties: {
        groups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Suggested name for the group' },
              trackIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of track IDs belonging to this group'
              },
              reason: { type: 'string', description: 'Explanation for the grouping' }
            },
            required: ['name', 'trackIds', 'reason']
          }
        }
      },
      required: ['groups']
    }
  },
  {
    name: 'recommend_tracks',
    description: 'Recommend similar tracks from Apple Music catalog',
    parameters: {
      type: 'object',
      properties: {
        searchTerms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Search terms to find similar tracks in Apple Music catalog'
        },
        reasoning: {
          type: 'string',
          description: 'Explanation of why these recommendations fit'
        }
      },
      required: ['searchTerms', 'reasoning']
    }
  }
];

export async function callAI(payload: AIPayload): Promise<AIResult> {
  try {
    const { mode, tracks, context } = payload;
    
    // Prepare track information for AI analysis
    const trackInfo = tracks.map(track => ({
      id: track.id,
      name: track.attributes.name,
      artist: track.attributes.artistName,
      album: track.attributes.albumName,
      duration: Math.floor(track.attributes.durationInMillis / 1000)
    }));

    let systemPrompt = '';
    let userPrompt = '';

    switch (mode) {
      case 'name':
        systemPrompt = `You are a creative music curator. Generate 5-8 unique, catchy playlist names based on the provided tracks. Consider genre, mood, themes, and lyrical content. Be creative but relevant.`;
        userPrompt = `Analyze these tracks and suggest creative playlist names:\n${JSON.stringify(trackInfo, null, 2)}${context ? `\n\nAdditional context: ${context}` : ''}`;
        break;

      case 'group':
        systemPrompt = `You are a music organization expert. Analyze the provided tracks and group them into logical playlists based on genre, mood, energy level, or thematic similarity. Each group should have 3+ tracks and a clear rationale.`;
        userPrompt = `Group these tracks into logical playlists:\n${JSON.stringify(trackInfo, null, 2)}${context ? `\n\nAdditional context: ${context}` : ''}`;
        break;

      case 'recommend':
        systemPrompt = `You are a music recommendation expert. Based on the provided tracks, suggest search terms that would find similar music in the Apple Music catalog. Focus on genre, style, mood, and artist similarities.`;
        userPrompt = `Based on these tracks, suggest search terms for finding similar music:\n${JSON.stringify(trackInfo, null, 2)}${context ? `\n\nAdditional context: ${context}` : ''}`;
        break;

      default:
        throw new Error(`Unknown AI mode: ${mode}`);
    }

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      functions,
      function_call: 'auto',
      temperature: 0.7,
      max_tokens: 1000
    });

    const message = response.choices[0]?.message;
    if (!message?.function_call) {
      throw new Error('No function call in AI response');
    }

    const functionName = message.function_call.name;
    const functionArgs = JSON.parse(message.function_call.arguments || '{}');

    return await processAIResponse(mode, functionName, functionArgs, tracks);
  } catch (error) {
    console.error('AI call failed:', error);
    throw new Error('Failed to process AI request');
  }
}

async function processAIResponse(
  _mode: string,
  functionName: string,
  args: any,
  originalTracks: Track[]
): Promise<AIResult> {
  switch (functionName) {
    case 'generate_playlist_names':
      return {
        suggestions: args.suggestions || []
      };

    case 'group_tracks':
      const mutations: Mutation[] = [];
      
      args.groups?.forEach((group: any, index: number) => {
        // Create a new playlist for each group
        mutations.push({
          op: 'create',
          playlistId: `temp-${Date.now()}-${index}`,
          name: group.name,
          tracks: originalTracks.filter(track => group.trackIds.includes(track.id))
        });
      });

      return { mutations };

    case 'recommend_tracks':
      const recommendations: CatalogTrack[] = [];
      
      // Search Apple Music catalog for each search term
      for (const searchTerm of args.searchTerms || []) {
        try {
          const results = await appleMusicAPI.searchCatalog(searchTerm, 5);
          recommendations.push(...results);
        } catch (error) {
          console.warn(`Failed to search for: ${searchTerm}`, error);
        }
      }

      // Remove duplicates and limit to 25 recommendations
      const uniqueRecommendations = recommendations
        .filter((track, index, self) => 
          self.findIndex(t => t.id === track.id) === index
        )
        .slice(0, 25);

      return { recommendations: uniqueRecommendations };

    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}

// Utility function to analyze tracks for AI context
export function analyzeTracksForContext(tracks: Track[]): string {
  if (tracks.length === 0) return '';

  const artists = [...new Set(tracks.map(t => t.attributes.artistName))];
  const albums = [...new Set(tracks.map(t => t.attributes.albumName))];
  const totalDuration = tracks.reduce((sum, t) => sum + t.attributes.durationInMillis, 0);
  const avgDuration = totalDuration / tracks.length / 1000 / 60; // minutes

  return `${tracks.length} tracks from ${artists.length} artists across ${albums.length} albums. Average track length: ${avgDuration.toFixed(1)} minutes.`;
}

// Batch AI operations for large playlists
export async function batchAIOperation(
  tracks: Track[],
  mode: 'name' | 'group' | 'recommend',
  batchSize: number = 50
): Promise<AIResult[]> {
  const results: AIResult[] = [];
  
  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);
    const context = `Batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(tracks.length / batchSize)}`;
    
    try {
      const result = await callAI({ mode, tracks: batch, context });
      results.push(result);
    } catch (error) {
      console.error(`Batch ${i / batchSize + 1} failed:`, error);
    }
  }
  
  return results;
} 