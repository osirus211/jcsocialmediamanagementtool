import { SocialPlatform } from '@/types/composer.types';
import { Copy, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';

const PLATFORM_LIMITS: Record<SocialPlatform, number> = {
  twitter: 280,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
  threads: 500,
  bluesky: 300,
  youtube: 5000,
  'google-business': 1500,
  pinterest: 500,
  tiktok: 2200,
};

interface PlatformTabsProps {
  platforms: SocialPlatform[];
  activeTab: SocialPlatform | null;
  onTabChange: (platform: SocialPlatform) => void;
  contentStatus: Record<SocialPlatform, 'default' | 'customized'>;
  showActions?: boolean;
  onCopyFromBase?: () => void;
  onReset?: () => void;
  mainContent?: string;
  platformContent?: Record<SocialPlatform, string>;
}

const platformIcons: Record<SocialPlatform, string> = {
  twitter: '𝕏',
  linkedin: 'in',
  facebook: 'f',
  instagram: '📷',
  youtube: '▶️',
  threads: '@',
  bluesky: '🦋',
  'google-business': 'G',
  pinterest: 'P',
  tiktok: '🎵',
};

const platformNames: Record<SocialPlatform, string> = {
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  threads: 'Threads',
  bluesky: 'Bluesky',
  'google-business': 'Google Business',
  pinterest: 'Pinterest',
  tiktok: 'TikTok',
};

export function PlatformTabs({
  platforms,
  activeTab,
  onTabChange,
  contentStatus,
  showActions = false,
  onCopyFromBase,
  onReset,
  mainContent = '',
  platformContent = {} as Record<SocialPlatform, string>,
}: PlatformTabsProps) {
  if (platforms.length === 0) {
    return null;
  }

  const getContentStats = (platform: SocialPlatform) => {
    const content = platformContent[platform] || mainContent;
    const limit = PLATFORM_LIMITS[platform];
    const count = content.length;
    const isOverLimit = count > limit;
    const isValid = count > 0 && !isOverLimit;
    
    return { count, limit, isOverLimit, isValid };
  };

  return (
    <div className="space-y-2">
      <div className="border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-1 min-w-max" role="tablist" aria-label="Platform content tabs">
          {platforms.map((platform) => {
            const isActive = activeTab === platform;
            const isCustomized = contentStatus[platform] === 'customized';
            const stats = getContentStats(platform);

            return (
              <button
                key={platform}
                onClick={() => onTabChange(platform)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`${platform}-content-panel`}
                aria-label={`${platformNames[platform]} content${isCustomized ? ' - customized' : ''}`}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap relative
                  ${
                    isActive
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <span className="text-lg">{platformIcons[platform]}</span>
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{platformNames[platform]}</span>
                    {isCustomized && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded">
                        Modified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className={stats.isOverLimit ? 'text-red-600' : 'text-gray-500'}>
                      {stats.count}/{stats.limit}
                    </span>
                    {stats.isOverLimit ? (
                      <AlertCircle className="w-3 h-3 text-red-600" />
                    ) : stats.isValid ? (
                      <CheckCircle className="w-3 h-3 text-green-600" />
                    ) : null}
                  </div>
                </div>
                
                {/* Status indicator dot */}
                <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                  isCustomized ? 'bg-orange-500' : 'bg-gray-300'
                }`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Action buttons for active tab */}
      {showActions && activeTab && (
        <div className="flex items-center gap-2 px-2">
          <button
            type="button"
            onClick={onCopyFromBase}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            title="Copy content from main post"
          >
            <Copy className="w-3 h-3" />
            Copy from base
          </button>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            title="Reset to use main content"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
