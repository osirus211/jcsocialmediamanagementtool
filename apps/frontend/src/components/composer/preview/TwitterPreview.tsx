/**
 * Twitter/X Preview Component
 * Renders a realistic Twitter card UI
 */

import { memo, useMemo } from 'react';
import { MediaFile } from '@/types/composer.types';
import { Heart, MessageCircle, Repeat2, Share2, BarChart } from 'lucide-react';
import { PreviewMediaGrid } from './PreviewMediaGrid';

interface TwitterPreviewProps {
  content: string;
  media: MediaFile[];
  accountName?: string;
  accountHandle?: string;
  accountAvatar?: string;
}

const TWITTER_LIMIT = 280;

const TwitterPreview = memo(function TwitterPreview({
  content,
  media,
  accountName = 'Your Name',
  accountHandle = 'yourhandle',
  accountAvatar,
}: TwitterPreviewProps) {
  const isOverLimit = content.length > TWITTER_LIMIT;
  const displayContent = useMemo(() => 
    isOverLimit ? content.slice(0, TWITTER_LIMIT) + '...' : content,
    [content, isOverLimit]
  );

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 w-full max-w-[375px] mx-auto">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {accountAvatar ? (
            <img
              src={accountAvatar}
              alt={accountName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-gray-600 font-semibold text-lg">
                {accountName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1 mb-1">
            <span className="font-bold text-gray-900 text-[15px]">{accountName}</span>
            <span className="text-gray-500 text-[15px]">@{accountHandle}</span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-500 text-[15px]">now</span>
          </div>

          {/* Post Text */}
          <p className={`text-[15px] whitespace-pre-wrap break-words ${isOverLimit ? 'text-red-600' : 'text-gray-900'}`}>
            {displayContent || 'Your tweet will appear here...'}
          </p>

          {/* Media */}
          <PreviewMediaGrid media={media} maxItems={4} />

          {/* Action Bar */}
          <div className="flex items-center justify-between mt-3 text-gray-500 max-w-md">
            <button className="flex items-center gap-2 hover:text-blue-500 transition-colors group">
              <div className="p-2 rounded-full group-hover:bg-blue-50">
                <MessageCircle className="h-[18px] w-[18px]" />
              </div>
            </button>
            <button className="flex items-center gap-2 hover:text-green-500 transition-colors group">
              <div className="p-2 rounded-full group-hover:bg-green-50">
                <Repeat2 className="h-[18px] w-[18px]" />
              </div>
            </button>
            <button className="flex items-center gap-2 hover:text-red-500 transition-colors group">
              <div className="p-2 rounded-full group-hover:bg-red-50">
                <Heart className="h-[18px] w-[18px]" />
              </div>
            </button>
            <button className="flex items-center gap-2 hover:text-blue-500 transition-colors group">
              <div className="p-2 rounded-full group-hover:bg-blue-50">
                <BarChart className="h-[18px] w-[18px]" />
              </div>
            </button>
            <button className="flex items-center gap-2 hover:text-blue-500 transition-colors group">
              <div className="p-2 rounded-full group-hover:bg-blue-50">
                <Share2 className="h-[18px] w-[18px]" />
              </div>
            </button>
          </div>

          {/* Character Count */}
          <div className={`mt-2 text-xs ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
            {content.length} / {TWITTER_LIMIT}
            {isOverLimit && <span className="ml-2">Over limit!</span>}
          </div>
        </div>
      </div>
    </div>
  );
});

export { TwitterPreview };
