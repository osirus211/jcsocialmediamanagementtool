import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';
import {
  CaptionGenerationInput,
  CaptionGenerationOutput,
  HashtagGenerationInput,
  HashtagGenerationOutput,
  RewriteInput,
  RewriteOutput,
  SuggestionInput,
  SuggestionOutput,
  AIResponse,
} from '@/types/ai.types';

interface AIState {
  isGenerating: boolean;
  lastGeneration: any | null;
}

interface AIActions {
  setGenerating: (generating: boolean) => void;
  generateCaption: (input: CaptionGenerationInput) => Promise<CaptionGenerationOutput>;
  generateHashtags: (input: HashtagGenerationInput) => Promise<HashtagGenerationOutput>;
  rewriteContent: (input: RewriteInput) => Promise<RewriteOutput>;
  improveContent: (content: string, platform?: string) => Promise<RewriteOutput>;
  generateSuggestions: (input: SuggestionInput) => Promise<SuggestionOutput>;
}

interface AIStore extends AIState, AIActions {}

/**
 * AI store
 * Manages AI-powered content generation
 */
export const useAIStore = create<AIStore>((set) => ({
  // Initial state
  isGenerating: false,
  lastGeneration: null,

  // Setters
  setGenerating: (generating) => set({ isGenerating: generating }),

  /**
   * Generate caption using AI
   */
  generateCaption: async (input: CaptionGenerationInput) => {
    try {
      set({ isGenerating: true });

      const response = await apiClient.post<AIResponse<CaptionGenerationOutput>>(
        '/ai/caption',
        input
      );

      set({ lastGeneration: response.data, isGenerating: false });
      return response.data;
    } catch (error: any) {
      set({ isGenerating: false });
      console.error('Generate caption error:', error);
      throw error;
    }
  },

  /**
   * Generate hashtags using AI
   */
  generateHashtags: async (input: HashtagGenerationInput) => {
    try {
      set({ isGenerating: true });

      const response = await apiClient.post<AIResponse<HashtagGenerationOutput>>(
        '/ai/hashtags',
        input
      );

      set({ lastGeneration: response.data, isGenerating: false });
      return response.data;
    } catch (error: any) {
      set({ isGenerating: false });
      console.error('Generate hashtags error:', error);
      throw error;
    }
  },

  /**
   * Rewrite content using AI
   */
  rewriteContent: async (input: RewriteInput) => {
    try {
      set({ isGenerating: true });

      const response = await apiClient.post<AIResponse<RewriteOutput>>(
        '/ai/rewrite',
        input
      );

      set({ lastGeneration: response.data, isGenerating: false });
      return response.data;
    } catch (error: any) {
      set({ isGenerating: false });
      console.error('Rewrite content error:', error);
      throw error;
    }
  },

  /**
   * Improve content using AI
   */
  improveContent: async (content: string, platform?: string) => {
    try {
      set({ isGenerating: true });

      const response = await apiClient.post<AIResponse<RewriteOutput>>(
        '/ai/improve',
        { content, platform }
      );

      set({ lastGeneration: response.data, isGenerating: false });
      return response.data;
    } catch (error: any) {
      set({ isGenerating: false });
      console.error('Improve content error:', error);
      throw error;
    }
  },

  /**
   * Generate suggestions using AI
   */
  generateSuggestions: async (input: SuggestionInput) => {
    try {
      set({ isGenerating: true });

      const response = await apiClient.post<AIResponse<SuggestionOutput>>(
        '/ai/suggestions',
        input
      );

      set({ lastGeneration: response.data, isGenerating: false });
      return response.data;
    } catch (error: any) {
      set({ isGenerating: false });
      console.error('Generate suggestions error:', error);
      throw error;
    }
  },
}));
