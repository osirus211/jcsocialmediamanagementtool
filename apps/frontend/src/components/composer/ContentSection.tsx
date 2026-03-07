import { SocialPlatform, PLATFORM_LIMITS } from '@/types/composer.types';
import { PlatformTabs } from './PlatformTabs';
import { useState } from 'react';

interface ContentSectionProps {
  platforms: SocialPlatform[];
  mainContent: string;
  platformContent: Record<SocialPlatform, string>;
  onContentChange: (platform: SocialPlatform | 'main', content: string) => void;
}

export function ContentSection({
  platforms,
  mainContent,
  platformContent,
  onContentChange,
}: ContentSectionProps) {
  const [activePlatform, setActivePlatform] = useState<SocialPlatform | null>(
    platforms.length > 0 ? platforms[0] : null
  );
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  // Determine content status for each platform
  const contentStatus = platforms.reduce((acc, platform) => {
    acc[platform] = platformContent[platform]?.trim() ? 'customized' : 'default';
    return acc;
  }, {} as Record<SocialPlatform, 'default' | 'customized'>);

  // Get current content based on active platform
  const getCurrentContent = () => {
    if (!activePlatform) return mainContent;
    return platformContent[activePlatform] || mainContent;
  };

  // Get character limit for active platform
  const getCharacterLimit = () => {
    if (!activePlatform) return 280; // Default
    return PLATFORM_LIMITS[activePlatform];
  };

  const currentContent = getCurrentContent();
  const maxLength = getCharacterLimit();
  const characterCount = currentContent.length;
  const isOverLimit = characterCount > maxLength;

  const handleContentChange = (content: string) => {
    if (activePlatform) {
      onContentChange(activePlatform, content);
    } else {
      onContentChange('main', content);
    }
  };

  return (
    <div className="space-y-4">
      {/* Platform Tabs */}
      {platforms.length > 0 && (
        <PlatformTabs
          platforms={platforms}
          activeTab={activePlatform}
          onTabChange={setActivePlatform}
          contentStatus={contentStatus}
        />
      )}

      {/* Content Editor */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              {activePlatform
                ? `${activePlatform.charAt(0).toUpperCase() + activePlatform.slice(1)} Content`
                : 'Post Content'}
            </label>
            <button
              type="button"
              onClick={() => setShowAIAssistant(!showAIAssistant)}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all"
            >
              ✨ AI Assistant
            </button>
          </div>

          <textarea
            id="post-content"
            value={currentContent}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={
              activePlatform && !platformContent[activePlatform]
                ? `Customize content for ${activePlatform} or use main content...`
                : "What's on your mind?"
            }
            rows={6}
            aria-label={
              activePlatform
                ? `${activePlatform.charAt(0).toUpperCase() + activePlatform.slice(1)} post content`
                : 'Post content'
            }
            aria-describedby="character-count"
            aria-invalid={isOverLimit}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
              isOverLimit ? 'border-red-500' : ''
            }`}
          />
          
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">
              {activePlatform && !platformContent[activePlatform] && (
                <span className="text-blue-600">Using main content</span>
              )}
            </span>
            <span
              id="character-count"
              role="status"
              aria-live="polite"
              className={`text-sm ${
                isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'
              }`}
            >
              {characterCount} / {maxLength}
              {isOverLimit && (
                <span className="ml-2 text-xs">
                  ({characterCount - maxLength} over limit)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* AI Assistant Panel - Placeholder for now */}
        {showAIAssistant && (
          <div className="border rounded-lg p-4 bg-gradient-to-br from-purple-50 to-blue-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                ✨ AI Assistant
              </h3>
              <button
                onClick={() => setShowAIAssistant(false)}
                className="text-gray-400 hover:text-gray-600 self-end sm:self-auto"
                aria-label="Close AI Assistant"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600">
              AI Assistant integration coming soon. This will help you generate, improve, and optimize your content.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
