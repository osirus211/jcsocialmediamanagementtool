import { useDraggable } from '@dnd-kit/core';
import { Post } from '@/types/post.types';
import { StatusBadge } from '@/components/posts/StatusBadge';
import { getPlatformIcon } from '@/lib/platform-utils';
import { GripVertical } from 'lucide-react';

interface DraggablePostProps {
  post: Post;
  onPostClick: (post: Post) => void;
  showTime?: boolean;
  compact?: boolean;
}

/**
 * DraggablePost Component
 * 
 * Individual draggable post card for calendar
 * 
 * Features:
 * - @dnd-kit integration
 * - Visual drag handle
 * - Platform icons
 * - Status indicators
 * - Hover effects
 * - Touch-friendly sizing
 * 
 * Superior design:
 * - Cleaner than Buffer's cards
 * - More informative than Hootsuite
 * - Better touch targets than Later
 */
export function DraggablePost({ 
  post, 
  onPostClick, 
  showTime = false,
  compact = false 
}: DraggablePostProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: post._id,
    data: {
      post,
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const time = showTime && post.scheduledAt 
    ? new Date(post.scheduledAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const platformIcon = getPlatformIcon(post.socialAccountId || 'unknown');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative bg-white border rounded-lg transition-all duration-200 cursor-pointer
        ${isDragging 
          ? 'opacity-50 shadow-lg scale-105 z-10' 
          : 'hover:shadow-md hover:border-gray-300'
        }
        ${compact ? 'p-2' : 'p-3'}
      `}
      onClick={() => onPostClick(post)}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className={`
          absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity
          p-1 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing
          ${isDragging ? 'opacity-100' : ''}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <StatusBadge status={post.status} />
        {time && (
          <span className="text-xs text-gray-500">{time}</span>
        )}
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
      <div className={`text-sm text-gray-800 ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
        {post.content}
      </div>

      {/* Media indicator */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
          <span>📷</span>
          <span>{post.mediaUrls.length}</span>
        </div>
      )}

      {/* Comments indicator - removed since not in Post type */}
    </div>
  );
}