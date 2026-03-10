/**
 * Activity Page
 * 
 * Full page for team activity feed
 */

import React from 'react';
import { ActivityStatsBar } from '../../components/activity/ActivityStatsBar';
import { ActivityFeed } from '../../components/activity/ActivityFeed';

export const ActivityPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Team Activity
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Track what your team is doing across the workspace
        </p>
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