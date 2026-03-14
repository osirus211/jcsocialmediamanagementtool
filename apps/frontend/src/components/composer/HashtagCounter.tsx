import React from 'react';
import { Hash, AlertTriangle } from 'lucide-react';

interface HashtagCounterProps {
  hashtags: string[];
  platform: string;
  className?: string;
}

const HashtagCounter: React.FC<HashtagCounterProps> = ({ 
  hashtags, 
  platform, 
  className = '' 
}) => {
  // Platform-specific hashtag limits
  const getHashtagLimit = (platform: string): number => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return 30;
      case 'tiktok':
        return 30;
      case 'twitter':
      case 'x':
        return 10; // Practical limit for readability
      case 'linkedin':
        return 10;
      case 'facebook':
        return 10;
      default:
        return 30;
    }
  };

  const limit = getHashtagLimit(platform);
  const count = hashtags.length;
  const percentage = (count / limit) * 100;

  // Determine color based on usage
  const getColorClass = (): string => {
    if (percentage >= 100) {
      return 'text-red-600 bg-red-50 border-red-200';
    } else if (percentage >= 80) {
      return 'text-orange-600 bg-orange-50 border-orange-200';
    } else if (percentage >= 60) {
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    } else {
      return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getProgressBarColor = (): string => {
    if (percentage >= 100) {
      return 'bg-red-500';
    } else if (percentage >= 80) {
      return 'bg-orange-500';
    } else if (percentage >= 60) {
      return 'bg-yellow-500';
    } else {
      return 'bg-green-500';
    }
  };

  const getStatusText = (): string => {
    if (count >= limit) {
      return 'Limit reached';
    } else if (percentage >= 80) {
      return 'Approaching limit';
    } else {
      return 'Good';
    }
  };

  const getPlatformDisplayName = (platform: string): string => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return 'Instagram';
      case 'tiktok':
        return 'TikTok';
      case 'twitter':
      case 'x':
        return 'X/Twitter';
      case 'linkedin':
        return 'LinkedIn';
      case 'facebook':
        return 'Facebook';
      default:
        return platform;
    }
  };

  return (
    <div className={`hashtag-counter ${className}`}>
      <div className={`flex items-center justify-between p-3 rounded-lg border ${getColorClass()}`}>
        <div className="flex items-center gap-2">
          <Hash size={16} />
          <span className="font-medium">
            {count}/{limit}
          </span>
          <span className="text-sm opacity-75">
            hashtags for {getPlatformDisplayName(platform)}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {count >= limit && (
            <AlertTriangle size={16} className="text-red-600" />
          )}
          <span className="text-sm font-medium">
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        
        {/* Percentage indicator */}
        <div className="flex justify-between items-center mt-1 text-xs text-gray-600">
          <span>0</span>
          <span className="font-medium">
            {Math.round(percentage)}%
          </span>
          <span>{limit}</span>
        </div>
      </div>

      {/* Warning message when at or near limit */}
      {count >= limit && (
        <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-red-700 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>
              You've reached the {limit} hashtag limit for {getPlatformDisplayName(platform)}. 
              Remove some hashtags to add new ones.
            </span>
          </div>
        </div>
      )}

      {percentage >= 80 && count < limit && (
        <div className="mt-2 p-2 bg-orange-100 border border-orange-200 rounded text-orange-700 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>
              You're approaching the hashtag limit. You can add {limit - count} more hashtag{limit - count !== 1 ? 's' : ''}.
            </span>
          </div>
        </div>
      )}

      {/* Platform-specific tips */}
      {count > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          <div className="flex items-start gap-1">
            <span>💡</span>
            <div>
              {platform.toLowerCase() === 'instagram' && (
                <span>
                  Instagram allows up to 30 hashtags, but 5-10 relevant hashtags often perform better.
                </span>
              )}
              {(platform.toLowerCase() === 'twitter' || platform.toLowerCase() === 'x') && (
                <span>
                  Keep hashtags minimal on X/Twitter. 1-2 relevant hashtags work best for engagement.
                </span>
              )}
              {platform.toLowerCase() === 'tiktok' && (
                <span>
                  TikTok allows up to 30 hashtags. Mix trending and niche hashtags for best reach.
                </span>
              )}
              {platform.toLowerCase() === 'linkedin' && (
                <span>
                  LinkedIn posts perform well with 3-5 professional, industry-relevant hashtags.
                </span>
              )}
              {platform.toLowerCase() === 'facebook' && (
                <span>
                  Facebook hashtags are less important. Use 1-3 hashtags sparingly for best results.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HashtagCounter;