/**
 * Bluesky Preview Component
 * Renders a Bluesky post card
 */

import { MediaFile } from '@/types/composer.types';
import { Heart, MessageCircle, Repeat2, MoreHorizontal } from 'lucide-react';

interface BlueskyPreviewProps {
  content: string;
  media: MediaFile[];
  accountHandle?: string;
  accountDisplayName?: string;
  accountAvatar?: string;
}

const BLUESKY_LIMIT = 300;

export function BlueskyPreview({
  content,
  media,
  accountHandle = 'handle.bsky.social',
  accountDisplayName = 'Display Name',
  accountAvatar,
}: BlueskyPreviewProps) {
  const isOverLimit = content.length > BLUESKY_LIMIT;
  const completedMedia = media.filter((m) => m.uploadStatus === 'completed');

  return (
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden w-full max-w-[600px] mx-auto">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0">
            {accountAvatar ? (
              <img
                src={accountAvatar}
                alt={accountDisplayName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-sky-500 flex items-center justify-center">
                <span className="text-lg font-semibold text-white">
                  {accountDisplayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div>
                <div className="font-semibold text-sm">{accountDisplayName}</div>
                <div className="text-gray-500 text-sm">@{accountHandle}</div>
              </div>
              <button className="p-1 hover:bg-gray-100 rounded">
                <MoreHorizontal className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Post Text */}
            <div className={`text-sm mb-3 whitespace-pre-wrap break-words ${isOverLimit ? 'text-red-600' : 'text-gray-900'}`}>
              {content || 'Your Bluesky post will appear here...'}
            </div>

            {/* Media Grid */}
            {completedMedia.length > 0 && (
              <div className={`mb-3 rounded-lg overflow-hidden border border-gray-200 ${
                completedMedia.length === 1 ? '' :
                completedMedia.length === 2 ? 'grid grid-cols-2 gap-0.5' :
                'grid grid-cols-2 gap-0.5'
              }`}>
                {completedMedia.slice(0, 4).map((m, idx) => (
                  <div key={idx} className={completedMedia.length === 1 ? 'aspect-video' : 'aspect-square'}>
                    <img
                      src={m.thumbnailUrl || m.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center gap-6 text-gray-600 text-sm">
              <button className="flex items-center gap-1 hover:text-red-500 transition-colors">
                <Heart className="h-4 w-4" />
                <span>0</span>
              </button>
              <button className="flex items-center gap-1 hover:text-blue-500 transition-colors">
                <MessageCircle className="h-4 w-4" />
                <span>0</span>
              </button>
              <button className="flex items-center gap-1 hover:text-green-500 transition-colors">
                <Repeat2 className="h-4 w-4" />
                <span>0</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Character Count */}
      <div className="px-4 pb-3 border-t border-gray-100 pt-2">
        <div className={`text-xs ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
          {content.length} / {BLUESKY_LIMIT}
          {isOverLimit && <span className="ml-2">Over limit!</span>}
        </div>
      </div>
    </div>
  );
}
