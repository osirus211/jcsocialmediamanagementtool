import { SocialPlatform, PLATFORM_LIMITS } from '@/types/composer.types';
import { PlatformTabs } from './PlatformTabs';
import { EmojiPicker } from './EmojiPicker';
import { MentionAutocomplete } from './MentionAutocomplete';
import { LinkPreviewCard } from './LinkPreviewCard';
import { PlatformSpecificSettings } from './PlatformSpecificSettings';
import { EnhancedCharacterCounter } from './EnhancedCharacterCounter';
import { TwitterCharacterOptimizer } from './TwitterCharacterOptimizer';
import { EnhancedTwitterThreadComposer } from './EnhancedTwitterThreadComposer';
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete';
import { useLinkPreview } from '@/hooks/useLinkPreview';
import { getSuggestedAdaptations } from '@/utils/contentAdaptation';
import { useComposerStore } from '@/store/composer.store';
import { getPlatformCharacterCount, getPlatformLimit, getCharacterStatus } from '@/utils/characterCount';
import { useState, useRef, useCallback } from 'react';
import { Smile, Wand2, Settings, Copy, RotateCcw } from 'lucide-react';

interface ContentSectionProps {
  platforms: SocialPlatform[];
  mainContent: string;
  platformContent: Record<SocialPlatform, string>;
  onContentChange: (platform: SocialPlatform | 'main', content: string) => void;
  onAutoAdapt?: () => void;
}

export function ContentSection({
  platforms,
  mainContent,
  platformContent,
  onContentChange,
  onAutoAdapt,
}: ContentSectionProps) {
  const enablePlatformCustomization = useComposerStore(state => state.enablePlatformCustomization);
  const setEnablePlatformCustomization = useComposerStore(state => state.setEnablePlatformCustomization);
  const copyFromBaseContent = useComposerStore(state => state.copyFromBaseContent);
  const resetPlatformContent = useComposerStore(state => state.resetPlatformContent);
  const contentType = useComposerStore(state => state.contentType);
  const threadTweets = useComposerStore(state => state.threadTweets);
  const threadOptions = useComposerStore(state => state.threadOptions);
  const setThreadTweets = useComposerStore(state => state.setThreadTweets);
  const setThreadOptions = useComposerStore(state => state.setThreadOptions);
  
  const [activePlatform, setActivePlatform] = useState<SocialPlatform | null>(
    platforms.length > 0 ? platforms[0] : null
  );
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mention autocomplete
  const mentions = useMentionAutocomplete({
    textareaRef,
    selectedPlatforms: platforms,
    onMentionInsert: (mention, start, end) => {
      const currentContent = getCurrentContent();
      const newContent = currentContent.slice(0, start) + mention + currentContent.slice(end);
      handleContentChange(newContent);
    },
  });

  // Get current content based on active platform
  const getCurrentContent = () => {
    if (!enablePlatformCustomization || !activePlatform) return mainContent;
    return platformContent[activePlatform] || mainContent;
  };

  // Link previews
  const linkPreviews = useLinkPreview({
    content: getCurrentContent(),
    enabled: true,
  });

  // Determine content status for each platform
  const contentStatus = platforms.reduce((acc, platform) => {
    if (!enablePlatformCustomization) {
      acc[platform] = 'default';
    } else {
      acc[platform] = platformContent[platform]?.trim() && platformContent[platform] !== mainContent ? 'customized' : 'default';
    }
    return acc;
  }, {} as Record<SocialPlatform, 'default' | 'customized'>);

  // Get character limit for active platform
  const getCharacterLimit = () => {
    if (!enablePlatformCustomization || !activePlatform) return getPlatformLimit('twitter'); // Default
    return getPlatformLimit(activePlatform);
  };

  const currentContent = getCurrentContent();
  const maxLength = getCharacterLimit();
  const characterCount = getPlatformCharacterCount(
    currentContent, 
    enablePlatformCustomization && activePlatform ? activePlatform : 'twitter'
  );
  const isOverLimit = characterCount > maxLength;
  const characterStatus = getCharacterStatus(characterCount, maxLength);

  const handleContentChange = (content: string) => {
    if (enablePlatformCustomization && activePlatform) {
      onContentChange(activePlatform, content);
    } else {
      onContentChange('main', content);
    }
    
    // Update mention autocomplete
    const textarea = textareaRef.current;
    if (textarea) {
      mentions.handleTextareaInput(content, textarea.selectionStart);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = getCurrentContent();
    const newContent = currentContent.slice(0, start) + emoji + currentContent.slice(end);
    
    handleContentChange(newContent);
    
    // Restore cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention navigation first
    if (mentions.handleKeyDown(e)) {
      return;
    }
    
    // Open emoji picker with : shortcut
    if (e.key === ':' && e.ctrlKey) {
      e.preventDefault();
      setShowEmojiPicker(true);
    }
  };

  const handleAutoAdapt = () => {
    if (!mainContent.trim()) return;
    
    const adaptations = getSuggestedAdaptations(mainContent, platforms);
    
    // Apply adaptations to each platform
    platforms.forEach(platform => {
      if (adaptations[platform] && adaptations[platform] !== mainContent) {
        onContentChange(platform, adaptations[platform]);
      }
    });
  };

  const handleCopyFromBase = useCallback(() => {
    if (activePlatform) {
      copyFromBaseContent(activePlatform);
    }
  }, [activePlatform, copyFromBaseContent]);

  const handleResetPlatform = useCallback(() => {
    if (activePlatform) {
      resetPlatformContent(activePlatform);
    }
  }, [activePlatform, resetPlatformContent]);

  const handleToggleCustomization = useCallback((enabled: boolean) => {
    setEnablePlatformCustomization(enabled);
    if (enabled && platforms.length > 0 && mainContent.trim()) {
      // Auto-adapt content for each platform
      const adaptations = getSuggestedAdaptations(mainContent, platforms);
      
      platforms.forEach(platform => {
        if (adaptations[platform]) {
          onContentChange(platform, adaptations[platform]);
        }
      });
      
      // Show toast notification
      onAutoAdapt?.();
    }
  }, [setEnablePlatformCustomization, platforms, mainContent, onContentChange, onAutoAdapt]);

  return (
    <div className="space-y-4">
      {/* Platform Customization Toggle */}
      {platforms.length > 1 && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-gray-600" />
            <div>
              <label htmlFor="platform-customization" className="text-sm font-medium text-gray-900">
                Customize content per platform
              </label>
              <p className="text-xs text-gray-600">
                Create different content for each social media platform
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="platform-customization"
              type="checkbox"
              checked={enablePlatformCustomization}
              onChange={(e) => handleToggleCustomization(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      )}

      {/* Platform Tabs */}
      {platforms.length > 0 && enablePlatformCustomization && (
        <PlatformTabs
          platforms={platforms}
          activeTab={activePlatform}
          onTabChange={setActivePlatform}
          contentStatus={contentStatus}
          showActions={true}
          onCopyFromBase={handleCopyFromBase}
          onReset={handleResetPlatform}
          mainContent={mainContent}
          platformContent={platformContent}
        />
      )}

      {/* Content Editor */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              {enablePlatformCustomization && activePlatform
                ? `${activePlatform.charAt(0).toUpperCase() + activePlatform.slice(1)} Content`
                : 'Post Content'}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                title="Add emoji (Ctrl+:)"
              >
                <Smile className="h-4 w-4" />
              </button>
              {platforms.length > 1 && mainContent.trim() && !enablePlatformCustomization && (
                <button
                  type="button"
                  onClick={handleAutoAdapt}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-purple-600 hover:text-purple-700 border border-purple-300 rounded hover:bg-purple-50 transition-colors"
                  title="Auto-adapt content for each platform"
                >
                  <Wand2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Auto-adapt</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowAIAssistant(!showAIAssistant)}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all"
              >
                ✨ AI Assistant
              </button>
            </div>
          </div>

          {/* Thread Composer or Regular Content Editor */}
          {contentType === 'thread' ? (
            <EnhancedTwitterThreadComposer
              onThreadChange={setThreadTweets}
              onOptionsChange={setThreadOptions}
              selectedPlatforms={platforms}
            />
          ) : (
            <div className="relative">
              <textarea
                ref={textareaRef}
                id="post-content"
                value={currentContent}
                onChange={(e) => handleContentChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  enablePlatformCustomization && activePlatform && !platformContent[activePlatform]
                    ? `Customize content for ${activePlatform} or use main content...`
                    : "What's on your mind?"
                }
                rows={6}
                aria-label={
                  enablePlatformCustomization && activePlatform
                    ? `${activePlatform.charAt(0).toUpperCase() + activePlatform.slice(1)} post content`
                    : 'Post content'
                }
                aria-describedby="character-count"
                aria-invalid={isOverLimit}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                  isOverLimit ? 'border-red-500' : ''
                }`}
              />
              
              {/* Emoji Picker */}
              <EmojiPicker
                isOpen={showEmojiPicker}
                onEmojiSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
              
              {/* Mention Autocomplete */}
              <MentionAutocomplete
                isOpen={mentions.isOpen}
                suggestions={mentions.suggestions}
                selectedIndex={mentions.selectedIndex}
                position={mentions.position}
                onSelect={mentions.handleMentionSelect}
                onClose={mentions.closeMentions}
              />
            </div>
          )}
          
          {/* Link Previews - Only for non-thread content */}
          {contentType !== 'thread' && linkPreviews.previews.length > 0 && (
            <div className="space-y-3 mt-4">
              {linkPreviews.previews.map(({ url, preview, isLoading }) => (
                <LinkPreviewCard
                  key={url}
                  preview={preview || { url }}
                  isLoading={isLoading}
                  onRemove={() => linkPreviews.removePreview(url)}
                  onRefresh={() => linkPreviews.refreshPreview(url)}
                  onCustomImageUpload={(file) => linkPreviews.uploadCustomImage(url, file)}
                  onUrlUpdate={(newUrl) => linkPreviews.updateUrl(url, newUrl)}
                />
              ))}
            </div>
          )}
          
          {/* Character Counter and Optimizer - Only for non-thread content */}
          {contentType !== 'thread' && (
            <>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500">
                  {enablePlatformCustomization && activePlatform && !platformContent[activePlatform] && (
                    <span className="text-blue-600">Using main content</span>
                  )}
                </span>
                
                {/* Enhanced Character Counter */}
                <EnhancedCharacterCounter
                  content={currentContent}
                  platforms={enablePlatformCustomization && activePlatform ? [activePlatform] : platforms}
                  activePlatform={activePlatform}
                  showMultiPlatform={!enablePlatformCustomization && platforms.length > 1}
                  className="flex-shrink-0"
                />
              </div>
              
              {/* Twitter Character Optimizer */}
              {((enablePlatformCustomization && activePlatform === 'twitter') || 
                (!enablePlatformCustomization && platforms.includes('twitter'))) && 
               (characterStatus.severity === 'warning' || characterStatus.severity === 'error') && (
                <TwitterCharacterOptimizer
                  content={currentContent}
                  onContentChange={handleContentChange}
                  characterLimit={maxLength}
                />
              )}
            </>
          )}
        </div>

        {/* Platform-Specific Settings */}
        {enablePlatformCustomization && activePlatform && (
          <PlatformSpecificSettings platform={activePlatform} />
        )}

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
