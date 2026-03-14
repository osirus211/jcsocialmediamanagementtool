/**
 * Mastodon Account Card Component
 * 
 * Displays Mastodon account information with connection status
 */

import React from 'react';
import { SocialAccount } from '../../types/social.types';

interface MastodonAccountCardProps {
  account: SocialAccount;
  onDisconnect: (accountId: string) => void;
  onRefresh?: (accountId: string) => void;
}

export const MastodonAccountCard: React.FC<MastodonAccountCardProps> = ({
  account,
  onDisconnect,
  onRefresh,
}) => {
  const metadata = account.metadata;
  const instanceUrl = metadata?.instanceUrl || '';
  const instanceName = instanceUrl.replace('https://', '').replace('http://', '');
  const acct = metadata?.acct || account.accountName;
  const followersCount = metadata?.followersCount || 0;
  const followingCount = metadata?.followingCount || 0;
  const statusesCount = metadata?.statusesCount || 0;
  const isVerified = metadata?.verified || false;
  const isBot = metadata?.bot || false;
  const isLocked = metadata?.locked || false;

  const formatCount = (count: number): string => {
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
              src={metadata?.avatar || '/icons/mastodon-default.png'}
              alt={metadata?.displayName || account.accountName}
              className="w-12 h-12 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/icons/mastodon-default.png';
              }}
            />
          </div>

          {/* Account Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {metadata?.displayName || account.accountName}
              </h3>
              {isVerified && (
                <svg
                  className="w-5 h-5 text-purple-500"
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
              {isBot && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Bot
                </span>
              )}
              {isLocked && (
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>

            <div className="mt-1 flex items-center space-x-1 text-sm text-gray-500">
              <span>@{acct}</span>
            </div>

            {/* Instance Badge */}
            <div className="mt-2 flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
                </svg>
                {instanceName}
              </span>
            </div>

            {/* Stats */}
            <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
              <span>{formatCount(statusesCount)} toots</span>
              <span>•</span>
              <span>{formatCount(followersCount)} followers</span>
              <span>•</span>
              <span>{formatCount(followingCount)} following</span>
            </div>

            {/* Connection Status */}
            <div className="mt-3">
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

      {/* Mastodon-specific features */}
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
              Toots
            </span>
            <span className="flex items-center text-green-600">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Polls
            </span>
            <span className="flex items-center text-green-600">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              CW
            </span>
            <span className="flex items-center text-green-600">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Scheduling
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};