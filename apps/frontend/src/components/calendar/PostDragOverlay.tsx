import { Post } from '@/types/post.types';
import { StatusBadge } from '@/components/posts/StatusBadge';
import { getPlatformIcon } from '@/lib/platform-utils';

interface PostDragOverlayProps {
  post: Post;
}

/**
 * PostDragOverlay Component
 * 
 * Ghost card shown during drag operation
 * 
 * Features:
 * - Semi-transparent overlay effect
 * - Shows post content and platform
 * - Maintains visual consistency
 * - Smooth animations
 * 
 * Design inspired by best practices:
 * - Buffer's clean ghost cards
 * - Notion's drag feedback
 * - Figma's overlay system
 */
export function PostDragOverlay({ post }: PostDragOverlayProps) {
  const time = new Date(post.scheduledAt!).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const platformIcon = getPlatformIcon(post.socialAccountId || 'unknown');

  return (
    <div className="bg-white border border-blue-300 rounded-lg p-3 shadow-lg opacity-90 transform rotate-2 max-w-[280px]">
      {/* Header with status and time */}
      <div className="flex items-center gap-2 mb-2">
        <StatusBadge status={post.status} />
        <span className="text-xs text-gray-500">{time}</span>
        <div className="ml-auto flex items-center gap-1">
          {platformIcon && (
            <img 
              src={platformIcon} 
              alt={post.socialAccountId} 
              className="w-4 h-4"
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="text-sm text-gray-800 line-clamp-3">
        {post.content}
      </div>

      {/* Media indicator */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
          <span>📷</span>
          <span>{post.mediaUrls.length} media</span>
        </div>
      )}

      {/* Drag indicator */}
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
        <svg 
          className="w-3 h-3 text-white" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" 
          />
        </svg>
      </div>
    </div>
  );
}