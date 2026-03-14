import React from 'react';
import { 
  Play, 
  Users, 
  Video, 
  Eye, 
  CheckCircle, 
  ExternalLink,
  MoreVertical,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { SocialAccount } from '../../types/social.types';

interface YouTubeAccountCardProps {
  account: SocialAccount;
  onDisconnect: (accountId: string) => void;
  onRefresh?: (accountId: string) => void;
  isLoading?: boolean;
}

export const YouTubeAccountCard: React.FC<YouTubeAccountCardProps> = ({
  account,
  onDisconnect,
  onRefresh,
  isLoading = false
}) => {
  const metadata = account.metadata || {};
  const stats = {
    subscribers: metadata.subscriberCount || 0,
    videos: metadata.videoCount || 0,
    views: metadata.viewCount || 0,
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const handleDisconnect = () => {
    if (window.confirm('Are you sure you want to disconnect this YouTube channel?')) {
      onDisconnect(account._id);
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh(account._id);
    }
  };

  const channelUrl = `https://youtube.com/channel/${metadata.channelId}`;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <img
              src={metadata.channelThumbnail || '/icons/youtube-default.png'}
              alt={account.accountName}
              className="w-12 h-12 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/icons/youtube-default.png';
              }}
            />
            <div className="absolute -bottom-1 -right-1 bg-red-600 rounded-full p-1">
              <Play className="w-3 h-3 text-white fill-current" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-gray-900 truncate">
                {account.accountName}
              </h3>
              {metadata.isVerified && (
                <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-gray-500 truncate">
              @{metadata.customUrl || metadata.channelId}
            </p>
            {metadata.channelDescription && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                {metadata.channelDescription}
              </p>
            )}
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative group">
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <MoreVertical className="w-4 h-4 text-gray-500" />
          </button>
          
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[160px]">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Stats</span>
            </button>
            
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>View Channel</span>
            </a>
            
            <hr className="my-1" />
            
            <button
              onClick={handleDisconnect}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 text-gray-600 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Subscribers</span>
          </div>
          <div className="text-lg font-bold text-gray-900">
            {formatNumber(stats.subscribers)}
          </div>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 text-gray-600 mb-1">
            <Video className="w-4 h-4" />
            <span className="text-xs font-medium">Videos</span>
          </div>
          <div className="text-lg font-bold text-gray-900">
            {formatNumber(stats.videos)}
          </div>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 text-gray-600 mb-1">
            <Eye className="w-4 h-4" />
            <span className="text-xs font-medium">Views</span>
          </div>
          <div className="text-lg font-bold text-gray-900">
            {formatNumber(stats.views)}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Connected</span>
        </div>
        
        <div className="text-xs text-gray-400">
          Last synced: {new Date(account.lastSyncAt || account.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Country & Language */}
      {(metadata.country || metadata.defaultLanguage) && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            {metadata.country && (
              <span>📍 {metadata.country}</span>
            )}
            {metadata.defaultLanguage && (
              <span>🌐 {metadata.defaultLanguage.toUpperCase()}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};