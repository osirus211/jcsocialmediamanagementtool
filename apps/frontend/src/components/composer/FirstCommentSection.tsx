import { useState, memo, useRef } from 'react';
import { useComposerStore } from '@/store/composer.store';
import { SocialPlatform } from '@/types/composer.types';
import { MessageCircle, Info, Hash, Undo2, Clock, Save, Smile } from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { useTheme } from '@/hooks/useTheme';

interface FirstCommentSectionProps {
  selectedPlatforms: SocialPlatform[];
}

const FIRST_COMMENT_LIMITS: Record<SocialPlatform, number> = {
  instagram: 2200,
  facebook: 8000,
  twitter: 280,
  linkedin: 3000,
  threads: 500,
  bluesky: 300,
  youtube: 10000,
  'google-business': 1500,
  pinterest: 500,
  tiktok: 2200,
};

const DELAY_OPTIONS = [
  { value: 0, label: 'Immediately' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
];

// Mock templates - in real app, these would come from API
const FIRST_COMMENT_TEMPLATES = [
  { id: '1', name: 'Engagement CTA', content: 'What do you think? Let me know in the comments! 👇' },
  { id: '2', name: 'Link in Bio', content: 'Link in bio for more details! 🔗' },
  { id: '3', name: 'Hashtag Set 1', content: '#socialmedia #marketing #digitalmarketing #contentcreator #business' },
  { id: '4', name: 'Hashtag Set 2', content: '#entrepreneur #startup #growth #success #motivation' },
];

const FirstCommentSection = memo(function FirstCommentSection({ selectedPlatforms }: FirstCommentSectionProps) {
  const firstComment = useComposerStore(state => state.firstComment);
  const enableFirstComment = useComposerStore(state => state.enableFirstComment);
  const content = useComposerStore(state => state.mainContent);
  const setFirstComment = useComposerStore(state => state.setFirstComment);
  const setEnableFirstComment = useComposerStore(state => state.setEnableFirstComment);
  const setFirstCommentConfig = useComposerStore(state => state.setFirstCommentConfig);
  const setContent = useComposerStore(state => state.setContent);

  const [movedHashtags, setMovedHashtags] = useState<string[]>([]);
  const [originalContent, setOriginalContent] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const theme = useTheme();

  // Check if any selected platforms support first comments
  const supportedPlatforms = selectedPlatforms.filter(platform => 
    platform === 'instagram' || platform === 'facebook' || platform === 'linkedin'
  );

  // Get current first comment config
  const firstCommentContent = firstComment?.content || '';
  const firstCommentEnabled = firstComment?.enabled || enableFirstComment || false;
  const selectedPlatformsForComment = firstComment?.platforms || [];
  const selectedDelay = firstComment?.delay || 0;

  // Get the most restrictive character limit
  const getCharacterLimit = () => {
    if (supportedPlatforms.length === 0) return 2200;
    return Math.min(...supportedPlatforms.map(p => FIRST_COMMENT_LIMITS[p]));
  };

  // Extract hashtags from content
  const extractHashtags = (text: string): string[] => {
    const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
    return text.match(hashtagRegex) || [];
  };

  // Move hashtags to first comment
  const moveHashtagsToFirstComment = () => {
    const hashtags = extractHashtags(content);
    if (hashtags.length === 0) return;

    // Store original content for undo
    setOriginalContent(content);
    setMovedHashtags(hashtags);

    // Remove hashtags from main content
    const contentWithoutHashtags = content.replace(/#[\w\u0590-\u05ff]+/g, '').trim();
    setContent('main', contentWithoutHashtags);

    // Add hashtags to first comment
    const hashtagString = hashtags.join(' ');
    const newFirstComment = firstCommentContent 
      ? `${firstCommentContent}\n\n${hashtagString}`
      : hashtagString;
    
    setFirstComment(newFirstComment);
  };

  // Undo hashtag move
  const undoHashtagMove = () => {
    if (originalContent) {
      setContent('main', originalContent);
      
      // Remove moved hashtags from first comment
      if (movedHashtags.length > 0) {
        const hashtagString = movedHashtags.join(' ');
        const updatedFirstComment = firstCommentContent?.replace(hashtagString, '').replace(/\n\n$/, '').trim();
        setFirstComment(updatedFirstComment || '');
      }
      
      setOriginalContent('');
      setMovedHashtags([]);
    }
  };

  // Apply template
  const applyTemplate = (template: typeof FIRST_COMMENT_TEMPLATES[0]) => {
    setFirstComment(template.content);
  };

  // Update platform selection
  const updatePlatformSelection = (platform: SocialPlatform, selected: boolean) => {
    const currentPlatforms = selectedPlatformsForComment;
    const newPlatforms = selected 
      ? [...currentPlatforms, platform]
      : currentPlatforms.filter(p => p !== platform);
    
    setFirstCommentConfig({ platforms: newPlatforms });
  };

  // Update delay
  const updateDelay = (delay: number) => {
    setFirstCommentConfig({ delay });
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = firstCommentContent;
    const newContent = currentContent.slice(0, start) + emoji + currentContent.slice(end);
    
    setFirstComment(newContent);
    
    // Restore cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  if (supportedPlatforms.length === 0) {
    return null;
  }

  const characterLimit = getCharacterLimit();
  const characterCount = firstCommentContent?.length || 0;
  const isOverLimit = characterCount > characterLimit;
  const hashtagsInContent = extractHashtags(content);
  const canMoveHashtags = hashtagsInContent.length > 0;
  const canUndo = movedHashtags.length > 0;

  return (
    <section aria-labelledby="first-comment-label">
      <div className="space-y-4">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enable-first-comment"
              checked={firstCommentEnabled}
              onChange={(e) => setEnableFirstComment(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="enable-first-comment" className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <MessageCircle className="h-4 w-4" />
              Schedule First Comment
            </label>
          </div>
          
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Info className="h-3 w-3" />
            <span>
              {supportedPlatforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')} only
            </span>
          </div>
        </div>

        {/* First Comment Configuration */}
        {firstCommentEnabled && (
          <div className="space-y-4">
            {/* Platform Selection */}
            {supportedPlatforms.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Platforms for first comment:
                </label>
                <div className="flex flex-wrap gap-2">
                  {supportedPlatforms.map((platform) => (
                    <label key={platform} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedPlatformsForComment.includes(platform)}
                        onChange={(e) => updatePlatformSelection(platform, e.target.checked)}
                        className="h-3 w-3 text-blue-600 rounded"
                      />
                      <span className="capitalize">{platform}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Delay Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Post delay:
              </label>
              <select
                value={selectedDelay}
                onChange={(e) => updateDelay(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {DELAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {canMoveHashtags && (
                <button
                  type="button"
                  onClick={moveHashtagsToFirstComment}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Hash className="h-4 w-4" />
                  Move hashtags to first comment ({hashtagsInContent.length})
                </button>
              )}
              
              {canUndo && (
                <button
                  type="button"
                  onClick={undoHashtagMove}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Undo2 className="h-4 w-4" />
                  Undo move
                </button>
              )}
            </div>

            {/* Templates */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Save className="h-4 w-4" />
                Quick templates:
              </label>
              <div className="flex flex-wrap gap-2">
                {FIRST_COMMENT_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>

            {/* First Comment Input */}
            <div className="space-y-2">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={firstCommentContent}
                  onChange={(e) => setFirstComment(e.target.value)}
                  placeholder="Add a first comment that will be posted automatically after your post goes live..."
                  rows={4}
                  className={`w-full px-3 py-2 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                    isOverLimit ? 'border-red-500' : 'border-gray-300'
                  }`}
                  aria-label="First comment content"
                  aria-describedby="first-comment-count"
                />
                
                {/* Emoji Button */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                  title="Add emoji"
                >
                  <Smile className="h-4 w-4" />
                </button>

                {/* Emoji Picker */}
                <EmojiPicker
                  isOpen={showEmojiPicker}
                  onEmojiSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                  theme={theme}
                />
              </div>
              
              {/* Character Count */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">
                  Will be posted {selectedDelay === 0 ? 'immediately' : `after ${DELAY_OPTIONS.find(d => d.value === selectedDelay)?.label.toLowerCase()}`}
                </span>
                <span
                  id="first-comment-count"
                  className={`${
                    isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'
                  }`}
                >
                  {characterCount} / {characterLimit}
                  {isOverLimit && (
                    <span className="ml-2 text-xs">
                      ({characterCount - characterLimit} over limit)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Preview */}
            {firstCommentContent && (
              <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Preview:</h4>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {firstCommentContent}
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-1">First Comment Tips:</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• Add relevant hashtags to increase discoverability</li>
                <li>• Include a call-to-action or question to boost engagement</li>
                <li>• Tag relevant accounts or collaborators</li>
                <li>• Keep it conversational and authentic</li>
                <li>• Use templates for frequently used comments</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
});

export { FirstCommentSection };