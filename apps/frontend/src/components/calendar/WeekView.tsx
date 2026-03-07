import { useMemo } from 'react';
import { Post } from '@/types/post.types';
import { StatusBadge } from '@/components/posts/StatusBadge';

interface WeekViewProps {
  currentWeek: Date; // Start of week (Sunday)
  posts: Post[];
  onPostClick: (post: Post) => void;
}

/**
 * WeekView Component
 * 
 * Renders calendar week view with hourly slots
 * 
 * Features:
 * - 7 days horizontal
 * - Hourly time slots vertical
 * - Shows post time
 * - Click to edit
 * 
 * Performance:
 * - Memoized post grouping
 * - Efficient rendering
 */
export function WeekView({ currentWeek, posts, onPostClick }: WeekViewProps) {
  /**
   * Generate week days (memoized)
   */
  const weekDays = useMemo(() => {
    const days: Array<{
      date: Date;
      dateKey: string;
      dayName: string;
      isToday: boolean;
    }> = [];
    
    const today = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeek);
      date.setDate(date.getDate() + i);
      
      const dateKey = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      days.push({
        date,
        dateKey,
        dayName,
        isToday: dateKey === today,
      });
    }
    
    return days;
  }, [currentWeek]);

  /**
   * Group posts by date and hour (memoized)
   */
  const postsByDateAndHour = useMemo(() => {
    const grouped: Record<string, Record<number, Post[]>> = {};
    
    posts.forEach((post) => {
      if (post.scheduledAt) {
        const date = new Date(post.scheduledAt);
        const dateKey = date.toISOString().split('T')[0];
        const hour = date.getHours();
        
        if (!grouped[dateKey]) {
          grouped[dateKey] = {};
        }
        if (!grouped[dateKey][hour]) {
          grouped[dateKey][hour] = [];
        }
        
        grouped[dateKey][hour].push(post);
      }
    });
    
    return grouped;
  }, [posts]);

  /**
   * Business hours (9 AM - 6 PM)
   */
  const hours = Array.from({ length: 10 }, (_, i) => i + 9);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header with days */}
        <div className="grid grid-cols-8 gap-2 mb-2">
          <div className="text-sm font-semibold text-gray-600">Time</div>
          {weekDays.map((day) => (
            <div
              key={day.dateKey}
              className={`text-center ${
                day.isToday ? 'text-blue-600 font-bold' : 'text-gray-700'
              }`}
            >
              <div className="text-sm font-semibold">{day.dayName}</div>
              <div className="text-xs">{day.date.getDate()}</div>
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className="space-y-1">
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 gap-2">
              {/* Hour label */}
              <div className="text-xs text-gray-500 py-2">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>

              {/* Day cells */}
              {weekDays.map((day) => {
                const dayPosts = postsByDateAndHour[day.dateKey]?.[hour] || [];
                
                return (
                  <div
                    key={day.dateKey}
                    className={`min-h-[60px] border rounded p-1 ${
                      day.isToday ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {dayPosts.map((post) => {
                      const time = new Date(post.scheduledAt!).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      });
                      
                      return (
                        <div
                          key={post._id}
                          onClick={() => onPostClick(post)}
                          className="text-xs cursor-pointer hover:bg-white rounded p-1 mb-1 border border-transparent hover:border-gray-300 transition-all"
                          title={post.content}
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            <StatusBadge status={post.status} />
                            <span className="text-gray-500">{time}</span>
                          </div>
                          <div className="truncate">{post.content}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
