/**
 * Activity Feed Component
 * 
 * Full activity feed with filtering, pagination, and auto-refresh
 */

import React, { useState, useEffect } from 'react';
// import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { ActivityFeedItem } from './ActivityFeedItem';
import { activityService, ActivityItem, ActivityFilters } from '../../services/activity.service';
// import { toast } from 'react-hot-toast';

export const ActivityFeed: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<ActivityFilters>({ page: 1, limit: 20 });
  const [hasMore, setHasMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchActivities = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setActivities([]);
      }

      const response = await activityService.getActivityFeed({
        ...filters,
        page: reset ? 1 : filters.page,
      });

      if (reset) {
        setActivities(response.activities);
      } else {
        setActivities(prev => [...prev, ...response.activities]);
      }

      setHasMore(response.pagination.hasNext);
      setFilters(prev => ({ ...prev, page: reset ? 1 : prev.page }));
    } catch (error) {
      console.error('Failed to load activity feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }));
  };

  const handleFilterChange = (newFilters: Partial<ActivityFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ page: 1, limit: 20 });
    setShowFilters(false);
  };

  // Initial load
  useEffect(() => {
    fetchActivities(true);
  }, []);

  // Load more when page changes
  useEffect(() => {
    if (filters.page && filters.page > 1) {
      fetchActivities(false);
    }
  }, [filters.page]);

  // Reload when filters change (except page)
  useEffect(() => {
    const { page, ...otherFilters } = filters;
    if (Object.keys(otherFilters).some(key => otherFilters[key as keyof typeof otherFilters])) {
      fetchActivities(true);
    }
  }, [filters.action, filters.resourceType, filters.userId, filters.startDate, filters.endDate]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !loadingMore) {
        fetchActivities(true);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [loading, loadingMore]);

  const groupActivitiesByDate = (activities: ActivityItem[]) => {
    const groups: Record<string, ActivityItem[]> = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    activities.forEach(activity => {
      const activityDate = new Date(activity.createdAt);
      let groupKey: string;

      if (activityDate.toDateString() === today.toDateString()) {
        groupKey = 'Today';
      } else if (activityDate.toDateString() === yesterday.toDateString()) {
        groupKey = 'Yesterday';
      } else {
        groupKey = activityDate.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric',
          year: activityDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined 
        });
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(activity);
    });

    return groups;
  };

  const activityGroups = groupActivitiesByDate(activities);

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Loading skeleton */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start space-x-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
            <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <span>Filters</span>
            <span className={`inline-block w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          
          {(filters.action || filters.resourceType || filters.startDate) && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Clear filters
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Action Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Action Type
              </label>
              <select
                value={filters.action || ''}
                onChange={(e) => handleFilterChange({ action: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All actions</option>
                <option value="post_created">Post created</option>
                <option value="post_published">Post published</option>
                <option value="post_approved">Post approved</option>
                <option value="member_invited">Member invited</option>
                <option value="account_connected">Account connected</option>
              </select>
            </div>

            {/* Resource Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resource Type
              </label>
              <select
                value={filters.resourceType || ''}
                onChange={(e) => handleFilterChange({ resourceType: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All resources</option>
                <option value="ScheduledPost">Posts</option>
                <option value="WorkspaceMember">Members</option>
                <option value="SocialAccount">Social Accounts</option>
                <option value="Media">Media</option>
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Range
              </label>
              <select
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    handleFilterChange({ startDate: undefined, endDate: undefined });
                  } else {
                    const days = parseInt(value);
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - days);
                    handleFilterChange({ 
                      startDate: startDate.toISOString(),
                      endDate: new Date().toISOString()
                    });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All time</option>
                <option value="1">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Activity Groups */}
      {Object.keys(activityGroups).length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No activity yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Team activity will appear here as members create posts, invite others, and more.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(activityGroups).map(([date, groupActivities]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 sticky top-0 bg-gray-50 dark:bg-gray-900 py-2">
                {date}
              </h3>
              <div className="space-y-2">
                {groupActivities.map((activity) => (
                  <ActivityFeedItem
                    key={activity._id}
                    activity={activity}
                    onClick={(activity) => {
                      // Navigate to resource if applicable
                      if (activity.resourceType === 'ScheduledPost' && activity.resourceId) {
                        window.location.href = `/posts`;
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  'Load more'
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};