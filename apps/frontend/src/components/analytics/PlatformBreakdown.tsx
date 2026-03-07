interface PlatformBreakdownProps {
  data: Array<{
    platform: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * PlatformBreakdown Component
 * 
 * Shows distribution of posts across platforms
 * 
 * Features:
 * - Platform name with icon
 * - Post count
 * - Percentage bar
 * 
 * Performance:
 * - Simple CSS bars
 * - No external dependencies
 */
export function PlatformBreakdown({ data }: PlatformBreakdownProps) {
  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      TWITTER: '𝕏',
      FACEBOOK: '📘',
      INSTAGRAM: '📷',
      LINKEDIN: '💼',
      TIKTOK: '🎵',
      YOUTUBE: '📹',
    };
    
    return icons[platform.toUpperCase()] || '📱';
  };

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      TWITTER: 'bg-blue-500',
      FACEBOOK: 'bg-blue-600',
      INSTAGRAM: 'bg-pink-500',
      LINKEDIN: 'bg-blue-700',
      TIKTOK: 'bg-black',
      YOUTUBE: 'bg-red-600',
    };
    
    return colors[platform.toUpperCase()] || 'bg-gray-500';
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No platform data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.platform} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{getPlatformIcon(item.platform)}</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {item.platform}
              </span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {item.count} post{item.count !== 1 ? 's' : ''} ({Math.round(item.percentage)}%)
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getPlatformColor(item.platform)}`}
              style={{ width: `${item.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
