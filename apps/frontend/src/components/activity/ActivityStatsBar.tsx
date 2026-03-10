/**
 * Activity Stats Bar Component
 * 
 * Compact stats row showing key activity metrics
 */

import React, { useState, useEffect } from 'react';
import { activityService, ActivityStats } from '../../services/activity.service';
import { approvalsService } from '../../services/approvals.service';
// import { toast } from 'react-hot-toast';

export const ActivityStatsBar: React.FC = () => {
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const [activityStats, approvalCount] = await Promise.all([
        activityService.getActivityStats(),
        approvalsService.getApprovalCount(),
      ]);
      
      setStats(activityStats);
      setPendingApprovals(approvalCount);
    } catch (error) {
      console.error('Failed to load activity stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const postsPublishedToday = stats.byType['post_published'] || 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Actions This Week */}
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total Actions (7 days)
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {stats.totalActions}
          </p>
        </div>

        {/* Posts Published Today */}
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Posts Published Today
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {postsPublishedToday}
          </p>
        </div>

        {/* Most Active Team Member */}
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Most Active Member
          </p>
          {stats.mostActiveUser ? (
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {stats.mostActiveUser.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {stats.mostActiveUser.count} actions
              </p>
            </div>
          ) : (
            <p className="text-lg font-semibold text-gray-500 dark:text-gray-400">
              No activity
            </p>
          )}
        </div>

        {/* Pending Approvals */}
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Pending Approvals
          </p>
          <div className="flex items-center space-x-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {pendingApprovals}
            </p>
            {pendingApprovals > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                Action needed
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};