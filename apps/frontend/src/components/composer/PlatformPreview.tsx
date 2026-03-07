import { SocialPlatform, MediaFile, PLATFORM_LIMITS } from '@/types/composer.types';
import { Heart, MessageCircle, Repeat2, Share, ThumbsUp, Send } from 'lucide-react';

interface PlatformPreviewProps {
  platform: SocialPlatform;
  content: string;
  media: MediaFile[];
}

export function PlatformPreview({ platform, content, media }: PlatformPreviewProps) {
  const characterLimit = PLATFORM_LIMITS[platform];
  const isOverLimit = content.length > characterLimit;
  const completedMedia = media.filter((m) => m.uploadStatus === 'completed');

  // Twitter Preview
  if (platform === 'twitter') {
    return (
      <div className="bg-white border rounded-lg p-4 max-w-xl">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-gray-600 font-semibold">U</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-gray-900">Your Name</span>
              <span className="text-gray-500">@username</span>
              <span className="text-gray-500">· now</span>
            </div>
            <p className={`text-gray-900 whitespace-pre-wrap break-words ${isOverLimit ? 'text-red-600' : ''}`}>
              {content || 'Your tweet will appear here...'}
            </p>
            {completedMedia.length > 0 && (
              <div className={`mt-3 grid gap-2 ${completedMedia.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {completedMedia.slice(0, 4).map((item) => (
                  <img
                    key={item.id}
                    src={item.thumbnailUrl || item.url}
                    alt=""
                    className="rounded-lg w-full h-48 object-cover"
                  />
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-3 text-gray-500">
              <button className="flex items-center gap-2 hover:text-blue-500">
                <MessageCircle className="h-5 w-5" />
              </button>
              <button className="flex items-center gap-2 hover:text-green-500">
                <Repeat2 className="h-5 w-5" />
              </button>
              <button className="flex items-center gap-2 hover:text-red-500">
                <Heart className="h-5 w-5" />
              </button>
              <button className="flex items-center gap-2 hover:text-blue-500">
                <Share className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {content.length} / {characterLimit} characters
              {isOverLimit && <span className="text-red-600 ml-2">Over limit!</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LinkedIn Preview
  if (platform === 'linkedin') {
    return (
      <div className="bg-white border rounded-lg overflow-hidden max-w-xl">
        <div className="p-4">
          <div className="flex gap-3 mb-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white font-semibold">U</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Your Name</div>
              <div className="text-sm text-gray-500">Your Headline</div>
              <div className="text-xs text-gray-400">Just now</div>
            </div>
          </div>
          <p className={`text-gray-900 whitespace-pre-wrap break-words ${isOverLimit ? 'text-red-600' : ''}`}>
            {content || 'Your LinkedIn post will appear here...'}
          </p>
        </div>
        {completedMedia.length > 0 && (
          <div className="grid grid-cols-1">
            {completedMedia.slice(0, 1).map((item) => (
              <img
                key={item.id}
                src={item.thumbnailUrl || item.url}
                alt=""
                className="w-full h-64 object-cover"
              />
            ))}
          </div>
        )}
        <div className="p-4 border-t">
          <div className="flex items-center justify-around text-gray-600">
            <button className="flex items-center gap-2 hover:text-blue-600">
              <ThumbsUp className="h-5 w-5" />
              <span className="text-sm">Like</span>
            </button>
            <button className="flex items-center gap-2 hover:text-blue-600">
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm">Comment</span>
            </button>
            <button className="flex items-center gap-2 hover:text-blue-600">
              <Repeat2 className="h-5 w-5" />
              <span className="text-sm">Repost</span>
            </button>
            <button className="flex items-center gap-2 hover:text-blue-600">
              <Send className="h-5 w-5" />
              <span className="text-sm">Send</span>
            </button>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {content.length} / {characterLimit} characters
            {isOverLimit && <span className="text-red-600 ml-2">Over limit!</span>}
          </div>
        </div>
      </div>
    );
  }

  // Facebook Preview
  if (platform === 'facebook') {
    return (
      <div className="bg-white border rounded-lg overflow-hidden max-w-xl">
        <div className="p-4">
          <div className="flex gap-3 mb-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white font-semibold">U</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Your Name</div>
              <div className="text-xs text-gray-500">Just now · 🌎</div>
            </div>
          </div>
          <p className={`text-gray-900 whitespace-pre-wrap break-words ${isOverLimit ? 'text-red-600' : ''}`}>
            {content || 'Your Facebook post will appear here...'}
          </p>
        </div>
        {completedMedia.length > 0 && (
          <div className="grid grid-cols-1">
            {completedMedia.slice(0, 1).map((item) => (
              <img
                key={item.id}
                src={item.thumbnailUrl || item.url}
                alt=""
                className="w-full h-64 object-cover"
              />
            ))}
          </div>
        )}
        <div className="p-4 border-t">
          <div className="flex items-center justify-around text-gray-600">
            <button className="flex items-center gap-2 hover:bg-gray-100 px-4 py-2 rounded">
              <ThumbsUp className="h-5 w-5" />
              <span className="text-sm">Like</span>
            </button>
            <button className="flex items-center gap-2 hover:bg-gray-100 px-4 py-2 rounded">
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm">Comment</span>
            </button>
            <button className="flex items-center gap-2 hover:bg-gray-100 px-4 py-2 rounded">
              <Share className="h-5 w-5" />
              <span className="text-sm">Share</span>
            </button>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {content.length} / {characterLimit} characters
            {isOverLimit && <span className="text-red-600 ml-2">Over limit!</span>}
          </div>
        </div>
      </div>
    );
  }

  // Instagram Preview
  if (platform === 'instagram') {
    return (
      <div className="bg-white border rounded-lg overflow-hidden max-w-md">
        <div className="p-3 flex items-center gap-3 border-b">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 p-0.5">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
              <span className="text-xs font-semibold">U</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">your_username</div>
          </div>
        </div>
        {completedMedia.length > 0 ? (
          <div className="aspect-square bg-gray-100">
            <img
              src={completedMedia[0].thumbnailUrl || completedMedia[0].url}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-square bg-gray-100 flex items-center justify-center">
            <span className="text-gray-400">No media</span>
          </div>
        )}
        <div className="p-3">
          <div className="flex items-center gap-4 mb-3">
            <Heart className="h-6 w-6" />
            <MessageCircle className="h-6 w-6" />
            <Send className="h-6 w-6" />
          </div>
          <p className={`text-sm ${isOverLimit ? 'text-red-600' : 'text-gray-900'}`}>
            <span className="font-semibold">your_username</span>{' '}
            {content || 'Your Instagram caption will appear here...'}
          </p>
          <div className="mt-2 text-xs text-gray-500">
            {content.length} / {characterLimit} characters
            {isOverLimit && <span className="text-red-600 ml-2">Over limit!</span>}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
