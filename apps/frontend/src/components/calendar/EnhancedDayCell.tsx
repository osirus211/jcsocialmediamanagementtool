import { memo } from 'react';
import { Post } from '@/types/post.types';
import { DroppableZone } from './DroppableZone';
import { DraggablePost } from './DraggablePost';
import { MemberAvatarStack } from './MemberAvatarStack';

interface EnhancedDayCellProps {
  day: number | null;
  dateKey: string;
  posts: Post[];
  isToday: boolean;
  onPostClick: (post: Post) => void;
}

/**
 * EnhancedDayCell Component
 * 
 * Enhanced day cell with professional drag & drop
 * 
 * Features:
 * - @dnd-kit integration
 * - Visual drop feedback
 * - Draggable post cards
 * - Member avatars
 * - Today highlighting
 * - Empty state handling
 * 
 * Performance:
 * - Memoized to prevent unnecessary re-renders
 * - Only re-renders when props change
 * 
 * Superior to competitors:
 * - Better visual feedback than Buffer
 * - Larger drop zones than Hootsuite
 * - Smoother animations than Later
 */
export const EnhancedDayCell = memo(function EnhancedDayCell({
  day,
  dateKey,
  posts,
  isToday,
  onPostClick,
}: EnhancedDayCellProps) {
  // Empty cell (padding days)
  if (!day) {
    return <div className="aspect-square" />;
  }

  const hasPosts = posts.length > 0;
  const visiblePosts = posts.slice(0, 3);
  const hiddenCount = posts.length - 3;

  return (
    <DroppableZone
      id={`day-${dateKey}`}
      dateKey={dateKey}
      isToday={isToday}
      isEmpty={!hasPosts}
      className={`
        aspect-square border rounded-lg p-2 transition-colors flex flex-col
        ${isToday
          ? 'border-blue-300'
          : hasPosts
          ? 'border-gray-300'
          : 'border-gray-200'
        }
      `}
    >
      {/* Day number */}
      <div
        className={`text-sm font-semibold mb-1 ${
          isToday ? 'text-blue-600' : 'text-gray-700'
        }`}
      >
        {day}
      </div>

      {/* Posts list */}
      <div className="space-y-1 overflow-hidden flex-1">
        {visiblePosts.map((post) => (
          <DraggablePost
            key={post._id}
            post={post}
            onPostClick={onPostClick}
            compact={true}
          />
        ))}

        {/* Show count of hidden posts */}
        {hiddenCount > 0 && (
          <div className="text-xs text-gray-500 px-1 py-0.5 bg-gray-100 rounded text-center">
            +{hiddenCount} more
          </div>
        )}
      </div>

      {/* Member avatar stack - only show if multiple members have posts */}
      <MemberAvatarStack posts={posts} />
    </DroppableZone>
  );
});