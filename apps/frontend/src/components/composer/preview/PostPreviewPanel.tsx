/**
 * Post Preview Panel
 * Live preview panel showing platform-specific post previews
 */

import { useState, useEffect } from 'react';
import { useComposerStore } from '@/store/composer.store';
import { useSocialAccountStore } from '@/store/social.store';
import { SocialPlatform } from '@/types/composer.types';
import { TwitterPreview } from './TwitterPreview';
import { LinkedInPreview } from './LinkedInPreview';
import { InstagramPreview } from './InstagramPreview';
import { FacebookPreview } from './FacebookPreview';

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  instagram: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)',
  facebook: '#1877F2',
};

const PLATFORM_NAMES: Record<SocialPlatform, string> = {
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
};

export function PostPreviewPanel() {
  const { mainContent, platformContent, media, selectedAccounts, contentType } = useComposerStore();
  const { accounts } = useSocialAccountStore();

  // Get unique platforms from selected accounts
  const selectedPlatforms = Array.from(
    new Set(
      accounts
        .filter((acc) => selectedAccounts.includes(acc._id))
        .map((acc) => acc.platform.toLowerCase() as SocialPlatform)
    )
  );

  const [activeTab, setActiveTab] = useState<SocialPlatform | null>(
    selectedPlatforms.length > 0 ? selectedPlatforms[0] : null
  );

  // Update active tab when platforms change
  useEffect(() => {
    if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(activeTab as SocialPlatform)) {
      setActiveTab(selectedPlatforms[0]);
    } else if (selectedPlatforms.length === 0) {
      setActiveTab(null);
    }
  }, [selectedPlatforms, activeTab]);

  // Get content for active platform
  const getContent = (platform: SocialPlatform) => {
    return platformContent[platform] || mainContent;
  };

  // Get account info for platform
  const getAccountInfo = (platform: SocialPlatform) => {
    const account = accounts.find(
      (acc) => selectedAccounts.includes(acc._id) && acc.platform.toLowerCase() === platform
    );
    return account;
  };

  if (selectedPlatforms.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium mb-2">No platforms selected</p>
          <p className="text-sm">Select accounts to see preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex gap-1 overflow-x-auto px-4">
          {selectedPlatforms.map((platform) => {
            const isActive = activeTab === platform;
            const color = PLATFORM_COLORS[platform];

            return (
              <button
                key={platform}
                onClick={() => setActiveTab(platform)}
                className={`
                  relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap
                  ${isActive ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}
                `}
              >
                {PLATFORM_NAMES[platform]}
                {isActive && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{
                      background: color.startsWith('linear') ? color : `${color}`,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="flex justify-center">
          {activeTab === 'twitter' && (
            <TwitterPreview
              content={getContent('twitter')}
              media={media}
              accountName={getAccountInfo('twitter')?.accountName}
              accountHandle={getAccountInfo('twitter')?.accountId}
              accountAvatar={getAccountInfo('twitter')?.metadata?.avatarUrl}
            />
          )}
          {activeTab === 'linkedin' && (
            <LinkedInPreview
              content={getContent('linkedin')}
              media={media}
              accountName={getAccountInfo('linkedin')?.accountName}
              accountAvatar={getAccountInfo('linkedin')?.metadata?.avatarUrl}
            />
          )}
          {activeTab === 'instagram' && (
            <InstagramPreview
              content={getContent('instagram')}
              media={media}
              accountUsername={getAccountInfo('instagram')?.accountId}
              accountAvatar={getAccountInfo('instagram')?.metadata?.avatarUrl}
              contentType={contentType}
            />
          )}
          {activeTab === 'facebook' && (
            <FacebookPreview
              content={getContent('facebook')}
              media={media}
              accountName={getAccountInfo('facebook')?.accountName}
              accountAvatar={getAccountInfo('facebook')?.metadata?.avatarUrl}
            />
          )}
        </div>
      </div>
    </div>
  );
}
