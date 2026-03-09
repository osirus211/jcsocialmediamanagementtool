/**
 * Facebook Preview Component
 * Renders a Facebook post card
 */

import { MediaFile } from '@/types/composer.types';
import { ThumbsUp, MessageCircle, Share2, Globe, MoreHorizontal } from 'lucide-react';
import { PreviewMediaGrid } from './PreviewMediaGrid';

interface FacebookPreviewProps {
  content: string;
  media: MediaFile[];
  accountName?: string;
  accountAvatar?: string;
}

const FACEBOOK_LIMIT = 63206;

export function FacebookPreview({
  content,
  media,
  accountName = 'Your Name',
  accountAvatar,
}: FacebookPreviewProps) {
  const isOverLimit = content.length > FACEBOOK_LIMIT;

  return (
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden w-full max-w-[375px] mx-auto">
      {/* Header */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Avatar */}
            {accountAvatar ? (
              <img
                src={accountAvatar}
                alt={accountName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white font-semibold">
                  {accountName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {/* User Info */}
            <div className="flex-1">
              <div className="font-semibold text-sm text-gray-900">{accountName}</div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>Just now</span>
                <span>·</span>
                <Globe className="h-3 w-3" />
              </div>
            </div>
          </div>

          <button className="p-1 hover:bg-gray-100 rounded-full">
            <MoreHorizontal className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Post Content */}
        <p className={`text-sm whitespace-pre-wrap break-words ${isOverLimit ? 'text-red-600' : 'text-gray-900'}`}>
          {content || 'Your Facebook post will appear here...'}
        </p>
      </div>

      {/* Media */}
      {media.filter((m) => m.uploadStatus === 'completed').length > 0 && (
        <div className="w-full">
          <PreviewMediaGrid media={media} maxItems={1} />
        </div>
      )}

      {/* Reactions Summary */}
      <div className="px-3 py-2 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="flex -space-x-1">
              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center border border-white">
                <ThumbsUp className="h-2.5 w-2.5 text-white fill-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-3 py-1 border-t border-gray-200">
        <div className="flex items-center justify-around">
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded transition-colors text-gray-600">
            <ThumbsUp className="h-5 w-5" />
            <span className="text-sm font-medium">Like</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded transition-colors text-gray-600">
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Comment</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded transition-colors text-gray-600">
            <Share2 className="h-5 w-5" />
            <span className="text-sm font-medium">Share</span>
          </button>
        </div>
      </div>

      {/* Character Count */}
      <div className="px-3 pb-2">
        <div className={`text-xs ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
          {content.length} / {FACEBOOK_LIMIT}
          {isOverLimit && <span className="ml-2">Over limit!</span>}
        </div>
      </div>
    </div>
  );
}
