import { useState, memo, useCallback, useEffect } from 'react';
import { Clock, TrendingUp, Zap, Calendar } from 'lucide-react';
import { SocialPlatform } from '@/types/composer.types';

interface OptimalTime {
  hour: number;
  minute: number;
  score: number;
  engagement: string;
}

interface OptimalTimeSuggestionsProps {
  selectedPlatforms: SocialPlatform[];
  onTimeSelect: (date: Date) => void;
  currentScheduledDate?: Date;
}

// Mock optimal times data - in real app, this would come from analytics API
const OPTIMAL_TIMES: Record<SocialPlatform, OptimalTime[]> = {
  twitter: [
    { hour: 9, minute: 0, score: 95, engagement: 'Peak' },
    { hour: 12, minute: 0, score: 88, engagement: 'High' },
    { hour: 15, minute: 0, score: 82, engagement: 'High' },
    { hour: 18, minute: 0, score: 76, engagement: 'Good' },
  ],
  linkedin: [
    { hour: 8, minute: 0, score: 92, engagement: 'Peak' },
    { hour: 12, minute: 0, score: 85, engagement: 'High' },
    { hour: 17, minute: 0, score: 78, engagement: 'Good' },
  ],
  instagram: [
    { hour: 11, minute: 0, score: 90, engagement: 'Peak' },
    { hour: 14, minute: 0, score: 84, engagement: 'High' },
    { hour: 19, minute: 0, score: 79, engagement: 'Good' },
  ],
  facebook: [
    { hour: 9, minute: 0, score: 87, engagement: 'High' },
    { hour: 13, minute: 0, score: 83, engagement: 'High' },
    { hour: 15, minute: 0, score: 77, engagement: 'Good' },
  ],
  threads: [
    { hour: 10, minute: 0, score: 89, engagement: 'Peak' },
    { hour: 14, minute: 0, score: 81, engagement: 'High' },
    { hour: 20, minute: 0, score: 75, engagement: 'Good' },
  ],
  bluesky: [
    { hour: 9, minute: 30, score: 86, engagement: 'High' },
    { hour: 16, minute: 0, score: 80, engagement: 'Good' },
  ],
  youtube: [
    { hour: 14, minute: 0, score: 91, engagement: 'Peak' },
    { hour: 18, minute: 0, score: 85, engagement: 'High' },
    { hour: 20, minute: 0, score: 79, engagement: 'Good' },
  ],
  'google-business': [
    { hour: 10, minute: 0, score: 88, engagement: 'High' },
    { hour: 14, minute: 0, score: 82, engagement: 'High' },
  ],
  pinterest: [
    { hour: 20, minute: 0, score: 93, engagement: 'Peak' },
    { hour: 11, minute: 0, score: 87, engagement: 'High' },
  ],
};

const OptimalTimeSuggestions = memo(function OptimalTimeSuggestions({
  selectedPlatforms,
  onTimeSelect,
  currentScheduledDate,
}: OptimalTimeSuggestionsProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Initialize with tomorrow's date
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  // Get combined optimal times across all platforms
  const getCombinedOptimalTimes = useCallback(() => {
    const timeMap = new Map<string, { score: number; count: number; platforms: string[] }>();

    selectedPlatforms.forEach(platform => {
      const times = OPTIMAL_TIMES[platform] || [];
      times.forEach(time => {
        const key = `${time.hour}:${time.minute.toString().padStart(2, '0')}`;
        const existing = timeMap.get(key);
        
        if (existing) {
          existing.score += time.score;
          existing.count += 1;
          existing.platforms.push(platform);
        } else {
          timeMap.set(key, {
            score: time.score,
            count: 1,
            platforms: [platform],
          });
        }
      });
    });

    // Calculate average scores and sort by effectiveness
    return Array.from(timeMap.entries())
      .map(([time, data]) => ({
        time,
        hour: parseInt(time.split(':')[0]),
        minute: parseInt(time.split(':')[1]),
        averageScore: Math.round(data.score / data.count),
        platformCount: data.count,
        platforms: data.platforms,
      }))
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 6); // Top 6 times
  }, [selectedPlatforms]);

  const optimalTimes = getCombinedOptimalTimes();

  const handleTimeSelect = useCallback((hour: number, minute: number) => {
    if (!selectedDate) return;

    const date = new Date(selectedDate);
    date.setHours(hour, minute, 0, 0);
    
    // Ensure it's in the future
    if (date <= new Date()) {
      date.setDate(date.getDate() + 1);
    }
    
    onTimeSelect(date);
  }, [selectedDate, onTimeSelect]);

  const formatTime = (hour: number, minute: number) => {
    const date = new Date();
    date.setHours(hour, minute);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const getEngagementLevel = (score: number) => {
    if (score >= 90) return { label: 'Peak', color: 'text-green-600 bg-green-100' };
    if (score >= 80) return { label: 'High', color: 'text-blue-600 bg-blue-100' };
    if (score >= 70) return { label: 'Good', color: 'text-yellow-600 bg-yellow-100' };
    return { label: 'Low', color: 'text-gray-600 bg-gray-100' };
  };

  // Generate heatmap data for visualization
  const generateHeatmapData = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    return days.map(day => ({
      day,
      hours: hours.map(hour => {
        // Mock engagement data - in real app, this would come from analytics
        const baseScore = Math.random() * 100;
        const isOptimal = optimalTimes.some(t => t.hour === hour);
        const score = isOptimal ? Math.max(baseScore, 80) : baseScore;
        
        return {
          hour,
          score: Math.round(score),
        };
      }),
    }));
  };

  const heatmapData = generateHeatmapData();

  if (selectedPlatforms.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-medium text-gray-700">Optimal Posting Times</span>
        </div>
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className="text-xs text-purple-600 hover:text-purple-700"
        >
          {showHeatmap ? 'Hide Heatmap' : 'Show Heatmap'}
        </button>
      </div>

      {/* Date Selector */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-gray-500" />
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Optimal Times Grid */}
      <div className="grid grid-cols-2 gap-2">
        {optimalTimes.map(({ time, hour, minute, averageScore, platformCount, platforms }) => {
          const engagement = getEngagementLevel(averageScore);
          
          return (
            <button
              key={time}
              onClick={() => handleTimeSelect(hour, minute)}
              className="p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-900">
                  {formatTime(hour, minute)}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${engagement.color}`}>
                  {engagement.label}
                </span>
              </div>
              
              <div className="text-xs text-gray-600 mb-1">
                Score: {averageScore}/100
              </div>
              
              <div className="text-xs text-gray-500">
                {platformCount} platform{platformCount > 1 ? 's' : ''}
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            const bestTime = optimalTimes[0];
            if (bestTime) {
              handleTimeSelect(bestTime.hour, bestTime.minute);
            }
          }}
          disabled={optimalTimes.length === 0}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap className="h-4 w-4" />
          Use Best Time
        </button>
      </div>

      {/* Engagement Heatmap */}
      {showHeatmap && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Weekly Engagement Heatmap</h4>
          
          <div className="space-y-1">
            {/* Hour labels */}
            <div className="flex">
              <div className="w-8"></div>
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="w-4 text-xs text-gray-500 text-center">
                  {i % 6 === 0 ? i : ''}
                </div>
              ))}
            </div>
            
            {/* Heatmap rows */}
            {heatmapData.map(({ day, hours }) => (
              <div key={day} className="flex items-center">
                <div className="w-8 text-xs text-gray-600">{day}</div>
                {hours.map(({ hour, score }) => {
                  const intensity = Math.round((score / 100) * 4);
                  const colors = [
                    'bg-gray-100',
                    'bg-purple-200',
                    'bg-purple-400',
                    'bg-purple-600',
                    'bg-purple-800',
                  ];
                  
                  return (
                    <div
                      key={hour}
                      className={`w-4 h-4 ${colors[intensity]} border border-white`}
                      title={`${day} ${hour}:00 - ${score}% engagement`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <span>Less engagement</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`w-3 h-3 ${
                    ['bg-gray-100', 'bg-purple-200', 'bg-purple-400', 'bg-purple-600', 'bg-purple-800'][i]
                  } border border-white`}
                />
              ))}
            </div>
            <span>More engagement</span>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="p-3 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-1">Timing Tips:</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Times shown are based on your audience's activity patterns</li>
          <li>• Consider your audience's timezone when scheduling</li>
          <li>• Consistency matters more than perfect timing</li>
          <li>• Test different times to find what works best for your content</li>
        </ul>
      </div>
    </div>
  );
});

export { OptimalTimeSuggestions };