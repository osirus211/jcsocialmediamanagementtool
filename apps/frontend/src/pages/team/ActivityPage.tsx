/**
 * Activity Page
 * 
 * Full page for team activity feed with admin controls
 */

import React, { useEffect, useState } from 'react';
import { ActivityStatsBar } from '../../components/activity/ActivityStatsBar';
import { ActivityFeed } from '../../components/activity/ActivityFeed';
import { useWorkspaceStore } from '../../store/workspace.store';

export const ActivityPage: React.FC = () => {
  const { currentWorkspace } = useWorkspaceStore();
  const [hasAdminAccess, setHasAdminAccess] = useState(false);

  useEffect(() => {
    // Check if user has admin access (admin or owner)
    if (currentWorkspace && (currentWorkspace.userRole === 'admin' || currentWorkspace.userRole === 'owner')) {
      setHasAdminAccess(true);
    }
  }, [currentWorkspace]);

  if (!hasAdminAccess) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔒</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Admin Access Required
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Only workspace admins and owners can view the full activity audit log.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Team Activity Audit Log
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Complete audit trail of all workspace activities and security events
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Admin View</span>
          </div>
        </div>
      </div>

      {/* Activity Stats */}
      <div className="mb-8">
        <ActivityStatsBar />
      </div>

      {/* Activity Feed */}
      <div>
        <ActivityFeed />
      </div>
    </div>
  );
};