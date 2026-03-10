/**
 * Instagram Preview Component
 * Renders Instagram feed post, story, or reel preview
 */

import { MediaFile } from '@/types/composer.types';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Play } from 'lucide-react';

interface InstagramPreviewProps {
  content: string;
  media: MediaFile[];
  accountUsername?: string;
  accountAvatar?: string;
  contentType?: 'post' | 'story' | 'reel';
}

const INSTAGRAM_LIMIT = 2200;

export function InstagramPreview({
  content,
  media,
  accountUsername = 'your_username',
  accountAvatar,
  contentType = 'post',
}: InstagramPreviewProps) {
  const isOverLimit = content.length > INSTAGRAM_LIMIT;
  const completedMedia = media.filter((m) => m.uploadStatus === 'completed');

  // Highlight hashtags in caption
  const renderCaption = (text: string) => {
    const parts = text.split(/(\s+)/);
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <span key={index} className="text-blue-600">
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Story Preview
  if (contentType === 'story') {
    return (
      <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-lg overflow-hidden w-full max-w-[280px] mx-auto aspect-[9/16]">
        {/* Story Media */}
        {completedMedia.length > 0 ? (
          <div className="relative w-full h-full">
            <img
              src={completedMedia[0].thumbnailUrl || completedMedia[0].url}
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Story Header */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white p-[2px]">
                  {accountAvatar ? (
                    <img
                      src={accountAvatar}
                      alt={accountUsername}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-xs font-semibold text-gray-700">
                        {accountUsername.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-white text-sm font-semibold">{accountUsername}</span>
                <span className="text-white/80 text-xs">now</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white">
            <span className="text-sm opacity-80">Story preview</span>
            <span className="text-xs opacity-60 mt-1">Add media to see preview</span>
          </div>
        )}
      </div>
    );
  }

  // Reel Preview
  if (contentType === 'reel') {
    return (
      <div className="bg-black rounded-lg overflow-hidden w-full max-w-[280px] mx-auto aspect-[9/16]">
        {/* Reel Media */}
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
            {/* Reel Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-white p-[2px]">
                  {accountAvatar ? (
                    <img
                      src={accountAvatar}
                      alt={accountUsername}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-xs font-semibold text-gray-700">
                        {accountUsername.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-white text-sm font-semibold">{accountUsername}</span>
              </div>
              {content && (
                <p className="text-white text-xs line-clamp-2">{content}</p>
              )}
            </div>
            {/* Duration indicator */}
            <div className="absolute top-4 right-4 bg-black/60 text-white text-xs px-2 py-1 rounded">
              0:15
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white">
            <Play className="h-12 w-12 mb-2 opacity-60" />
            <span className="text-sm opacity-80">Reel preview</span>
            <span className="text-xs opacity-60 mt-1">Add video to see preview</span>
          </div>
        )}
      </div>
    );
  }

  // Regular Post Preview (default)
  return (
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden w-full max-w-[375px] mx-auto">
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-3">
          {/* Avatar with gradient ring */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 p-[2px]">
            {accountAvatar ? (
              <img
                src={accountAvatar}
                alt={accountUsername}
                className="w-full h-full rounded-full object-cover bg-white"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                <span className="text-xs font-semibold text-gray-700">
                  {accountUsername.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">{accountUsername}</span>
          </div>
        </div>
        <button className="p-1">
          <MoreHorizontal className="h-5 w-5 text-gray-900" />
        </button>
      </div>

      {/* Media */}
      {completedMedia.length > 0 ? (
        <div className="aspect-square bg-gray-100">
          <img
            src={completedMedia[0].thumbnailUrl || completedMedia[0].url}
            alt=""
            className="w-full h-full object-cover"
          />
          {completedMedia.length > 1 && (
            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
              1/{completedMedia.length}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-square bg-gray-100 flex items-center justify-center">
          <span className="text-gray-400 text-sm">No media</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <button className="hover:opacity-50 transition-opacity">
              <Heart className="h-6 w-6" />
            </button>
            <button className="hover:opacity-50 transition-opacity">
              <MessageCircle className="h-6 w-6" />
            </button>
            <button className="hover:opacity-50 transition-opacity">
              <Send className="h-6 w-6" />
            </button>
          </div>
          <button className="hover:opacity-50 transition-opacity">
            <Bookmark className="h-6 w-6" />
          </button>
        </div>

        {/* Caption */}
        <div className={`text-sm ${isOverLimit ? 'text-red-600' : 'text-gray-900'}`}>
          <span className="font-semibold mr-2">{accountUsername}</span>
          <span className="whitespace-pre-wrap break-words">
            {content ? renderCaption(content) : 'Your Instagram caption will appear here...'}
          </span>
        </div>

        {/* Character Count */}
        <div className={`mt-2 text-xs ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
          {content.length} / {INSTAGRAM_LIMIT}
          {isOverLimit && <span className="ml-2">Over limit!</span>}
        </div>
      </div>
    </div>
  );
}
