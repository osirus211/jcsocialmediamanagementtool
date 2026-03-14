/**
 * Draft Status Bar
 * 
 * Shows draft status, last edited info, and online presence
 */

import React, { useState, useEffect } from 'react';
import { draftCollaborationService, DraftPresence } from '../../services/draft-collaboration.service';

interface DraftStatusBarProps {
  draftId: string;
  status: 'draft' | 'in_review' | 'approved' | 'published';
  lastEditedBy?: {
    name: string;
    avatar?: string;
  };
  lastEditedAt?: string;
  version: number;
  onStatusChange?: (newStatus: string) => void;
  className?: string;
}

export const DraftStatusBar: React.FC<DraftStatusBarProps> = ({
  draftId,
  status,
  lastEditedBy,
  lastEditedAt,
  version,
  onStatusChange,
  className = ''
}) => {
  const [presence, setPresence] = useState<DraftPresence | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  useEffect(() => {
    // Monitor connection status
    const checkConnection = () => {
      const status = draftCollaborationService.getConnectionStatus();
      setConnectionStatus(status.isConnected ? 'connected' : 'disconnected');
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);

    // Handle presence updates
    const handlePresenceUpdate = (data: { presence: DraftPresence }) => {
      setPresence(data.presence);
    };

    const handleUserJoined = (data: { user: any; presence: DraftPresence }) => {
      setPresence(data.presence);
    };

    const handleUserLeft = (data: { userId: string; presence: DraftPresence }) => {
      setPresence(data.presence);
    };

    // Subscribe to events
    draftCollaborationService.on('presence-update', handlePresenceUpdate);
    draftCollaborationService.on('user-joined', handleUserJoined);
    draftCollaborationService.on('user-left', handleUserLeft);

    return () => {
      clearInterval(interval);
      draftCollaborationService.off('presence-update', handlePresenceUpdate);
      draftCollaborationService.off('user-joined', handleUserJoined);
      draftCollaborationService.off('user-left', handleUserLeft);
    };
  }, []);

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  // Get status badge
  const getStatusBadge = () => {
    const badges = {
      draft: {
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
        icon: '📝',
        text: 'Draft'
      },
      in_review: {
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        icon: '👀',
        text: 'In Review'
      },
      approved: {
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        icon: '✅',
        text: 'Approved'
      },
      published: {
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        icon: '🚀',
        text: 'Published'
      }
    };

    const badge = badges[status] || badges.draft;

    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <span className="mr-1">{badge.icon}</span>
        {badge.text}
      </div>
    );
  };

  // Get connection indicator
  const getConnectionIndicator = () => {
    const indicators = {
      connected: {
        color: 'bg-green-500',
        text: 'Connected',
        pulse: false
      },
      connecting: {
        color: 'bg-yellow-500',
        text: 'Connecting...',
        pulse: true
      },
      disconnected: {
        color: 'bg-red-500',
        text: 'Disconnected',
        pulse: false
      }
    };

    const indicator = indicators[connectionStatus];

    return (
      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
        <div className={`w-2 h-2 rounded-full ${indicator.color} ${indicator.pulse ? 'animate-pulse' : ''}`} />
        <span>{indicator.text}</span>
      </div>
    );
  };

  return (
    <div className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 ${className}`}>
      <div className="flex items-center justify-between">
        {/* Left side - Status and version */}
        <div className="flex items-center space-x-4">
          {getStatusBadge()}
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Version {version}
          </div>

          {lastEditedBy && lastEditedAt && (
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <span>•</span>
              <div className="flex items-center space-x-2">
                {lastEditedBy.avatar ? (
                  <img
                    src={lastEditedBy.avatar}
                    alt={lastEditedBy.name}
                    className="w-4 h-4 rounded-full"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">
                    {lastEditedBy.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span>
                  Last edited by {lastEditedBy.name}, {formatTimeAgo(lastEditedAt)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right side - Presence and connection */}
        <div className="flex items-center space-x-6">
          {/* Online presence */}
          {presence && presence.users.length > 0 && (
            <div className="flex items-center space-x-2">
              <div className="flex -space-x-1">
                {presence.users.slice(0, 3).map((user, index) => (
                  <div
                    key={user.userId}
                    className="relative"
                    style={{ zIndex: presence.users.length - index }}
                    title={user.name}
                  >
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-xs font-medium"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        user.name.charAt(0).toUpperCase()
                      )}
                    </div>
                  </div>
                ))}
                
                {presence.users.length > 3 && (
                  <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-gray-500 flex items-center justify-center text-white text-xs font-medium">
                    +{presence.users.length - 3}
                  </div>
                )}
              </div>
              
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {presence.users.length === 1 
                  ? '1 person online' 
                  : `${presence.users.length} people online`
                }
              </span>
            </div>
          )}

          {/* Connection status */}
          {getConnectionIndicator()}

          {/* Status change dropdown */}
          {onStatusChange && (
            <div className="relative">
              <select
                value={status}
                onChange={(e) => onStatusChange(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};