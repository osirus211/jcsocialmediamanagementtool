/**
 * Bluesky Preview Component
 * Renders a Bluesky post card with rich text features
 */

import { memo, useMemo } from 'react';
import { MediaFile } from '@/types/composer.types';
import { Heart, MessageCircle, Repeat2, MoreHorizontal, Link as LinkIcon } from 'lucide-react';

interface BlueskyPreviewProps {
  content: string;
  media: MediaFile[];
  accountHandle?: string;
  accountDisplayName?: string;
  accountAvatar?: string;
}

const BLUESKY_LIMIT = 300;

// Helper function to detect and format rich text
const formatRichText = (text: string) => {
  const parts: Array<{ text: string; type: 'text' | 'hashtag' | 'mention' | 'link' }> = [];
  
  // Regex patterns for different text types
  const patterns = [
    { type: 'hashtag' as const, regex: /#[\w]+/g },
    { type: 'mention' as const, regex: /@[\w.-]+\.[\w]+/g },
    { type: 'link' as const, regex: /https?:\/\/[^\s]+/g },
  ];
  
  let lastIndex = 0;
  const matches: Array<{ start: number; end: number; type: string; text: string }> = [];
  
  // Find all matches
  patterns.forEach(({ type, regex }) => {
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        type,
        text: match[0],
      });
    }
  });
  
  // Sort matches by position
  matches.sort((a, b) => a.start - b.start);
  
  // Build parts array
  matches.forEach((match) => {
    // Add text before match
    if (match.start > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, match.start),
        type: 'text',
      });
    }
    
    // Add the match
    parts.push({
      text: match.text,
      type: match.type as any,
    });
    
    lastIndex = match.end;
  });
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      type: 'text',
    });
  }
  
  return parts.length > 0 ? parts : [{ text, type: 'text' as const }];
};

const BlueskyPreview = memo(function BlueskyPreview({
  content,
  media,
  accountHandle = 'handle.bsky.social',
  accountDisplayName = 'Display Name',
  accountAvatar,
}: BlueskyPreviewProps) {
  const isOverLimit = content.length > BLUESKY_LIMIT;
  const completedMedia = useMemo(() => 
    media.filter((m) => m.uploadStatus === 'completed'), 
    [media]
  );

  const richTextParts = useMemo(() => formatRichText(content), [content]);

  const renderRichText = () => {
    if (!content) {
      return <span className="text-gray-500">Your Bluesky post will appear here...</span>;
    }

    return richTextParts.map((part, index) => {
      switch (part.type) {
        case 'hashtag':
          return (
            <span key={index} className="text-blue-600 hover:underline cursor-pointer">
              {part.text}
            </span>
          );
        case 'mention':
          return (
            <span key={index} className="text-blue-600 hover:underline cursor-pointer">
              {part.text}
            </span>
          );
        case 'link':
          return (
            <span key={index} className="text-blue-600 hover:underline cursor-pointer inline-flex items-center">
              {part.text}
              <LinkIcon className="w-3 h-3 ml-1" />
            </span>
          );
        default:
          return <span key={index}>{part.text}</span>;
      }
    });
  };

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
              {renderRichText()}
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
                    {m.type.startsWith('image/') ? (
                      <img
                        src={m.thumbnailUrl || m.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : m.type.startsWith('video/') ? (
                      <div className="relative w-full h-full">
                        <video
                          src={m.url}
                          className="w-full h-full object-cover"
                          controls={false}
                          muted
                        />
                        {/* Video play indicator */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                            <div className="w-0 h-0 border-l-4 border-l-white border-y-2 border-y-transparent ml-1"></div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                        <span className="text-xs">Media</span>
                      </div>
                    )}
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
});

export { BlueskyPreview };
