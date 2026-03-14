import { SocialPlatform } from '@/types/composer.types';

interface PlatformTabsProps {
  platforms: SocialPlatform[];
  activeTab: SocialPlatform | null;
  onTabChange: (platform: SocialPlatform) => void;
  contentStatus: Record<SocialPlatform, 'default' | 'customized'>;
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
}: PlatformTabsProps) {
  if (platforms.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-gray-200 overflow-x-auto">
      <div className="flex gap-1 min-w-max" role="tablist" aria-label="Platform content tabs">
        {platforms.map((platform) => {
          const isActive = activeTab === platform;
          const isCustomized = contentStatus[platform] === 'customized';

          return (
            <button
              key={platform}
              onClick={() => onTabChange(platform)}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${platform}-content-panel`}
              aria-label={`${platformNames[platform]} content${isCustomized ? ' - customized' : ''}`}
              className={`
                flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap
                ${
                  isActive
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              <span className="text-lg">{platformIcons[platform]}</span>
              <span className="font-medium">{platformNames[platform]}</span>
              {isCustomized && (
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                  Custom
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
