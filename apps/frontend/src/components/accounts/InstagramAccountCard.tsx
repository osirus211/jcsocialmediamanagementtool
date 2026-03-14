/**
 * Instagram Account Card Component
 * 
 * Displays Instagram account information with:
 * - Profile picture and verified badge
 * - Username and account type
 * - Follower count and engagement stats
 * - Connection status and reconnect button
 * - Account health indicators
 */

import React, { useState } from 'react';
import {
  CheckCircle,
  AlertCircle,
  RefreshCw,
  MoreVertical,
  Users,
  Heart,
  TrendingUp,
  Calendar,
  Settings,
  Unlink,
  ExternalLink,
} from 'lucide-react';

interface InstagramAccountCardProps {
  account: InstagramAccount;
  onReconnect: (accountId: string) => void;
  onDisconnect: (accountId: string) => void;
  onViewAnalytics: (accountId: string) => void;
  className?: string;
}

interface InstagramAccount {
  id: string;
  username: string;
  displayName: string;
  profileImage: string;
  verified: boolean;
  accountType: 'PERSONAL' | 'BUSINESS' | 'CREATOR';
  followersCount: number;
  followingCount: number;
  mediaCount: number;
  connectionStatus: 'connected' | 'expired' | 'error' | 'reconnecting';
  lastSyncAt: string;
  tokenExpiresAt: string;
  avgEngagementRate: number;
  recentPostsCount: number;
  isActive: boolean;
}

const ACCOUNT_TYPE_COLORS = {
  PERSONAL: 'bg-gray-100 text-gray-800',
  BUSINESS: 'bg-blue-100 text-blue-800',
  CREATOR: 'bg-purple-100 text-purple-800',
};

const CONNECTION_STATUS_CONFIG = {
  connected: {
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: CheckCircle,
    label: 'Connected',
  },
  expired: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    icon: AlertCircle,
    label: 'Token Expired',
  },
  error: {
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: AlertCircle,
    label: 'Connection Error',
  },
  reconnecting: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: RefreshCw,
    label: 'Reconnecting...',
  },
};

export const InstagramAccountCard: React.FC<InstagramAccountCardProps> = ({
  account,
  onReconnect,
  onDisconnect,
  onViewAnalytics,
  className = '',
}) => {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const statusConfig = CONNECTION_STATUS_CONFIG[account.connectionStatus];
  const StatusIcon = statusConfig.icon;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysUntilExpiry = (): number => {
    const expiryDate = new Date(account.tokenExpiresAt);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await onReconnect(account.id);
    } finally {
      setIsReconnecting(false);
    }
  };

  const isTokenExpiringSoon = getDaysUntilExpiry() <= 7;
  const needsAttention = account.connectionStatus !== 'connected' || isTokenExpiringSoon;

  return (
    <div className={`relative overflow-hidden border rounded-lg ${className}`}>
      {/* Status Indicator Bar */}
      <div className={`h-1 w-full ${statusConfig.bgColor}`} />

      <div className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={account.profileImage}
                alt={account.username}
                className="w-12 h-12 rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${account.username}&background=random`;
                }}
              />
              {account.verified && (
                <CheckCircle className="absolute -bottom-1 -right-1 w-4 h-4 text-blue-500 bg-white rounded-full" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm truncate">@{account.username}</h3>
                <span className={`text-xs px-2 py-1 rounded ${ACCOUNT_TYPE_COLORS[account.accountType]}`}>
                  {account.accountType.toLowerCase()}
                </span>
              </div>
              <p className="text-sm text-gray-500 truncate">{account.displayName}</p>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                <button
                  onClick={() => {
                    onViewAnalytics(account.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  View Analytics
                </button>
                <a
                  href={`https://instagram.com/${account.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => setShowMenu(false)}
                >
                  <ExternalLink className="w-4 h-4" />
                  View Profile
                </a>
                <hr className="my-1" />
                <button
                  onClick={() => {
                    onDisconnect(account.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
                >
                  <Unlink className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Connection Status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
            <span className={`text-sm font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>

          {needsAttention && (
            <button
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isReconnecting ? 'animate-spin' : ''}`} />
              Reconnect
            </button>
          )}
        </div>

        {/* Account Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="w-3 h-3 text-gray-400" />
            </div>
            <p className="text-lg font-semibold">{formatNumber(account.followersCount)}</p>
            <p className="text-xs text-gray-500">Followers</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Heart className="w-3 h-3 text-gray-400" />
            </div>
            <p className="text-lg font-semibold">{account.avgEngagementRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-500">Engagement</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar className="w-3 h-3 text-gray-400" />
            </div>
            <p className="text-lg font-semibold">{account.recentPostsCount}</p>
            <p className="text-xs text-gray-500">Recent Posts</p>
          </div>
        </div>

        <hr className="mb-4" />

        {/* Additional Info */}
        <div className="space-y-2 text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>Last sync:</span>
            <span>{formatDate(account.lastSyncAt)}</span>
          </div>
          
          {account.connectionStatus === 'connected' && (
            <div className="flex items-center justify-between">
              <span>Token expires:</span>
              <span className={isTokenExpiringSoon ? 'text-yellow-600 font-medium' : ''}>
                {getDaysUntilExpiry()} days
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span>Total posts:</span>
            <span>{formatNumber(account.mediaCount)}</span>
          </div>
        </div>

        {/* Warnings */}
        {isTokenExpiringSoon && account.connectionStatus === 'connected' && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <p className="text-xs text-yellow-800">
                Token expires in {getDaysUntilExpiry()} days. Reconnect to avoid interruption.
              </p>
            </div>
          </div>
        )}

        {account.connectionStatus === 'error' && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-xs text-red-800">
                Connection error. Please reconnect your account.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onViewAnalytics(account.id)}
            className="flex-1 px-3 py-2 text-xs border rounded hover:bg-gray-50 flex items-center justify-center gap-1"
          >
            <TrendingUp className="w-3 h-3" />
            Analytics
          </button>
          
          {account.connectionStatus === 'connected' && (
            <button
              onClick={() => {
                window.location.href = `/compose?account=${account.id}`;
              }}
              className="flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Post
            </button>
          )}
        </div>
      </div>
    </div>
  );
};