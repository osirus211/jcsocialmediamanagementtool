/**
 * Threads Preview Component
 * Enhanced Threads post preview with carousel, reply, and advanced features
 */

import { memo, useMemo } from 'react';
import { MediaFile } from '@/types/composer.types';
import { Heart, MessageCircle, Repeat2, Send, MoreHorizontal, ChevronLeft, ChevronRight, Reply } from 'lucide-react';

interface ThreadsPreviewProps {
  content: string;
  media: MediaFile[];
  accountUsername?: string;
  accountAvatar?: string;
  replyToId?: string;
  replyToUsername?: string;
}

const THREADS_LIMIT = 500;

const ThreadsPreview = memo(function ThreadsPreview({
  content,
  media,
  accountUsername = 'username',
  accountAvatar,
  replyToId,
  replyToUsername,
}: ThreadsPreviewProps) {
  const isOverLimit = content.length > THREADS_LIMIT;
  const completedMedia = useMemo(() => 
    media.filter((m) => m.uploadStatus === 'completed'), 
    [media]
  );

  const isCarousel = completedMedia.length > 1;
  const hasVideo = completedMedia.some(m => m.type === 'video');

  return (
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden w-full max-w-[500px] mx-auto">
      {/* Reply Context */}
      {replyToId && replyToUsername && (
        <div className="px-4 pt-3 pb-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Reply className="h-4 w-4" />
            <span>Replying to @{replyToUsername}</span>
          </div>
        </div>
      )}

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
              <div className="mb-3 rounded-lg overflow-hidden relative">
                {isCarousel ? (
                  // Carousel Preview
                  <div className="relative">
                    <div className="flex overflow-x-auto scrollbar-hide gap-2">
                      {completedMedia.slice(0, 3).map((mediaItem, index) => (
                        <div key={index} className="flex-shrink-0 w-32 h-32 relative">
                          {mediaItem.type === 'video' ? (
                            <div className="w-full h-full bg-black rounded flex items-center justify-center">
                              <div className="text-white text-xs">Video {index + 1}</div>
                            </div>
                          ) : (
                            <img
                              src={mediaItem.thumbnailUrl || mediaItem.url}
                              alt=""
                              className="w-full h-full object-cover rounded"
                            />
                          )}
                        </div>
                      ))}
                      {completedMedia.length > 3 && (
                        <div className="flex-shrink-0 w-32 h-32 bg-gray-200 rounded flex items-center justify-center">
                          <span className="text-sm text-gray-600">+{completedMedia.length - 3}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Carousel Indicators */}
                    <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                      1/{completedMedia.length}
                    </div>
                    
                    {/* Navigation Arrows */}
                    <button className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-1 rounded-full">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-1 rounded-full">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  // Single Media
                  <div className="relative">
                    {completedMedia[0].type === 'video' ? (
                      <div className="w-full h-64 bg-black rounded flex items-center justify-center">
                        <div className="text-white">Video Preview</div>
                      </div>
                    ) : (
                      <img
                        src={completedMedia[0].thumbnailUrl || completedMedia[0].url}
                        alt=""
                        className="w-full max-h-96 object-cover"
                      />
                    )}
                  </div>
                )}
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

      {/* Character Count & Features */}
      <div className="px-4 pb-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className={`text-xs ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
            {content.length} / {THREADS_LIMIT}
            {isOverLimit && <span className="ml-2">Over limit!</span>}
          </div>
          
          {/* Feature Indicators */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {isCarousel && (
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                Carousel ({completedMedia.length})
              </span>
            )}
            {hasVideo && (
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                Video
              </span>
            )}
            {replyToId && (
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                Reply
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export { ThreadsPreview };
