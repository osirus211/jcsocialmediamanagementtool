/**
 * Post Preview Panel
 * Live preview panel showing platform-specific post previews
 */

import { useState, useEffect, memo, useMemo, useCallback } from 'react';
import { useComposerStore } from '@/store/composer.store';
import { useSocialAccountStore } from '@/store/social.store';
import { SocialPlatform } from '@/types/composer.types';
import { TwitterPreview } from './TwitterPreview';
import { LinkedInPreview } from './LinkedInPreview';
import { InstagramPreview } from './InstagramPreview';
import { FacebookPreview } from './FacebookPreview';
import { ThreadsPreview } from './ThreadsPreview';
import { BlueskyPreview } from './BlueskyPreview';
import { YouTubePreview } from './YouTubePreview';
import { PinterestPreview } from './PinterestPreview';
import { TikTokPreview } from './TikTokPreview';
import { GoogleBusinessPreview } from './GoogleBusinessPreview';

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  instagram: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)',
  facebook: '#1877F2',
  threads: '#000000',
  bluesky: '#0085FF',
  youtube: '#FF0000',
  'google-business': '#4285F4',
  pinterest: '#E60023',
  tiktok: '#000000',
};

const PLATFORM_NAMES: Record<SocialPlatform, string> = {
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  threads: 'Threads',
  bluesky: 'Bluesky',
  youtube: 'YouTube',
  'google-business': 'Google Business',
  pinterest: 'Pinterest',
  tiktok: 'TikTok',
};

const PostPreviewPanel = memo(function PostPreviewPanel() {
  const { mainContent, platformContent, media, selectedAccounts, contentType } = useComposerStore();
  const { accounts } = useSocialAccountStore();

  // Get unique platforms from selected accounts
  const selectedPlatforms = useMemo(() => Array.from(
    new Set(
      accounts
        .filter((acc) => selectedAccounts.includes(acc._id))
        .map((acc) => acc.platform.toLowerCase() as SocialPlatform)
    )
  ), [accounts, selectedAccounts]);

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
  const getContent = useCallback((platform: SocialPlatform) => {
    return platformContent[platform] || mainContent;
  }, [platformContent, mainContent]);

  // Get account info for platform
  const getAccountInfo = useCallback((platform: SocialPlatform) => {
    const account = accounts.find(
      (acc) => selectedAccounts.includes(acc._id) && acc.platform.toLowerCase() === platform
    );
    return account;
  }, [accounts, selectedAccounts]);

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
          {activeTab === 'twitter' && contentType === 'thread' && (
            <div className="w-full max-w-[500px]">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  🧵 Thread Preview
                </h3>
                <div className="space-y-3">
                  {useComposerStore.getState().threadTweets.map((tweet, index) => (
                    <div key={tweet.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                          U
                        </div>
                        {index < useComposerStore.getState().threadTweets.length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-300 mt-2"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">Your Name</span>
                          <span className="text-gray-500 text-sm">@username</span>
                          <span className="text-gray-500 text-sm">·</span>
                          <span className="text-gray-500 text-sm">now</span>
                        </div>
                        <div className="text-gray-900 whitespace-pre-wrap break-words">
                          {useComposerStore.getState().threadOptions.autoNumbering && useComposerStore.getState().threadTweets.length > 1 && (
                            <span className="text-blue-600 font-medium">
                              {useComposerStore.getState().threadOptions.numberingStyle === '1/n' 
                                ? `${index + 1}/${useComposerStore.getState().threadTweets.length} `
                                : `${index + 1}. `
                              }
                            </span>
                          )}
                          {tweet.content || <span className="text-gray-400 italic">Empty tweet</span>}
                        </div>
                        {index < useComposerStore.getState().threadTweets.length - 1 && (
                          <div className="mt-2 text-blue-500 text-sm">
                            Show this thread
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'twitter' && contentType !== 'thread' && (
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
              contentType={contentType === 'thread' ? 'post' : contentType}
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
          {activeTab === 'threads' && (
            <ThreadsPreview
              content={getContent('threads')}
              media={media}
              accountUsername={getAccountInfo('threads')?.accountName}
              accountAvatar={getAccountInfo('threads')?.metadata?.avatarUrl}
            />
          )}
          {activeTab === 'bluesky' && (
            <BlueskyPreview
              content={getContent('bluesky')}
              media={media}
              accountHandle={getAccountInfo('bluesky')?.accountId}
              accountDisplayName={getAccountInfo('bluesky')?.accountName}
              accountAvatar={getAccountInfo('bluesky')?.metadata?.avatarUrl}
            />
          )}
          {activeTab === 'youtube' && (
            <YouTubePreview
              content={getContent('youtube')}
              media={media}
              channelName={getAccountInfo('youtube')?.accountName}
              channelAvatar={getAccountInfo('youtube')?.metadata?.avatarUrl}
            />
          )}
          {activeTab === 'pinterest' && (
            <PinterestPreview
              content={getContent('pinterest')}
              media={media}
              accountName={getAccountInfo('pinterest')?.accountName}
              accountAvatar={getAccountInfo('pinterest')?.metadata?.avatarUrl}
            />
          )}
          {activeTab === 'tiktok' && (
            <TikTokPreview
              content={getContent('tiktok')}
              media={media}
              accountUsername={getAccountInfo('tiktok')?.accountId}
              accountAvatar={getAccountInfo('tiktok')?.metadata?.avatarUrl}
            />
          )}
          {activeTab === 'google-business' && (
            <GoogleBusinessPreview
              content={getContent('google-business')}
              media={media}
              businessName={getAccountInfo('google-business')?.accountName}
              businessAvatar={getAccountInfo('google-business')?.metadata?.avatarUrl}
              businessAddress={getAccountInfo('google-business')?.metadata?.address}
              businessRating={getAccountInfo('google-business')?.metadata?.rating}
            />
          )}
        </div>
      </div>
    </div>
  );
});

export { PostPreviewPanel };
