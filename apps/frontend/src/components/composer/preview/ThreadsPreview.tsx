/**
 * Threads Preview Component
 * Renders a Threads post card
 */

import { memo, useMemo } from 'react';
import { MediaFile } from '@/types/composer.types';
import { Heart, MessageCircle, Repeat2, Send, MoreHorizontal } from 'lucide-react';

interface ThreadsPreviewProps {
  content: string;
  media: MediaFile[];
  accountUsername?: string;
  accountAvatar?: string;
}

const THREADS_LIMIT = 500;

const ThreadsPreview = memo(function ThreadsPreview({
  content,
  media,
  accountUsername = 'username',
  accountAvatar,
}: ThreadsPreviewProps) {
  const isOverLimit = content.length > THREADS_LIMIT;
  const completedMedia = useMemo(() => 
    media.filter((m) => m.uploadStatus === 'completed'), 
    [media]
  );

  return (
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden w-full max-w-[500px] mx-auto">
      {/* Header */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0">
            {accountAvatar ? (
              <img
                src={accountAvatar}
                alt={accountUsername}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-sm font-semibold text-gray-700">
                  {accountUsername.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">{accountUsername}</span>
              <span className="text-gray-500 text-sm">· now</span>
            </div>

            {/* Post Text */}
            <div className={`text-sm mb-3 whitespace-pre-wrap break-words ${isOverLimit ? 'text-red-600' : 'text-gray-900'}`}>
              {content || 'Your Threads post will appear here...'}
            </div>

            {/* Media */}
            {completedMedia.length > 0 && (
              <div className="mb-3 rounded-lg overflow-hidden">
                <img
                  src={completedMedia[0].thumbnailUrl || completedMedia[0].url}
                  alt=""
                  className="w-full max-h-96 object-cover"
                />
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center gap-4 text-gray-600">
              <button className="hover:text-red-500 transition-colors">
                <Heart className="h-5 w-5" />
              </button>
              <button className="hover:text-blue-500 transition-colors">
                <MessageCircle className="h-5 w-5" />
              </button>
              <button className="hover:text-green-500 transition-colors">
                <Repeat2 className="h-5 w-5" />
              </button>
              <button className="hover:text-blue-500 transition-colors">
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <button className="p-1 hover:bg-gray-100 rounded">
          <MoreHorizontal className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Character Count */}
      <div className="px-4 pb-3">
        <div className={`text-xs ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
          {content.length} / {THREADS_LIMIT}
          {isOverLimit && <span className="ml-2">Over limit!</span>}
        </div>
      </div>
    </div>
  );
});

export { ThreadsPreview };
