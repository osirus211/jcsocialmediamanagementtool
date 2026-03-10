import { useMemo, useCallback, useState } from 'react';
import { Post } from '@/types/post.types';
import { DayCell } from './DayCell';

interface MonthGridProps {
  currentMonth: Date;
  posts: Post[];
  onPostClick: (post: Post) => void;
  onReschedule: (postId: string, newDate: string) => void;
}

/**
 * MonthGrid Component
 * 
 * Renders calendar month view with drag & drop
 * 
 * Features:
 * - 7x6 grid (weeks x days)
 * - Groups posts by date
 * - Drag & drop reschedule
 * - Click post to edit
 * - Highlights today
 * 
 * Performance:
 * - Memoized day cells
 * - Efficient post grouping
 * - Minimal re-renders
 */
export function MonthGrid({
  currentMonth,
  posts,
  onPostClick,
  onReschedule,
}: MonthGridProps) {
  /**
   * Group posts by date (memoized)
   */
  const postsByDate = useMemo(() => {
    const grouped: Record<string, Post[]> = {};
    
    posts.forEach((post) => {
      if (post.scheduledAt) {
        const dateKey = new Date(post.scheduledAt).toISOString().split('T')[0];
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(post);
      }
    });
    
    // Sort posts within each day by time
    Object.keys(grouped).forEach((dateKey) => {
      grouped[dateKey].sort((a, b) => {
        const timeA = new Date(a.scheduledAt!).getTime();
        const timeB = new Date(b.scheduledAt!).getTime();
        return timeA - timeB;
      });
    });
    
    return grouped;
  }, [posts]);

  /**
   * Generate calendar days (memoized)
   */
  const days = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const result: Array<{
      day: number | null;
      dateKey: string;
      isToday: boolean;
    }> = [];

    // Padding days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      result.push({
        day: null,
        dateKey: '',
        isToday: false,
      });
    }

    // Days in month
    const today = new Date().toISOString().split('T')[0];
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      result.push({
        day: i,
        dateKey,
        isToday: dateKey === today,
      });
    }

    return result;
  }, [currentMonth]);

  /**
   * Drag & drop handlers
   */
  const [draggedPost, setDraggedPost] = useState<Post | null>(null);

  const handleDragStart = useCallback((post: Post, e: React.DragEvent) => {
    setDraggedPost(post);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((dateKey: string, e: React.DragEvent) => {
    e.preventDefault();
    
    if (!draggedPost || !dateKey) {
      return;
    }
    
    // Get time from original scheduledAt
    const originalDate = new Date(draggedPost.scheduledAt!);
    const hours = originalDate.getHours();
    const minutes = originalDate.getMinutes();
    
    // Create new date with same time
    const [year, month, day] = dateKey.split('-').map(Number);
    const newDate = new Date(year, month - 1, day, hours, minutes);
    
    // Call reschedule
    onReschedule(draggedPost._id, newDate.toISOString());
    
    setDraggedPost(null);
  }, [draggedPost, onReschedule]);

  return (
    <div className="grid grid-cols-7 gap-2">
      {/* Day headers */}
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
        <div
          key={dayName}
          className="text-center font-semibold text-gray-600 py-2 text-sm"
        >
          {dayName}
        </div>
      ))}

      {/* Calendar days */}
      {days.map((dayInfo, index) => (
        <DayCell
          key={dayInfo.dateKey || `empty-${index}`}
          day={dayInfo.day}
          dateKey={dayInfo.dateKey}
          posts={postsByDate[dayInfo.dateKey] || []}
          isToday={dayInfo.isToday}
          onPostClick={onPostClick}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}
