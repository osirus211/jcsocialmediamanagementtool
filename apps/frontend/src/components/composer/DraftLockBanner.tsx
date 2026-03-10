/**
 * Draft Lock Banner Component
 * 
 * Shows collaboration status and conflict warnings in the composer
 */

import React from 'react';

interface DraftLockBannerProps {
  isLocked: boolean;
  lockedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  lockExpiresAt?: string;
  isSaving: boolean;
  lastSaved?: Date;
  conflictDetected: boolean;
  onTakeover: () => void;
  onRefresh?: () => void;
}

export const DraftLockBanner: React.FC<DraftLockBannerProps> = ({
  isLocked,
  lockedBy,
  lockExpiresAt,
  isSaving,
  lastSaved,
  conflictDetected,
  onTakeover,
  onRefresh,
}) => {
  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) {
      return `${diffSeconds} seconds ago`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
  };

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);

    if (diffSeconds <= 0) {
      return 'expired';
    } else if (diffSeconds < 60) {
      return `${diffSeconds}s`;
    } else {
      return `${diffMinutes}m`;
    }
  };

  // Conflict detected banner (highest priority)
  if (conflictDetected) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <span className="text-red-600 dark:text-red-400 text-xl">⚠️</span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Conflict Detected
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Someone edited this draft while you were working. Your changes may be lost.
              </p>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="inline-flex items-center px-3 py-1.5 border border-red-300 dark:border-red-600 text-sm font-medium rounded-md text-red-700 dark:text-red-200 bg-white dark:bg-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors"
            >
              Refresh to see latest
            </button>
          )}
        </div>
      </div>
    );
  }

  // Locked by another user banner
  if (isLocked && lockedBy) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/40 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 dark:text-yellow-400 text-sm font-medium">
                  {lockedBy.name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                🔒 {lockedBy.name} is currently editing this draft
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Lock expires in {lockExpiresAt ? getTimeUntilExpiry(lockExpiresAt) : 'unknown'}
              </p>
            </div>
          </div>
          <button
            onClick={onTakeover}
            className="inline-flex items-center px-3 py-1.5 border border-yellow-300 dark:border-yellow-600 text-sm font-medium rounded-md text-yellow-700 dark:text-yellow-200 bg-white dark:bg-yellow-900/30 hover:bg-yellow-50 dark:hover:bg-yellow-900/50 transition-colors"
            title="Take over editing (use with caution)"
          >
            Take Over
          </button>
        </div>
      </div>
    );
  }

  // Auto-save status (when user has the lock)
  if (!isLocked) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
            <span className="text-sm text-green-700 dark:text-green-300">
              You have edit access
            </span>
          </div>
          <div className="text-sm text-green-600 dark:text-green-400">
            {isSaving ? (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 border border-green-600 border-t-transparent rounded-full animate-spin" />
                <span>Auto-saving...</span>
              </div>
            ) : lastSaved ? (
              <span>Saved {getTimeAgo(lastSaved)}</span>
            ) : (
              <span>Ready to save</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};