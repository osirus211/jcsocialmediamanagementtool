import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, TrendingUp, Calendar } from 'lucide-react';
import { analyticsService, TimingSuggestion } from '@/services/analytics.service';
import { useWorkspaceStore } from '@/store/workspace.store';
import { logger } from '@/lib/logger';

interface OptimalTimeSuggestionsProps {
  selectedPlatform?: string;
}

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '🐦',
  facebook: '📘',
  instagram: '📷',
  linkedin: '💼',
  tiktok: '🎵',
  threads: '@',
  bluesky: '🦋',
  all: '📊'
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'bg-blue-500',
  facebook: 'bg-blue-600',
  instagram: 'bg-pink-500',
  linkedin: 'bg-blue-700',
  tiktok: 'bg-black',
  threads: 'bg-black',
  bluesky: 'bg-sky-500',
  all: 'bg-gray-500'
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function OptimalTimeSuggestions({ selectedPlatform }: OptimalTimeSuggestionsProps) {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const [suggestions, setSuggestions] = useState<TimingSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchSuggestions = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await analyticsService.getBestTimes(selectedPlatform, currentWorkspace._id);
        setSuggestions(response.suggestions);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load suggestions';
        logger.error('Failed to fetch timing suggestions', { error: errorMessage });
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [selectedPlatform, currentWorkspace]);

  const formatTime = (hour: number): string => {
    if (hour === 0) return '12:00 AM';
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
  };

  const handleScheduleAtTime = (suggestion: TimingSuggestion) => {
    // Calculate next occurrence of this day/time
    const now = new Date();
    const targetDate = new Date();
    
    // Find next occurrence of the target day
    const currentDay = now.getDay();
    const targetDay = suggestion.dayOfWeek;
    const daysUntilTarget = (targetDay - currentDay + 7) % 7;
    
    if (daysUntilTarget === 0) {
      // Same day - check if time has passed
      if (now.getHours() >= suggestion.hour) {
        // Time has passed, schedule for next week
        targetDate.setDate(now.getDate() + 7);
      }
    } else {
      targetDate.setDate(now.getDate() + daysUntilTarget);
    }
    
    targetDate.setHours(suggestion.hour, 0, 0, 0);
    
    // Navigate to composer with pre-filled scheduled time
    const scheduledAt = targetDate.toISOString();
    navigate(`/posts/create?scheduledAt=${scheduledAt}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-3 bg-gray-200 rounded w-48"></div>
                </div>
              </div>
              <div className="w-24 h-8 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-2">Failed to load suggestions</p>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-2">🤖</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No AI suggestions yet</h3>
        <p className="text-gray-500">
          Publish more posts to get personalized timing recommendations
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        AI-powered recommendations based on your posting history
      </div>
      
      {suggestions.map((suggestion, index) => (
        <div
          key={`${suggestion.platform}-${suggestion.dayOfWeek}-${suggestion.hour}`}
          className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow relative"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Platform Icon */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${
                PLATFORM_COLORS[suggestion.platform] || PLATFORM_COLORS.all
              }`}>
                <span className="text-lg">
                  {PLATFORM_ICONS[suggestion.platform] || PLATFORM_ICONS.all}
                </span>
              </div>
              
              {/* Time and Details */}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="font-medium text-gray-900">
                    {DAYS[suggestion.dayOfWeek]} at {formatTime(suggestion.hour)}
                  </span>
                </div>
                
                <div className="flex items-center space-x-4">
                  {/* Score Bar */}
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-3 w-3 text-gray-400" />
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all duration-300"
                        style={{ width: `${suggestion.score}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{suggestion.score}%</span>
                  </div>
                  
                  {/* Reason */}
                  <span className="text-sm text-gray-600">{suggestion.reason}</span>
                </div>
              </div>
            </div>
            
            {/* Schedule Button */}
            <button
              onClick={() => handleScheduleAtTime(suggestion)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Clock className="h-4 w-4" />
              <span>Schedule</span>
            </button>
          </div>
          
          {/* Rank Badge */}
          {index === 0 && (
            <div className="absolute -top-2 -left-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">
              #1 Best
            </div>
          )}
        </div>
      ))}
    </div>
  );
}