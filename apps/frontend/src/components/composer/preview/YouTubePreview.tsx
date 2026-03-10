/**
 * YouTube Preview Component
 * Shows how the post will appear on YouTube (video uploads and Shorts)
 */

import { MediaFile } from '@/types/composer.types';

interface YouTubePreviewProps {
  content: string;
  media: MediaFile[];
  channelName?: string;
  channelAvatar?: string;
}

export function YouTubePreview({ content, media, channelName, channelAvatar }: YouTubePreviewProps) {
  const videoMedia = media.find(m => m.type === 'video');
  const isShort = videoMedia && videoMedia.duration && videoMedia.duration <= 60;

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Video Preview */}
      {videoMedia ? (
        <div className="relative">
          <div className="aspect-video bg-black rounded-t-lg overflow-hidden">
            {videoMedia.thumbnailUrl ? (
              <img 
                src={videoMedia.thumbnailUrl} 
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-2 bg-red-600 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                  <p className="text-sm">Video Preview</p>
                </div>
              </div>
            )}
          </div>
          
          {/* YouTube Shorts Badge */}
          {isShort && (
            <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs font-medium">
              #Shorts
            </div>
          )}
          
          {/* Duration Badge */}
          {videoMedia.duration && (
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
              {Math.floor(videoMedia.duration / 60)}:{(videoMedia.duration % 60).toString().padStart(2, '0')}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-video bg-gray-100 rounded-t-lg flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="w-12 h-12 mx-auto mb-2 bg-red-600 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <p className="text-sm font-medium">Video Required</p>
            <p className="text-xs">YouTube requires video content</p>
          </div>
        </div>
      )}

      {/* Video Info */}
      <div className="p-4">
        {/* Title (from content) */}
        <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
          {content || 'Untitled Video'}
        </h3>

        {/* Channel Info */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-300 rounded-full overflow-hidden flex-shrink-0">
            {channelAvatar ? (
              <img src={channelAvatar} alt="Channel" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-red-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {channelName ? channelName[0].toUpperCase() : 'Y'}
                </span>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {channelName || 'Your Channel'}
            </p>
            <p className="text-xs text-gray-500">0 views • Just now</p>
          </div>
        </div>

        {/* Video Type Indicator */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {isShort ? 'YouTube Short' : 'YouTube Video'}
          </span>
          {videoMedia && (
            <span className="text-xs text-gray-500">
              {videoMedia.duration ? `${Math.floor(videoMedia.duration / 60)}:${(videoMedia.duration % 60).toString().padStart(2, '0')}` : 'Duration unknown'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}