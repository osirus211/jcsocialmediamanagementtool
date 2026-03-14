/**
 * Facebook Account Card Component
 * 
 * Displays Facebook page information with connection status
 */

import React from 'react';
import { SocialAccount } from '../../types/social.types';

interface FacebookAccountCardProps {
  account: SocialAccount;
  onDisconnect: (accountId: string) => void;
  onRefresh?: (accountId: string) => void;
}

export const FacebookAccountCard: React.FC<FacebookAccountCardProps> = ({
  account,
  onDisconnect,
  onRefresh,
}) => {
  const pageInfo = account.metadata;
  const isVerified = pageInfo?.verified || false;
  const followerCount = pageInfo?.followerCount || pageInfo?.fanCount || 0;
  const category = pageInfo?.category || 'Page';

  const formatFollowerCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'expired':
        return 'text-red-600 bg-red-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Connected';
      case 'expired':
        return 'Token Expired';
      case 'error':
        return 'Connection Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          {/* Profile Picture */}
          <div className="flex-shrink-0">
            <img
              src={pageInfo?.profileImageUrl || '/icons/facebook-default.png'}
              alt={account.accountName}
              className="w-12 h-12 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/icons/facebook-default.png';
              }}
            />
          </div>

          {/* Page Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {account.accountName}
              </h3>
              {isVerified && (
                <svg
                  className="w-5 h-5 text-blue-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>

            <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
              <span className="capitalize">{category}</span>
              {followerCount > 0 && (
                <>
                  <span>•</span>
                  <span>{formatFollowerCount(followerCount)} followers</span>
                </>
              )}
            </div>

            {/* Connection Status */}
            <div className="mt-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                  account.status
                )}`}
              >
                {getStatusText(account.status)}
              </span>
            </div>

            {/* Last Sync */}
            {account.lastSyncAt && (
              <p className="mt-2 text-xs text-gray-400">
                Last synced: {new Date(account.lastSyncAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {onRefresh && (
            <button
              onClick={() => onRefresh(account._id)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Refresh connection"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}

          <button
            onClick={() => onDisconnect(account._id)}
            className="p-2 text-red-400 hover:text-red-600 transition-colors"
            title="Disconnect account"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Facebook-specific features */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Platform Features</span>
          <div className="flex items-center space-x-3">
            <span className="flex items-center text-green-600">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Posts
            </span>
            <span className="flex items-center text-green-600">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Reels
            </span>
            <span className="flex items-center text-green-600">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Stories
            </span>
            <span className="flex items-center text-green-600">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Analytics
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};