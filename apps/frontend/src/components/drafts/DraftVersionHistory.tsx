/**
 * Draft Version History
 * 
 * Panel showing version history with diff view and restore functionality
 */

import React, { useState, useEffect } from 'react';

interface DraftVersion {
  _id: string;
  draftId: string;
  version: number;
  content: string;
  platformContent?: Array<{
    platform: string;
    text?: string;
    mediaIds?: string[];
    enabled: boolean;
  }>;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  changeDescription: string;
  changeType: 'manual' | 'auto' | 'approval' | 'restore';
  contentDiff?: {
    added: string[];
    removed: string[];
    modified: Array<{
      field: string;
      oldValue: string;
      newValue: string;
    }>;
  };
  metadata?: {
    characterCount?: number;
    wordCount?: number;
    hashtags?: string[];
    mentions?: string[];
    mediaCount?: number;
  };
}

interface DraftVersionHistoryProps {
  draftId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestore?: (version: number) => void;
  className?: string;
}

export const DraftVersionHistory: React.FC<DraftVersionHistoryProps> = ({
  draftId,
  isOpen,
  onClose,
  onRestore,
  className = ''
}) => {
  const [versions, setVersions] = useState<DraftVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<DraftVersion | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);

  // Load version history
  const loadVersions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/drafts/${draftId}/versions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setVersions(data.data.versions || []);
      }
    } catch (error) {
      console.error('Failed to load version history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [draftId, isOpen]);

  // Restore to version
  const handleRestore = async (version: number) => {
    if (!confirm(`Are you sure you want to restore to version ${version}? This will create a new version with the restored content.`)) {
      return;
    }

    try {
      setRestoring(version);
      const response = await fetch(`/api/v1/drafts/${draftId}/versions/${version}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        onRestore?.(version);
        loadVersions(); // Refresh to show new version
        setSelectedVersion(null);
      }
    } catch (error) {
      console.error('Failed to restore version:', error);
    } finally {
      setRestoring(null);
    }
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get change type badge
  const getChangeTypeBadge = (changeType: string) => {
    const badges = {
      manual: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      auto: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      approval: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      restore: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    };

    return (
      <span className={`px-2 py-1 text-xs rounded-full ${badges[changeType as keyof typeof badges] || badges.manual}`}>
        {changeType}
      </span>
    );
  };

  // Render diff
  const renderDiff = (version: DraftVersion) => {
    if (!version.contentDiff) {
      return <p className="text-sm text-gray-500 dark:text-gray-400">No diff available</p>;
    }

    return (
      <div className="space-y-2">
        {version.contentDiff.added.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Added:</h5>
            {version.contentDiff.added.map((line, index) => (
              <div key={index} className="text-sm bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 p-2 rounded border-l-2 border-green-500">
                + {line}
              </div>
            ))}
          </div>
        )}
        
        {version.contentDiff.removed.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Removed:</h5>
            {version.contentDiff.removed.map((line, index) => (
              <div key={index} className="text-sm bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-2 rounded border-l-2 border-red-500">
                - {line}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg z-50 flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Version History
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : selectedVersion ? (
          /* Version detail view */
          <div className="h-full flex flex-col">
            {/* Version header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setSelectedVersion(null)}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                >
                  ← Back to history
                </button>
                <button
                  onClick={() => handleRestore(selectedVersion.version)}
                  disabled={restoring === selectedVersion.version}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {restoring === selectedVersion.version ? 'Restoring...' : 'Restore'}
                </button>
              </div>
              
              <h4 className="font-medium text-gray-900 dark:text-white">
                Version {selectedVersion.version}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedVersion.changeDescription}
              </p>
              <div className="flex items-center space-x-2 mt-2">
                {getChangeTypeBadge(selectedVersion.changeType)}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  by {selectedVersion.changedByName}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTime(selectedVersion.changedAt)}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowDiff(false)}
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  !showDiff
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Content
              </button>
              <button
                onClick={() => setShowDiff(true)}
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  showDiff
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Changes
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {showDiff ? (
                renderDiff(selectedVersion)
              ) : (
                <div className="space-y-4">
                  {/* Metadata */}
                  {selectedVersion.metadata && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Statistics</h5>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <div>Characters: {selectedVersion.metadata.characterCount}</div>
                        <div>Words: {selectedVersion.metadata.wordCount}</div>
                        <div>Hashtags: {selectedVersion.metadata.hashtags?.length || 0}</div>
                        <div>Media: {selectedVersion.metadata.mediaCount || 0}</div>
                      </div>
                    </div>
                  )}

                  {/* Content preview */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Content</h5>
                    <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded max-h-64 overflow-y-auto">
                      {selectedVersion.content}
                    </div>
                  </div>

                  {/* Platform content */}
                  {selectedVersion.platformContent && selectedVersion.platformContent.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Platform Content</h5>
                      <div className="space-y-2">
                        {selectedVersion.platformContent.map((pc, index) => (
                          <div key={index} className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              {pc.platform.toUpperCase()}
                            </div>
                            {pc.text && (
                              <div className="text-sm text-gray-700 dark:text-gray-300">
                                {pc.text}
                              </div>
                            )}
                            {pc.mediaIds && pc.mediaIds.length > 0 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {pc.mediaIds.length} media file(s)
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Version list */
          <div className="h-full overflow-y-auto">
            {versions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">No version history available</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {versions.map((version) => (
                  <div
                    key={version._id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-sm cursor-pointer"
                    onClick={() => setSelectedVersion(version)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          v{version.version}
                        </span>
                        {getChangeTypeBadge(version.changeType)}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTime(version.changedAt)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {version.changeDescription}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>by {version.changedByName}</span>
                      {version.metadata && (
                        <span>
                          {version.metadata.characterCount} chars, {version.metadata.wordCount} words
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};