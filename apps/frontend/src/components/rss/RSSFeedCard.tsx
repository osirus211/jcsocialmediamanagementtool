/**
 * RSS Feed Card Component
 * Shows a single RSS feed with controls and status
 */

import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Clock, 
  Hash, 
  ToggleLeft, 
  ToggleRight, 
  RefreshCw, 
  Edit, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  Tag,
  AlertCircle
} from 'lucide-react';
import { RSSFeed, rssService } from '@/services/rss.service';
import { RSSFeedItemList } from './RSSFeedItemList';
import { EditRSSFeedModal } from './EditRSSFeedModal';
import { toast } from '@/lib/notifications';

interface RSSFeedCardProps {
  feed: RSSFeed;
  onUpdate: (id: string, updates: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: (id: string) => Promise<void>;
}

export const RSSFeedCard: React.FC<RSSFeedCardProps> = ({
  feed,
  onUpdate,
  onDelete,
  onRefresh,
}) => {
  const [showItems, setShowItems] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadPendingCount();
  }, [feed._id]);

  const loadPendingCount = async () => {
    try {
      const result = await rssService.getFeedItems(feed._id, 1, 1, 'pending');
      setPendingCount(result.total);
    } catch (error) {
      // Ignore errors for pending count
    }
  };

  const formatTimeAgo = (date?: Date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const truncateUrl = (url: string, maxLength = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  const handleToggleEnabled = async () => {
    setIsUpdating(true);
    try {
      await onUpdate(feed._id, { enabled: !feed.enabled });
      toast.success(`Feed ${feed.enabled ? 'paused' : 'activated'}`);
    } catch (error) {
      toast.error('Failed to update feed status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh(feed._id);
      await loadPendingCount(); // Reload pending count after refresh
      toast.success('Feed refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh feed');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFeedUpdated = () => {
    loadPendingCount(); // Reload pending count after update
    onUpdate(feed._id, {}); // Trigger parent to reload feeds
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${feed.name}"? This will also delete all feed items.`)) {
      try {
        await onDelete(feed._id);
        toast.success('Feed deleted successfully');
      } catch (error) {
        toast.error('Failed to delete feed');
      }
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {feed.name}
          </h3>
          <div className="flex items-center text-sm text-gray-500 mt-1">
            <Globe className="w-4 h-4 mr-1" />
            <span className="truncate">{truncateUrl(feed.feedUrl)}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh feed"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowEditModal(true)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Edit feed"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete feed"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status and Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Status Toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleEnabled}
              disabled={isUpdating}
              className="flex items-center space-x-1 text-sm"
            >
              {feed.enabled ? (
                <ToggleRight className="w-5 h-5 text-green-500" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-gray-400" />
              )}
              <span className={feed.enabled ? 'text-green-600' : 'text-gray-500'}>
                {feed.enabled ? 'Active' : 'Paused'}
              </span>
            </button>
          </div>

          {/* Last Polled */}
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="w-4 h-4 mr-1" />
            <span>Last polled: {formatTimeAgo(feed.lastFetchedAt)}</span>
          </div>
        </div>

        {/* Item Count Badge */}
        <div className="flex items-center space-x-2">
          {pendingCount > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              <Clock className="w-3 h-3 mr-1" />
              {pendingCount} pending
            </span>
          )}
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Hash className="w-3 h-3 mr-1" />
            Items
          </span>
        </div>
      </div>

      {/* Keyword Filters Display */}
      {(feed.keywordsInclude?.length > 0 || feed.keywordsExclude?.length > 0) && (
        <div className="flex items-center space-x-4 text-sm">
          {feed.keywordsInclude?.length > 0 && (
            <div className="flex items-center space-x-2">
              <Tag className="w-4 h-4 text-green-600" />
              <span className="text-gray-600">Include:</span>
              <div className="flex flex-wrap gap-1">
                {feed.keywordsInclude.slice(0, 3).map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                  >
                    {keyword}
                  </span>
                ))}
                {feed.keywordsInclude.length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{feed.keywordsInclude.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
          
          {feed.keywordsExclude?.length > 0 && (
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-gray-600">Exclude:</span>
              <div className="flex flex-wrap gap-1">
                {feed.keywordsExclude.slice(0, 3).map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                  >
                    {keyword}
                  </span>
                ))}
                {feed.keywordsExclude.length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{feed.keywordsExclude.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auto-draft Settings */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <ToggleLeft className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">Auto-draft</span>
          </div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">AI Enhance</span>
          </div>
        </div>
        
        <button
          onClick={() => setShowItems(!showItems)}
          className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <span>View Items</span>
          {showItems ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Error Display */}
      {feed.lastError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">
            <strong>Error:</strong> {feed.lastError}
          </p>
          {feed.failureCount > 0 && (
            <p className="text-xs text-red-500 mt-1">
              Failed {feed.failureCount} time{feed.failureCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Feed Items */}
      {showItems && (
        <div className="border-t pt-4">
          <RSSFeedItemList feedId={feed._id} />
        </div>
      )}

      {/* Edit Feed Modal */}
      <EditRSSFeedModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        feed={feed}
        onFeedUpdated={handleFeedUpdated}
      />
    </div>
  );
};