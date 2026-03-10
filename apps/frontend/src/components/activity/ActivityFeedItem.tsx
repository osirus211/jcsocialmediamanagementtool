/**
 * Activity Feed Item Component
 * 
 * Single activity entry with icon, description, and timestamp
 */

import React from 'react';
// import { formatDistanceToNow } from 'date-fns';
import { ActivityIcon } from './ActivityIcon';
import { ActivityItem } from '../../services/activity.service';

interface ActivityFeedItemProps {
  activity: ActivityItem;
  onClick?: (activity: ActivityItem) => void;
}

export const ActivityFeedItem: React.FC<ActivityFeedItemProps> = ({ activity, onClick }) => {
  const getActionDescription = (action: string, details?: Record<string, unknown>) => {
    switch (action) {
      // Post actions
      case 'post_created':
        return 'created a draft post';
      case 'post_updated':
        return 'updated a post';
      case 'post_published':
        const platform = details?.platform as string;
        return platform ? `published a post to ${platform}` : 'published a post';
      case 'post_deleted':
        return 'deleted a post';
      case 'post_failed':
        return 'had a post fail to publish';
      case 'post_submitted_for_approval':
        return 'submitted a post for approval';
      case 'post_approved':
        return 'approved a post';
      case 'post_rejected':
        return 'rejected a post';
      
      // Member actions
      case 'member_invited':
        const email = details?.email as string;
        return email ? `invited ${email} to the workspace` : 'invited someone to the workspace';
      case 'member_joined':
        return 'joined the workspace';
      case 'member_removed':
        const removedMember = details?.memberName as string;
        return removedMember ? `removed ${removedMember} from the workspace` : 'removed a member from the workspace';
      case 'member_role_changed':
        const newRole = details?.newRole as string;
        const memberName = details?.memberName as string;
        if (newRole && memberName) {
          return `changed ${memberName}'s role to ${newRole}`;
        }
        return 'changed a member\'s role';
      
      // Social account actions
      case 'account_connected':
        const connectedPlatform = details?.platform as string;
        return connectedPlatform ? `connected ${connectedPlatform} account` : 'connected a social account';
      case 'account_disconnected':
        const disconnectedPlatform = details?.platform as string;
        return disconnectedPlatform ? `disconnected ${disconnectedPlatform} account` : 'disconnected a social account';
      case 'account_reconnected':
        const reconnectedPlatform = details?.platform as string;
        return reconnectedPlatform ? `reconnected ${reconnectedPlatform} account` : 'reconnected a social account';
      
      // Workspace actions
      case 'workspace_created':
        return 'created the workspace';
      case 'workspace_updated':
        return 'updated workspace settings';
      case 'workspace_deleted':
        return 'deleted the workspace';
      case 'workspace_plan_changed':
        const newPlan = details?.newPlan as string;
        return newPlan ? `changed workspace plan to ${newPlan}` : 'changed workspace plan';
      
      // Media actions
      case 'media_uploaded':
        return 'uploaded media';
      case 'media_deleted':
        return 'deleted media';
      
      // Default
      default:
        return `performed ${action.replace(/_/g, ' ')}`;
    }
  };

  const handleClick = () => {
    if (onClick) {
      onClick(activity);
    }
  };

  const isClickable = activity.resourceId && (activity.resourceType === 'ScheduledPost' || activity.resourceType === 'Post');

  return (
    <div 
      className={`flex items-start space-x-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
        isClickable ? 'cursor-pointer' : ''
      }`}
      onClick={isClickable ? handleClick : undefined}
      title={new Date(activity.createdAt).toLocaleString()}
    >
      {/* Activity Icon */}
      <div className="flex-shrink-0">
        <ActivityIcon action={activity.action} />
      </div>

      {/* Activity Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-900 dark:text-white">
          <span className="font-medium">{activity.userId.name}</span>
          {' '}
          <span className="text-gray-600 dark:text-gray-400">
            {getActionDescription(activity.action, activity.details)}
          </span>
        </div>
        
        {/* Resource info if available */}
        {activity.resourceType && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {activity.resourceType}
            {activity.resourceId && ` • ${activity.resourceId.slice(-8)}`}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
        {new Date(activity.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
};