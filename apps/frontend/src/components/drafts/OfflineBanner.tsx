/**
 * Offline Banner
 * 
 * Shows offline status and sync information
 */

import React from 'react';

interface OfflineBannerProps {
  isOnline: boolean;
  hasPendingChanges: boolean;
  unsyncedChanges: number;
  isSyncing: boolean;
  lastSyncAt?: Date | null;
  onSync?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOnline,
  hasPendingChanges,
  unsyncedChanges,
  isSyncing,
  lastSyncAt,
  onSync,
  onDismiss,
  className = ''
}) => {
  // Don't show banner if online and no pending changes
  if (isOnline && !hasPendingChanges) {
    return null;
  }

  const formatLastSync = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    return date.toLocaleTimeString();
  };

  const getBannerStyle = () => {
    if (!isOnline) {
      return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200';
    }
    if (isSyncing) {
      return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200';
    }
    if (hasPendingChanges) {
      return 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200';
    }
    return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200';
  };

  const getIcon = () => {
    if (!isOnline) return '📡';
    if (isSyncing) return '🔄';
    if (hasPendingChanges) return '💾';
    return '✅';
  };

  const getMessage = () => {
    if (!isOnline) {
      return `You're offline. ${unsyncedChanges > 0 ? `${unsyncedChanges} change${unsyncedChanges === 1 ? '' : 's'} saved locally.` : 'Changes will be saved locally.'}`;
    }
    if (isSyncing) {
      return `Syncing ${unsyncedChanges} change${unsyncedChanges === 1 ? '' : 's'}...`;
    }
    if (hasPendingChanges) {
      return `${unsyncedChanges} unsaved change${unsyncedChanges === 1 ? '' : 's'}. Click to sync now.`;
    }
    return 'All changes synced';
  };

  return (
    <div className={`border-l-4 p-4 ${getBannerStyle()} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-lg">{getIcon()}</span>
          <div>
            <p className="text-sm font-medium">
              {getMessage()}
            </p>
            {lastSyncAt && (
              <p className="text-xs opacity-75 mt-1">
                Last synced {formatLastSync(lastSyncAt)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Sync button */}
          {isOnline && hasPendingChanges && !isSyncing && onSync && (
            <button
              onClick={onSync}
              className="px-3 py-1 text-xs font-medium rounded border border-current hover:bg-current hover:bg-opacity-10 transition-colors"
            >
              Sync Now
            </button>
          )}

          {/* Syncing indicator */}
          {isSyncing && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
              <span className="text-xs">Syncing...</span>
            </div>
          )}

          {/* Dismiss button */}
          {onDismiss && isOnline && !hasPendingChanges && (
            <button
              onClick={onDismiss}
              className="text-xs opacity-75 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Progress bar for syncing */}
      {isSyncing && (
        <div className="mt-2">
          <div className="w-full bg-current bg-opacity-20 rounded-full h-1">
            <div className="bg-current h-1 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      )}
    </div>
  );
};