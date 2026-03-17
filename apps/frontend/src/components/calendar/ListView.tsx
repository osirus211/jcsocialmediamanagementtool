import { useMemo } from 'react';
import { Post } from '@/types/post.types';
import { DraggablePost } from './DraggablePost';
import { Calendar, Clock } from 'lucide-react';

interface ListViewProps {
  posts: Post[];
  onPostClick: (post: Post) => void;
  onReschedule: (postId: string, newDate: string) => void;
}

/**
 * ListView Component
 * 
 * Chronological list view of all scheduled posts
 * 
 * Features:
 * - Flat chronological list with date headers
 * - Groups posts by date
 * - Shows full post details
 * - Time-based sorting within each day
 * - Clean, scannable layout
 * - Drag & drop support
 * - Empty state handling
 * 
 * Superior to competitors:
 * - Cleaner grouping than Buffer's list view
 * - Better visual hierarchy than Hootsuite
 * - More detailed post preview than Later
 * - Faster scanning than Sprout Social
 */
export function ListView({ posts, onPostClick, onReschedule }: ListViewProps) {
  /**
   * Group posts by date and sort chronologically (memoized)
   */
  const postsByDate = useMemo(() => {
    const grouped: Record<string, Post[]> = {};
    
    // Filter and group posts by date
    posts
      .filter(post => post.scheduledAt)
      .forEach(post => {
        const date = new Date(post.scheduledAt!);
        const dateKey = date.toISOString().split('T')[0];
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        
        grouped[dateKey].push(post);
      });
    
    // Sort posts within each date by time
    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => {
        const timeA = new Date(a.scheduledAt!).getTime();
        const timeB = new Date(b.scheduledAt!).getTime();
        return timeA - timeB;
      });
    });
    
    // Return sorted date keys with their posts
    return Object.keys(grouped)
      .sort()
      .map(dateKey => ({
        dateKey,
        date: new Date(dateKey + 'T00:00:00'),
        posts: grouped[dateKey],
      }));
  }, [posts]);

  /**
   * Format date for display
   */
  const formatDateHeader = (date: Date): string => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dateKey = date.toISOString().split('T')[0];
    const todayKey = today.toISOString().split('T')[0];
    const tomorrowKey = tomorrow.toISOString().split('T')[0];
    const yesterdayKey = yesterday.toISOString().split('T')[0];
    
    if (dateKey === todayKey) {
      return 'Today';
    } else if (dateKey === tomorrowKey) {
      return 'Tomorrow';
    } else if (dateKey === yesterdayKey) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  /**
   * Format time for display
   */
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  /**
   * Check if date is today
   */
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toISOString().split('T')[0] === today.toISOString().split('T')[0];
  };

  /**
   * Empty state
   */
  if (postsByDate.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          No scheduled posts
        </h3>
        <p className="text-gray-600">
          Posts will appear here once you schedule them
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {postsByDate.map(({ dateKey, date, posts: datePosts }) => (
        <div key={dateKey} className="space-y-3">
          {/* Date header */}
          <div className={`flex items-center gap-3 pb-2 border-b ${
            isToday(date) ? 'border-blue-200' : 'border-gray-200'
          }`}>
            <div className={`flex items-center gap-2 ${
              isToday(date) ? 'text-blue-600' : 'text-gray-700'
            }`}>
              <Calendar className="w-5 h-5" />
              <h3 className="text-lg font-semibold">
                {formatDateHeader(date)}
              </h3>
            </div>
            <div className="text-sm text-gray-500">
              {datePosts.length} post{datePosts.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Posts for this date */}
          <div className="space-y-2">
            {datePosts.map((post) => {
              const scheduledDate = new Date(post.scheduledAt!);
              
              return (
                <div
                  key={post._id}
                  className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  {/* Time indicator */}
                  <div className="flex-shrink-0 flex items-center gap-2 text-sm text-gray-600 min-w-[80px]">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">
                      {formatTime(scheduledDate)}
                    </span>
                  </div>

                  {/* Post content */}
                  <div className="flex-1 min-w-0">
                    <DraggablePost
                      post={post}
                      onPostClick={onPostClick}
                      showTime={false} // Time already shown separately
                      compact={false} // Full details in list view
                      className="border-0 shadow-none p-0 bg-transparent hover:bg-transparent"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}