/**
 * Drafts List Component
 * 
 * Displays all workspace drafts with collaboration status
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { draftsService, DraftPost } from '../../services/drafts.service';

export const DraftsList: React.FC = () => {
  const [drafts, setDrafts] = useState<DraftPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchDrafts = async () => {
    try {
      setLoading(true);
      const response = await draftsService.listDrafts({ limit: 50 });
      setDrafts(response.drafts);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
      setError('Failed to load drafts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDrafts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleEdit = (draftId: string) => {
    navigate(`/posts/create?draftId=${draftId}`);
  };

  const handleDelete = async (draftId: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) {
      return;
    }

    try {
      // Note: This would need a delete endpoint in the drafts service
      // For now, we'll just refresh the list
      await fetchDrafts();
    } catch (err) {
      console.error('Failed to delete draft:', err);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  const isLocked = (draft: DraftPost) => {
    return draft.lockExpiresAt && new Date(draft.lockExpiresAt) > new Date();
  };

  const getPlatformIcons = (draft: DraftPost) => {
    const platforms = draft.platformContent?.map(pc => pc.platform) || [];
    const uniquePlatforms = [...new Set(platforms)];
    
    return uniquePlatforms.map(platform => {
      const emoji = {
        'instagram': '📷',
        'facebook': '📘',
        'twitter': '🐦',
        'linkedin': '💼',
        'tiktok': '🎵',
        'youtube': '📺',
      }[platform.toLowerCase()] || '📱';
      
      return (
        <span key={platform} title={platform} className="text-lg">
          {emoji}
        </span>
      );
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              </div>
              <div className="flex space-x-2">
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 text-4xl mb-4">⚠️</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Error Loading Drafts
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={fetchDrafts}
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">📝</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No drafts yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Create your first draft to get started with collaborative editing.
        </p>
        <button
          onClick={() => navigate('/posts/create')}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Create New Draft
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {drafts.map((draft) => (
        <div
          key={draft._id}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {/* Content Preview */}
              <div className="mb-3">
                <p className="text-gray-900 dark:text-white text-sm line-clamp-3">
                  {draft.content.length > 100 
                    ? `${draft.content.substring(0, 100)}...` 
                    : draft.content}
                </p>
              </div>

              {/* Platform Icons */}
              <div className="flex items-center space-x-2 mb-3">
                {getPlatformIcons(draft)}
              </div>

              {/* Metadata */}
              <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  Created by {draft.createdBy.name}
                </span>
                <span>•</span>
                <span>
                  {getTimeAgo(draft.updatedAt)}
                </span>
                {draft.lastEditedBy && (
                  <>
                    <span>•</span>
                    <span>
                      Last edited by {draft.lastEditedBy.name}
                    </span>
                  </>
                )}
              </div>

              {/* Lock Status */}
              {isLocked(draft) && draft.lockedBy && (
                <div className="mt-2 flex items-center space-x-2">
                  <span className="text-yellow-600 dark:text-yellow-400">🔒</span>
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">
                    {draft.lockedBy.name} editing
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={() => handleEdit(draft._id)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(draft._id)}
                className="inline-flex items-center px-3 py-1.5 border border-red-300 dark:border-red-600 text-sm font-medium rounded-md text-red-700 dark:text-red-300 bg-white dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};