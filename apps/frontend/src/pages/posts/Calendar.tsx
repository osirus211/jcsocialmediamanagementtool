import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useScheduleStore } from '@/store/schedule.store';
import { useCalendarData } from '@/hooks/useCalendarData';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { WeekView } from '@/components/calendar/WeekView';
import { ListView } from '@/components/calendar/ListView';
import { DragDropProvider } from '@/components/calendar/DragDropProvider';
import { Post } from '@/types/post.types';
import { AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { logger } from '@/lib/logger';

type ViewMode = 'month' | 'week' | 'list';

/**
 * CalendarPage Component
 * 
 * Production-grade calendar view for scheduled posts
 * 
 * Features:
 * - Monthly view (primary)
 * - Weekly view (secondary)
 * - Lazy-load by date range
 * - Drag & drop reschedule
 * - Click post to edit
 * - Status indicators
 * - Timezone handling (user local time)
 * - Performance optimized
 * 
 * Safety:
 * - Only fetches visible range
 * - Caches fetched data
 * - Optimistic updates
 * - Rollback on failure
 * - No backend modifications
 */
export const CalendarPage = () => {
  const navigate = useNavigate();
  const { currentWorkspace, currentWorkspaceId, fetchMembers } = useWorkspaceStore();
  const {
    setCalendarView,
    setCalendarMonth,
    setActiveFilters,
    reschedulePost: storeReschedulePost,
  } = useScheduleStore();
  
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(() => {
    // Get start of current week (Sunday)
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    return new Date(now.setDate(diff));
  });

  const {
    posts,
    allPosts,
    selectedMemberIds,
    platformCounts,
    activePlatforms,
    activeAccountIds,
    hasActiveFilters,
    isLoading,
    error,
    fetchPostsByRange,
    filterByMembers,
    setActivePlatforms,
    setActiveAccountIds,
    togglePlatform,
    toggleAccountId,
    clearAllFilters,
    reschedulePost,
    clearError,
  } = useCalendarData();

  /**
   * Calculate date range for current view
   */
  const dateRange = useMemo(() => {
    if (viewMode === 'month') {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      // Start: first day of month
      const from = new Date(year, month, 1);
      
      // End: last day of month
      const to = new Date(year, month + 1, 0);
      
      return {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
      };
    } else if (viewMode === 'week') {
      // Week view: 7 days starting from currentWeek
      const from = new Date(currentWeek);
      const to = new Date(currentWeek);
      to.setDate(to.getDate() + 6);
      
      return {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
      };
    } else {
      // List view: Show wider range (3 months)
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      
      return {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
      };
    }
  }, [viewMode, currentMonth, currentWeek]);

  /**
   * Filter posts by search query
   */
  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) {
      return posts;
    }

    const query = searchQuery.toLowerCase().trim();
    return posts.filter(post => {
      // Search in content
      if (post.content.toLowerCase().includes(query)) {
        return true;
      }
      
      // Search in hashtags
      if (post.metadata?.hashtags?.some(tag => tag.toLowerCase().includes(query))) {
        return true;
      }
      
      // Search in mentions
      if (post.metadata?.mentions?.some(mention => mention.toLowerCase().includes(query))) {
        return true;
      }
      
      // Search in platform
      if (typeof post.socialAccountId === 'string' && post.socialAccountId.toLowerCase().includes(query)) {
        return true;
      }
      
      return false;
    });
  }, [posts, searchQuery]);

  /**
   * Fetch posts when date range changes
   */
  useEffect(() => {
    if (currentWorkspace) {
      fetchPostsByRange(dateRange);
    }
  }, [currentWorkspace, dateRange, fetchPostsByRange]);

  /**
   * Fetch workspace members on mount
   */
  useEffect(() => {
    if (currentWorkspaceId) {
      fetchMembers(currentWorkspaceId);
    }
  }, [currentWorkspaceId, fetchMembers]);

  /**
   * Navigation handlers
   */
  const previousMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const year = prev.getFullYear();
      const month = prev.getMonth();
      const newMonth = new Date(year, month - 1, 1);
      setCalendarMonth(newMonth);
      return newMonth;
    });
  }, [setCalendarMonth]);

  const nextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const year = prev.getFullYear();
      const month = prev.getMonth();
      const newMonth = new Date(year, month + 1, 1);
      setCalendarMonth(newMonth);
      return newMonth;
    });
  }, [setCalendarMonth]);

  const previousWeek = useCallback(() => {
    setCurrentWeek((prev) => {
      const newWeek = new Date(prev);
      newWeek.setDate(newWeek.getDate() - 7);
      return newWeek;
    });
  }, []);

  const nextWeek = useCallback(() => {
    setCurrentWeek((prev) => {
      const newWeek = new Date(prev);
      newWeek.setDate(newWeek.getDate() + 7);
      return newWeek;
    });
  }, []);

  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    
    // Set week to start of current week
    const day = now.getDay();
    const diff = now.getDate() - day;
    setCurrentWeek(new Date(now.setDate(diff)));
  }, []);

  /**
   * Swipe gesture handlers for mobile navigation
   */
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: () => {
      if (viewMode === 'month') {
        nextMonth();
      } else if (viewMode === 'week') {
        nextWeek();
      }
    },
    onSwipeRight: () => {
      if (viewMode === 'month') {
        previousMonth();
      } else if (viewMode === 'week') {
        previousWeek();
      }
    },
    minSwipeDistance: 50,
  });

  /**
   * Keyboard navigation
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard shortcuts when not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (viewMode === 'month') {
            previousMonth();
          } else if (viewMode === 'week') {
            previousWeek();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (viewMode === 'month') {
            nextMonth();
          } else if (viewMode === 'week') {
            nextWeek();
          }
          break;
        case 't':
        case 'T':
          e.preventDefault();
          goToToday();
          break;
        case '1':
          e.preventDefault();
          setViewMode('month');
          setCalendarView('month');
          break;
        case '2':
          e.preventDefault();
          setViewMode('week');
          setCalendarView('week');
          break;
        case '3':
          e.preventDefault();
          setViewMode('list');
          setCalendarView('list');
          break;
        case '/':
          e.preventDefault();
          // Focus search input
          const searchInput = document.querySelector('input[placeholder="Search posts..."]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          }
          break;
        case 'Escape':
          e.preventDefault();
          // Clear search if active
          if (searchQuery) {
            setSearchQuery('');
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, searchQuery, previousMonth, nextMonth, previousWeek, nextWeek, goToToday, setCalendarView]);

  /**
   * Post click handler - navigate to composer with post ID
   */
  const handlePostClick = useCallback((post: Post) => {
    navigate(`/posts/create?draftId=${post._id}`);
  }, [navigate]);

  /**
   * Reschedule handler
   */
  const handleReschedule = useCallback(async (postId: string, newDate: string): Promise<boolean> => {
    if (!currentWorkspaceId) return false;
    
    const success = await reschedulePost(postId, newDate);
    
    if (success) {
      // Also update store
      try {
        await storeReschedulePost(currentWorkspaceId, postId, new Date(newDate));
      } catch (error) {
        logger.warn('Failed to update store after reschedule', error);
      }
      logger.info('Post rescheduled successfully');
    }
    
    return success;
  }, [currentWorkspaceId, reschedulePost, storeReschedulePost]);

  /**
   * Empty state check
   */
  const isEmpty = !isLoading && filteredPosts.length === 0;

  if (!currentWorkspace) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">
          Please select a workspace first
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" {...swipeHandlers}>
      <div className="max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-bold">Calendar</h1>
            <p className="text-gray-600 mt-1">
              View and manage scheduled posts for {currentWorkspace.name}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
              <button
                onClick={clearError}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Calendar Header with filters */}
        <CalendarHeader
          viewMode={viewMode}
          onViewModeChange={(mode) => {
            setViewMode(mode);
            setCalendarView(mode);
          }}
          selectedMemberIds={selectedMemberIds}
          onFilterByMembers={filterByMembers}
          postCount={posts.length}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activePlatforms={activePlatforms}
          activeAccountIds={activeAccountIds}
          platformCounts={platformCounts}
          hasActiveFilters={hasActiveFilters}
          onTogglePlatform={togglePlatform}
          onToggleAccountId={(accountId) => {
            toggleAccountId(accountId);
            setActiveFilters({
              platforms: activePlatforms,
              accountIds: activeAccountIds.includes(accountId)
                ? activeAccountIds.filter(id => id !== accountId)
                : [...activeAccountIds, accountId],
            });
          }}
          onClearAllFilters={clearAllFilters}
        />

        <div className="flex-1 p-6">
          {/* Keyboard shortcuts help */}
          <div className="fixed bottom-4 right-4 z-40">
            <div className="bg-gray-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg opacity-75 hover:opacity-100 transition-opacity">
              <div className="space-y-1">
                <div><kbd className="bg-gray-700 px-1 rounded">←/→</kbd> Navigate</div>
                <div><kbd className="bg-gray-700 px-1 rounded">T</kbd> Today</div>
                <div><kbd className="bg-gray-700 px-1 rounded">1/2/3</kbd> Views</div>
                <div><kbd className="bg-gray-700 px-1 rounded">/</kbd> Search</div>
              </div>
            </div>
          </div>

          {/* Navigation - only show for Month and Week views */}
          {viewMode !== 'list' && (
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={viewMode === 'month' ? previousMonth : previousWeek}
                className="px-3 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Previous
              </button>
              
              <button
                onClick={goToToday}
                className="px-3 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Today
              </button>
              
              <h2 className="text-xl font-semibold min-w-[200px] text-center">
                {viewMode === 'month'
                  ? currentMonth.toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })
                  : `${currentWeek.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })} - ${new Date(
                      currentWeek.getTime() + 6 * 24 * 60 * 60 * 1000
                    ).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}`}
              </h2>
              
              <button
                onClick={viewMode === 'month' ? nextMonth : nextWeek}
                className="px-3 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Next →
              </button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading posts...</p>
            </div>
          )}

          {/* Empty state */}
          {isEmpty && (
            <div className="text-center py-12">
              <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                {searchQuery ? 'No posts found' : 'No scheduled posts'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchQuery 
                  ? `No posts match "${searchQuery}". Try a different search term.`
                  : 'Create your first post to see it on the calendar'
                }
              </p>
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Clear Search
                </button>
              ) : (
                <button
                  onClick={() => navigate('/posts/create')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Post
                </button>
              )}
            </div>
          )}

          {/* Calendar views with drag & drop */}
          {!isLoading && !isEmpty && (
            <DragDropProvider onReschedule={handleReschedule}>
              {viewMode === 'month' ? (
                <MonthGrid
                  currentMonth={currentMonth}
                  posts={filteredPosts}
                  onPostClick={handlePostClick}
                  onReschedule={handleReschedule}
                />
              ) : viewMode === 'week' ? (
                <WeekView
                  currentWeek={currentWeek}
                  posts={filteredPosts}
                  onPostClick={handlePostClick}
                  onReschedule={handleReschedule}
                />
              ) : (
                <ListView
                  posts={filteredPosts}
                  onPostClick={handlePostClick}
                  onReschedule={handleReschedule}
                />
              )}
            </DragDropProvider>
          )}
        </div>
      </div>
    </div>
  );
}
