import { SocialPlatform, PLATFORM_LIMITS } from '@/types/composer.types';
import { PlatformTabs } from './PlatformTabs';
import { EmojiPicker } from './EmojiPicker';
import { MentionAutocomplete } from './MentionAutocomplete';
import { LinkPreviewCard } from './LinkPreviewCard';
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete';
import { useLinkPreview } from '@/hooks/useLinkPreview';
import { getSuggestedAdaptations } from '@/utils/contentAdaptation';
import { useState, useRef } from 'react';
import { Smile, Wand2 } from 'lucide-react';

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
    if (!activePlatform) return mainContent;
    return platformContent[activePlatform] || mainContent;
  };

  // Link previews
  const linkPreviews = useLinkPreview({
    content: getCurrentContent(),
    enabled: true,
  });

  // Determine content status for each platform
  const contentStatus = platforms.reduce((acc, platform) => {
    acc[platform] = platformContent[platform]?.trim() ? 'customized' : 'default';
    return acc;
  }, {} as Record<SocialPlatform, 'default' | 'customized'>);

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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                title="Add emoji (Ctrl+:)"
              >
                <Smile className="h-4 w-4" />
              </button>
              {platforms.length > 1 && mainContent.trim() && (
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

          <div className="relative">
            <textarea
              ref={textareaRef}
              id="post-content"
              value={currentContent}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
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
          
          {/* Link Previews */}
          {linkPreviews.previews.length > 0 && (
            <div className="space-y-3 mt-4">
              {linkPreviews.previews.map(({ url, preview, isLoading }) => (
                <LinkPreviewCard
                  key={url}
                  preview={preview || { url }}
                  isLoading={isLoading}
                  onRemove={() => linkPreviews.removePreview(url)}
                  onRefresh={() => linkPreviews.refreshPreview(url)}
                  onCustomImageUpload={(file) => linkPreviews.uploadCustomImage(url, file)}
                />
              ))}
            </div>
          )}
          
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
