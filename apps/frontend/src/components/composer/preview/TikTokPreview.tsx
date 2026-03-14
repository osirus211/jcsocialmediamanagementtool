/**
 * TikTok Preview Component
 * Renders a TikTok vertical video card with overlays, sounds, and engagement
 */

import { memo, useMemo } from 'react';
import { MediaFile } from '@/types/composer.types';
import { Heart, MessageCircle, Share2, Bookmark, Play, Music, MoreHorizontal } from 'lucide-react';

interface TikTokPreviewProps {
  content: string;
  media: MediaFile[];
  accountUsername?: string;
  accountAvatar?: string;
}

const TIKTOK_LIMIT = 2200;

const TikTokPreview = memo(function TikTokPreview({
  content,
  media,
  accountUsername = 'your_username',
  accountAvatar,
}: TikTokPreviewProps) {
  const isOverLimit = content.length > TIKTOK_LIMIT;
  const completedMedia = useMemo(() => 
    media.filter((m) => m.uploadStatus === 'completed'), 
    [media]
  );

  // Highlight hashtags in caption
  const renderCaption = useMemo(() => (text: string) => {
    const parts = text.split(/(\s+)/);
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <span key={index} className="text-white font-semibold">
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  }, []);

  return (
    <div className="bg-black rounded-lg overflow-hidden w-full max-w-[280px] mx-auto aspect-[9/16] relative">
      {/* Video Content */}
      {completedMedia.length > 0 ? (
        <div className="relative w-full h-full">
          <img
            src={completedMedia[0].thumbnailUrl || completedMedia[0].url}
            alt=""
            className="w-full h-full object-cover"
          />
          
          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play className="h-8 w-8 text-white fill-white" />
            </div>
          </div>

          {/* Top Right Actions */}
          <div className="absolute top-4 right-4">
            <button className="p-2">
              <MoreHorizontal className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Right Side Actions */}
          <div className="absolute right-3 bottom-20 flex flex-col gap-6">
            {/* Profile Avatar */}
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden">
                {accountAvatar ? (
                  <img
                    src={accountAvatar}
                    alt={accountUsername}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-600 flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {accountUsername.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              {/* Follow Button */}
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">+</span>
                </div>
              </div>
            </div>

            {/* Like Button */}
            <div className="flex flex-col items-center">
              <button className="p-2">
                <Heart className="h-8 w-8 text-white" />
              </button>
              <span className="text-white text-xs font-semibold">12.3K</span>
            </div>

            {/* Comment Button */}
            <div className="flex flex-col items-center">
              <button className="p-2">
                <MessageCircle className="h-8 w-8 text-white" />
              </button>
              <span className="text-white text-xs font-semibold">1,234</span>
            </div>

            {/* Bookmark Button */}
            <div className="flex flex-col items-center">
              <button className="p-2">
                <Bookmark className="h-8 w-8 text-white" />
              </button>
              <span className="text-white text-xs font-semibold">567</span>
            </div>

            {/* Share Button */}
            <div className="flex flex-col items-center">
              <button className="p-2">
                <Share2 className="h-8 w-8 text-white" />
              </button>
              <span className="text-white text-xs font-semibold">89</span>
            </div>

            {/* Music Disc */}
            <div className="w-10 h-10 rounded-full bg-gray-800 border-2 border-white flex items-center justify-center animate-spin">
              <Music className="h-4 w-4 text-white" />
            </div>
          </div>

          {/* Bottom Content */}
          <div className="absolute bottom-0 left-0 right-16 p-4 bg-gradient-to-t from-black/80 to-transparent">
            {/* Username */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white font-semibold text-sm">@{accountUsername}</span>
            </div>

            {/* Caption */}
            {content && (
              <p className={`text-white text-sm mb-2 line-clamp-3 ${isOverLimit ? 'text-red-400' : ''}`}>
                {renderCaption(content)}
              </p>
            )}

            {/* Music Info */}
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-white" />
              <span className="text-white text-xs">Original sound - {accountUsername}</span>
            </div>
          </div>

          {/* Duration indicator */}
          <div className="absolute top-4 left-4 bg-black/60 text-white text-xs px-2 py-1 rounded">
            0:15
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-white bg-gray-900">
          <Play className="h-16 w-16 mb-4 opacity-60" />
          <span className="text-lg font-semibold opacity-80">TikTok Preview</span>
          <span className="text-sm opacity-60 mt-1">Add video to see preview</span>
        </div>
      )}

      {/* Character Count */}
      {content && (
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
          <span className={isOverLimit ? 'text-red-400 font-semibold' : ''}>
            {content.length} / {TIKTOK_LIMIT}
            {isOverLimit && ' Over limit!'}
          </span>
        </div>
      )}
    </div>
  );
});

export { TikTokPreview };