/**
 * Threads Account Card Component
 * Enhanced account card with Threads-specific features
 */

import React from 'react';
import { ExternalLink, RefreshCw, Trash2, AlertCircle, CheckCircle } from 'lucide-react';

interface ThreadsAccountCardProps {
  account: {
    id: string;
    accountName: string;
    metadata?: {
      username?: string;
      profileUrl?: string;
      avatarUrl?: string;
      biography?: string;
    };
    status: 'active' | 'expired' | 'error';
    lastSyncAt?: string;
    tokenExpiresAt?: string;
  };
  onReconnect?: (accountId: string) => void;
  onDisconnect?: (accountId: string) => void;
  onRefresh?: (accountId: string) => void;
}

export const ThreadsAccountCard: React.FC<ThreadsAccountCardProps> = ({
  account,
  onReconnect,
  onDisconnect,
  onRefresh,
}) => {
  const isExpired = account.status === 'expired';
  const hasError = account.status === 'error';
  const isActive = account.status === 'active';

  const getStatusColor = () => {
    if (hasError) return 'text-red-600 bg-red-50 border-red-200';
    if (isExpired) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getStatusIcon = () => {
    if (hasError) return <AlertCircle className="h-4 w-4" />;
    if (isExpired) return <RefreshCw className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center flex-shrink-0">
            {account.metadata?.avatarUrl ? (
              <img
                src={account.metadata.avatarUrl}
                alt={account.accountName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-white font-semibold text-lg">@</span>
            )}
          </div>

          {/* Account Info */}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate">
              {account.accountName}
            </h3>
            {account.metadata?.username && (
              <p className="text-sm text-gray-600">
                @{account.metadata.username}
              </p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="capitalize">{account.status}</span>
        </div>
      </div>
      {/* Biography */}
      {account.metadata?.biography && (
        <div className="mb-3">
          <p className="text-sm text-gray-700 line-clamp-2">
            {account.metadata.biography}
          </p>
        </div>
      )}

      {/* Account Details */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Last Sync:</span>
          <span className="text-gray-900">{formatDate(account.lastSyncAt)}</span>
        </div>
        {account.tokenExpiresAt && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Token Expires:</span>
            <span className="text-gray-900">{formatDate(account.tokenExpiresAt)}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Profile Link */}
        {account.metadata?.profileUrl && (
          <a
            href={account.metadata.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            View Profile
          </a>
        )}

        {/* Refresh */}
        {onRefresh && isActive && (
          <button
            onClick={() => onRefresh(account.id)}
            className="flex items-center gap-1 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        )}

        {/* Reconnect */}
        {onReconnect && (isExpired || hasError) && (
          <button
            onClick={() => onReconnect(account.id)}
            className="flex items-center gap-1 px-3 py-2 text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-md transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Reconnect
          </button>
        )}

        {/* Disconnect */}
        {onDisconnect && (
          <button
            onClick={() => onDisconnect(account.id)}
            className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors ml-auto"
          >
            <Trash2 className="h-4 w-4" />
            Disconnect
          </button>
        )}
      </div>

      {/* Threads Features */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-500 space-y-1">
          <div>✓ Text, Image, Video & Carousel posts</div>
          <div>✓ Reply to threads & manage conversations</div>
          <div>✓ Analytics & performance insights</div>
          <div>✓ Up to 20 items per carousel</div>
        </div>
      </div>
    </div>
  );
};