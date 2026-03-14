import { useState, memo } from 'react';
import { useComposerStore } from '@/store/composer.store';
import { SocialPlatform } from '@/types/composer.types';
import { MessageCircle, Info } from 'lucide-react';

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
};

const FirstCommentSection = memo(function FirstCommentSection({ selectedPlatforms }: FirstCommentSectionProps) {
  const firstComment = useComposerStore(state => state.firstComment);
  const enableFirstComment = useComposerStore(state => state.enableFirstComment);
  const setFirstComment = useComposerStore(state => state.setFirstComment);
  const setEnableFirstComment = useComposerStore(state => state.setEnableFirstComment);

  // Check if any selected platforms support first comments
  const supportsFirstComment = selectedPlatforms.some(platform => 
    platform === 'instagram' || platform === 'facebook'
  );

  // Get the most restrictive character limit
  const getCharacterLimit = () => {
    const supportedPlatforms = selectedPlatforms.filter(p => p === 'instagram' || p === 'facebook');
    if (supportedPlatforms.length === 0) return 2200;
    
    return Math.min(...supportedPlatforms.map(p => FIRST_COMMENT_LIMITS[p]));
  };

  if (!supportsFirstComment) {
    return null;
  }

  const characterLimit = getCharacterLimit();
  const characterCount = firstComment?.length || 0;
  const isOverLimit = characterCount > characterLimit;

  return (
    <section aria-labelledby="first-comment-label">
      <div className="space-y-3">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enable-first-comment"
              checked={enableFirstComment}
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
            <span>Instagram & Facebook only</span>
          </div>
        </div>

        {/* First Comment Input */}
        {enableFirstComment && (
          <div className="space-y-2">
            <textarea
              value={firstComment || ''}
              onChange={(e) => setFirstComment(e.target.value)}
              placeholder="Add a first comment that will be posted automatically after your post goes live..."
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                isOverLimit ? 'border-red-500' : 'border-gray-300'
              }`}
              aria-label="First comment content"
              aria-describedby="first-comment-count"
            />
            
            {/* Character Count */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">
                First comment will be posted automatically after publishing
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

            {/* Tips */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-1">First Comment Tips:</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• Add relevant hashtags to increase discoverability</li>
                <li>• Include a call-to-action or question to boost engagement</li>
                <li>• Tag relevant accounts or collaborators</li>
                <li>• Keep it conversational and authentic</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
});

export { FirstCommentSection };