/**
 * LinkedIn Preview Component
 * Renders a realistic LinkedIn post card
 */

import { memo, useMemo } from 'react';
import { MediaFile } from '@/types/composer.types';
import { ThumbsUp, MessageSquare, Repeat2, Send } from 'lucide-react';
import { PreviewMediaGrid } from './PreviewMediaGrid';

interface LinkedInPreviewProps {
  content: string;
  media: MediaFile[];
  accountName?: string;
  accountHeadline?: string;
  accountAvatar?: string;
}

const LINKEDIN_LIMIT = 3000;
const PREVIEW_TRUNCATE = 150;

const LinkedInPreview = memo(function LinkedInPreview({
  content,
  media,
  accountName = 'Your Name',
  accountHeadline = 'Your Professional Headline',
  accountAvatar,
}: LinkedInPreviewProps) {
  const isOverLimit = content.length > LINKEDIN_LIMIT;
  const shouldTruncate = content.length > PREVIEW_TRUNCATE;
  const displayContent = useMemo(() => 
    shouldTruncate ? content.slice(0, PREVIEW_TRUNCATE) + '...' : content,
    [content, shouldTruncate]
  );
  const completedMedia = useMemo(() => 
    media.filter((m) => m.uploadStatus === 'completed'), 
    [media]
  );

  return (
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden w-full max-w-[375px] mx-auto">
      {/* Header */}
      <div className="p-3">
        <div className="flex gap-2 mb-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {accountAvatar ? (
              <img
                src={accountAvatar}
                alt={accountName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white font-semibold text-lg">
                  {accountName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900">{accountName}</div>
            <div className="text-xs text-gray-600 truncate">{accountHeadline}</div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <span>Just now</span>
              <span>·</span>
              <span>🌐</span>
            </div>
          </div>
        </div>

        {/* Post Content */}
        <div className={`text-sm whitespace-pre-wrap break-words ${isOverLimit ? 'text-red-600' : 'text-gray-900'}`}>
          {displayContent || 'Your LinkedIn post will appear here...'}
          {shouldTruncate && !isOverLimit && (
            <button className="text-blue-600 hover:underline ml-1">...see more</button>
          )}
        </div>
      </div>

      {/* Media */}
      {completedMedia.length > 0 && (
        <div className="w-full">
          <PreviewMediaGrid media={media} maxItems={1} />
        </div>
      )}

      {/* Action Bar */}
      <div className="p-2 border-t border-gray-200">
        <div className="flex items-center justify-around">
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded transition-colors text-gray-600">
            <ThumbsUp className="h-5 w-5" />
            <span className="text-sm font-medium">Like</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded transition-colors text-gray-600">
            <MessageSquare className="h-5 w-5" />
            <span className="text-sm font-medium">Comment</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded transition-colors text-gray-600">
            <Repeat2 className="h-5 w-5" />
            <span className="text-sm font-medium">Repost</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded transition-colors text-gray-600">
            <Send className="h-5 w-5" />
            <span className="text-sm font-medium">Send</span>
          </button>
        </div>
      </div>

      {/* Character Count */}
      <div className="px-3 pb-2">
        <div className={`text-xs ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
          {content.length} / {LINKEDIN_LIMIT}
          {isOverLimit && <span className="ml-2">Over limit!</span>}
        </div>
      </div>
    </div>
  );
});

export { LinkedInPreview };
