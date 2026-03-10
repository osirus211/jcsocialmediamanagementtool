/**
 * RSS Feeds Page
 * Main page for managing RSS feed subscriptions
 */

import React, { useState, useEffect } from 'react';
import { Plus, Rss, TrendingUp, FileText, Info } from 'lucide-react';
import { rssService, RSSFeed } from '@/services/rss.service';
import { RSSFeedCard } from '@/components/rss/RSSFeedCard';
import { AddRSSFeedModal } from '@/components/rss/AddRSSFeedModal';
import { toast } from '@/lib/notifications';

export const RSSPage: React.FC = () => {
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [stats, setStats] = useState({
    totalFeeds: 0,
    activeFeeds: 0,
    itemsThisWeek: 0,
    draftsCreated: 0,
  });

  useEffect(() => {
    loadFeeds();
  }, []);

  const loadFeeds = async () => {
    setLoading(true);
    try {
      const feedsData = await rssService.getFeeds();
      setFeeds(feedsData);
      
      // Calculate stats
      const activeFeeds = feedsData.filter(feed => feed.enabled).length;
      setStats({
        totalFeeds: feedsData.length,
        activeFeeds,
        itemsThisWeek: 0, // TODO: Calculate from actual data
        draftsCreated: 0, // TODO: Calculate from actual data
      });
    } catch (error) {
      console.error('Failed to load RSS feeds:', error);
      toast.error('Failed to load RSS feeds');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFeed = async (id: string, updates: any) => {
    try {
      await rssService.updateFeed(id, updates);
      await loadFeeds(); // Reload to get updated data
    } catch (error) {
      console.error('Failed to update feed:', error);
      throw error; // Re-throw to let the component handle the error
    }
  };

  const handleDeleteFeed = async (id: string) => {
    try {
      await rssService.deleteFeed(id);
      await loadFeeds(); // Reload to get updated data
    } catch (error) {
      console.error('Failed to delete feed:', error);
      throw error; // Re-throw to let the component handle the error
    }
  };

  const handleRefreshFeed = async (id: string) => {
    try {
      await rssService.refreshFeed(id);
      await loadFeeds(); // Reload to get updated data
    } catch (error) {
      console.error('Failed to refresh feed:', error);
      throw error; // Re-throw to let the component handle the error
    }
  };

  const handleFeedAdded = () => {
    loadFeeds(); // Reload feeds after adding a new one
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Rss className="w-8 h-8 mr-3 text-orange-500" />
            RSS Feeds
          </h1>
          <p className="text-gray-600 mt-1">
            Import content from your favorite blogs and websites
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Feed
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-800">
              <strong>How it works:</strong> RSS feeds are checked automatically every 30 minutes for new content. 
              You can manually convert items to draft posts or enable auto-drafting for hands-free content import.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Rss className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Feeds</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalFeeds}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Active Feeds</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeFeeds}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Items This Week</p>
              <p className="text-2xl font-bold text-gray-900">{stats.itemsThisWeek}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Drafts Created</p>
              <p className="text-2xl font-bold text-gray-900">{stats.draftsCreated}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Feeds List */}
      {feeds.length === 0 ? (
        <div className="text-center py-12">
          <Rss className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No RSS feeds yet
          </h3>
          <p className="text-gray-600 mb-6">
            Add your first RSS feed to start importing content automatically
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Feed
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {feeds.map((feed) => (
            <RSSFeedCard
              key={feed._id}
              feed={feed}
              onUpdate={handleUpdateFeed}
              onDelete={handleDeleteFeed}
              onRefresh={handleRefreshFeed}
            />
          ))}
        </div>
      )}

      {/* Add Feed Modal */}
      <AddRSSFeedModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onFeedAdded={handleFeedAdded}
      />
    </div>
  );
};