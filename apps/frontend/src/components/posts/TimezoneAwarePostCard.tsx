/**
 * Timezone-Aware Post Card Component
 * 
 * Features that beat competitors:
 * - Shows scheduled time in workspace timezone
 * - Displays user's local time alongside
 * - Visual timezone indicators
 * - Smart time formatting (relative + absolute)
 * - Timezone-aware status indicators
 */

import React from 'react';
import { useWorkspaceStore } from '@/store/workspace.store';
import { formatTimeWithTimezone, getUserTimezone } from '@/utils/timezones';
import { Clock, Globe, MapPin, Calendar } from 'lucide-react';

interface Post {
  _id: string;
  content: string;
  scheduledAt?: string;
  publishedAt?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  platforms: string[];
}

interface TimezoneAwarePostCardProps {
  post: Post;
  onClick?: () => void;
  className?: string;
}

export const TimezoneAwarePostCard: React.FC<TimezoneAwarePostCardProps> = ({
  post,
  onClick,
  className = '',
}) => {
  const { currentWorkspace } = useWorkspaceStore();
  
  const workspaceTimezone = currentWorkspace?.settings?.timezone || 'UTC';
  const userTimezone = getUserTimezone();
  const isDifferentTimezone = workspaceTimezone !== userTimezone;

  const getTimeDisplay = () => {
    const targetDate = post.scheduledAt ? new Date(post.scheduledAt) : 
                      post.publishedAt ? new Date(post.publishedAt) : null;
    
    if (!targetDate) return null;

    const workspaceTime = formatTimeWithTimezone(targetDate, workspaceTimezone, false);
    const userTime = isDifferentTimezone ? formatTimeWithTimezone(targetDate, userTimezone, false) : null;
    
    // Calculate relative time
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    
    let relativeTime = '';
    if (post.status === 'published') {
      if (diffDays < -1) {
        relativeTime = `${Math.abs(diffDays)} days ago`;
      } else if (diffHours < -1) {
        relativeTime = `${Math.abs(diffHours)} hours ago`;
      } else {
        relativeTime = 'Recently';
      }
    } else if (post.status === 'scheduled') {
      if (diffDays > 1) {
        relativeTime = `in ${diffDays} days`;
      } else if (diffHours > 1) {
        relativeTime = `in ${diffHours} hours`;
      } else if (diffHours > 0) {
        relativeTime = 'in less than an hour';
      } else {
        relativeTime = 'Due now';
      }
    }

    return {
      workspaceTime,
      userTime,
      relativeTime,
      isOverdue: post.status === 'scheduled' && diffMs < 0
    };
  };

  const timeDisplay = getTimeDisplay();

  const getStatusColor = () => {
    switch (post.status) {
      case 'published':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'scheduled':
        return timeDisplay?.isOverdue 
          ? 'text-red-600 bg-red-100 border-red-200'
          : 'text-blue-600 bg-blue-100 border-blue-200';
      case 'failed':
        return 'text-red-600 bg-red-100 border-red-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (post.status) {
      case 'published':
        return <Globe className="w-4 h-4" />;
      case 'scheduled':
        return timeDisplay?.isOverdue ? <Clock className="w-4 h-4" /> : <Calendar className="w-4 h-4" />;
      case 'failed':
        return <Clock className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 
        hover:shadow-md transition-shadow cursor-pointer p-4 space-y-3
        ${className}
      `}
    >
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="capitalize">{post.status}</span>
          {timeDisplay?.isOverdue && <span>(Overdue)</span>}
        </div>
        
        {/* Platforms */}
        <div className="flex items-center gap-1">
          {post.platforms.map((platform) => (
            <div
              key={platform}
              className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400"
            >
              {platform.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Content Preview */}
      <div className="text-gray-900 dark:text-white">
        <p className="line-clamp-3 text-sm">
          {post.content}
        </p>
      </div>

      {/* Timezone-Aware Time Display */}
      {timeDisplay && (
        <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          {/* Relative Time */}
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Clock className="w-4 h-4" />
            <span>{timeDisplay.relativeTime}</span>
          </div>

          {/* Workspace Time */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Globe className="w-4 h-4 text-blue-500" />
            <span className="font-mono">{timeDisplay.workspaceTime}</span>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
              Workspace
            </span>
          </div>

          {/* User Local Time (if different) */}
          {timeDisplay.userTime && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="w-4 h-4 text-green-500" />
              <span className="font-mono">{timeDisplay.userTime}</span>
              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                Local
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};