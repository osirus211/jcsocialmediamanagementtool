import { useState, useEffect } from 'react';
import { analyticsService, HashtagSuggestion } from '@/services/analytics.service';
import { useWorkspaceStore } from '@/store/workspace.store';
import { logger } from '@/lib/logger';

interface HashtagSuggestionsProps {
  onAddToComposer?: (hashtag: string) => void;
}

export function HashtagSuggestions({ onAddToComposer }: HashtagSuggestionsProps) {
  const { currentWorkspace } = useWorkspaceStore();
  const [suggestions, setSuggestions] = useState<HashtagSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedHashtag, setCopiedHashtag] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await analyticsService.getHashtagSuggestions(10);
        setSuggestions(data);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load hashtag suggestions';
        logger.error('Hashtag suggestions fetch error:', { error: err });
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentWorkspace]);

  const copyToClipboard = async (hashtag: string) => {
    try {
      await navigator.clipboard.writeText(hashtag);
      setCopiedHashtag(hashtag);
      setTimeout(() => setCopiedHashtag(null), 2000);
    } catch (err) {
      logger.error('Failed to copy hashtag:', { error: err });
    }
  };

  const handleAddToComposer = (hashtag: string) => {
    if (onAddToComposer) {
      onAddToComposer(hashtag);
    } else {
      // Fallback: copy to clipboard
      copyToClipboard(hashtag);
    }
  };

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Suggested Hashtags</h3>
        <div className="text-center py-4">
          <div className="text-red-600 mb-2">⚠️ Error loading suggestions</div>
          <div className="text-sm text-gray-500">{error}</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Suggested Hashtags</h3>
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded-full w-24"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Suggested Hashtags</h3>
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2 text-2xl">#️⃣</div>
          <div className="text-gray-600">No hashtag suggestions yet</div>
          <div className="text-sm text-gray-500 mt-1">
            Use hashtags in your posts to get performance-based suggestions
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Suggested Hashtags</h3>
        <div className="text-sm text-gray-500">
          Based on your best performing hashtags
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.hashtag}
            className="group relative bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-full px-4 py-2 hover:from-blue-100 hover:to-indigo-100 transition-all duration-200"
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard(suggestion.hashtag)}
                className="flex items-center gap-2 text-blue-700 hover:text-blue-900 font-medium"
                title="Click to copy"
              >
                <span>{suggestion.hashtag}</span>
                <span className="text-xs text-blue-600">
                  {suggestion.avgEngagementRate.toFixed(1)}%
                </span>
              </button>
              
              <div className="flex items-center gap-1">
                {copiedHashtag === suggestion.hashtag ? (
                  <span className="text-xs text-green-600 font-medium">✓ Copied!</span>
                ) : (
                  <>
                    <button
                      onClick={() => copyToClipboard(suggestion.hashtag)}
                      className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 text-xs p-1 rounded transition-opacity"
                      title="Copy to clipboard"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => handleAddToComposer(suggestion.hashtag)}
                      className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 text-xs p-1 rounded transition-opacity"
                      title="Add to composer"
                    >
                      ➕
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Tooltip with additional info */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              Used in {suggestion.postCount} post{suggestion.postCount !== 1 ? 's' : ''} • {suggestion.avgEngagementRate.toFixed(1)}% avg engagement
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-500">
        💡 Click any hashtag to copy it, or use the + button to add it to your composer
      </div>
    </div>
  );
}