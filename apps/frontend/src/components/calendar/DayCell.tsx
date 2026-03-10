import { memo, useState, useEffect } from 'react';
import { Post } from '@/types/post.types';
import { StatusBadge } from '@/components/posts/StatusBadge';
import { MemberAvatarStack } from './MemberAvatarStack';
import { postCommentsService } from '@/services/post-comments.service';

interface DayCellProps {
  day: number | null;
  dateKey: string;
  posts: Post[];
  isToday: boolean;
  onPostClick: (post: Post) => void;
  onDragStart: (post: Post, e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (dateKey: string, e: React.DragEvent) => void;
}

/**
 * PostItem Component for calendar day cells
 */
const PostItem = memo(function PostItem({ 
  post, 
  onPostClick, 
  onDragStart 
}: { 
  post: Post; 
  onPostClick: (post: Post) => void; 
  onDragStart: (post: Post, e: React.DragEvent) => void; 
}) {
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    const loadCommentCount = async () => {
      try {
        const comments = await postCommentsService.getComments(post._id);
        const totalCount = comments.reduce((count, comment) => {
          return count + 1 + (comment.replies?.length || 0);
        }, 0);
        setCommentCount(totalCount);
      } catch (error) {
        // Silently fail
      }
    };

    loadCommentCount();
  }, [post._id]);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(post, e)}
      onClick={() => onPostClick(post)}
      className="text-xs truncate cursor-pointer hover:bg-white rounded px-1 py-0.5 border border-transparent hover:border-gray-300 transition-all"
      title={post.content}
    >
      <div className="flex items-center gap-1">
        <StatusBadge status={post.status} />
        <span className="truncate flex-1">{post.content}</span>
        {commentCount > 0 && (
          <span className="text-blue-600 font-medium">💬{commentCount}</span>
        )}
      </div>
    </div>
  );
});

/**
 * DayCell Component
 * 
 * Renders a single day in the calendar grid
 * 
 * Features:
 * - Shows day number
 * - Lists posts for that day
 * - Drag & drop support
 * - Click to edit post
 * - Visual indicators (today, has posts)
 * 
 * Performance:
 * - Memoized to prevent unnecessary re-renders
 * - Only re-renders when props change
 */
export const DayCell = memo(function DayCell({
  day,
  dateKey,
  posts,
  isToday,
  onPostClick,
  onDragStart,
  onDragOver,
  onDrop,
}: DayCellProps) {
  // Empty cell (padding days)
  if (!day) {
    return <div className="aspect-square" />;
  }

  const hasPosts = posts.length > 0;
  const visiblePosts = posts.slice(0, 3);
  const hiddenCount = posts.length - 3;

  return (
    <div
      className={`aspect-square border rounded-lg p-2 transition-colors flex flex-col ${
        isToday
          ? 'bg-blue-50 border-blue-300'
          : hasPosts
          ? 'bg-gray-50 border-gray-300'
          : 'border-gray-200'
      }`}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(dateKey, e)}
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
          <PostItem
            key={post._id}
            post={post}
            onPostClick={onPostClick}
            onDragStart={onDragStart}
          />
        ))}

        {/* Show count of hidden posts */}
        {hiddenCount > 0 && (
          <div className="text-xs text-gray-500 px-1">
            +{hiddenCount} more
          </div>
        )}
      </div>

      {/* Member avatar stack - only show if multiple members have posts */}
      <MemberAvatarStack posts={posts} />
    </div>
  );
});
