/**
 * Edit RSS Feed Modal Component
 * Modal form for editing existing RSS feeds
 */

import React, { useState, useEffect } from 'react';
import { X, Loader2, Globe, Tag, AlertCircle } from 'lucide-react';
import { rssService, RSSFeed, UpdateFeedInput } from '@/services/rss.service';
import { toast } from '@/lib/notifications';

interface EditRSSFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  feed: RSSFeed;
  onFeedUpdated: () => void;
}

export const EditRSSFeedModal: React.FC<EditRSSFeedModalProps> = ({
  isOpen,
  onClose,
  feed,
  onFeedUpdated,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    pollingInterval: 60,
  });
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [keywordsInclude, setKeywordsInclude] = useState<string[]>([]);
  const [keywordsExclude, setKeywordsExclude] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const platforms = [
    { id: 'linkedin', name: 'LinkedIn' },
    { id: 'twitter', name: 'Twitter' },
    { id: 'facebook', name: 'Facebook' },
    { id: 'instagram', name: 'Instagram' },
  ];

  const pollingIntervals = [
    { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' },
    { value: 240, label: '4 hours' },
    { value: 360, label: '6 hours' },
    { value: 720, label: '12 hours' },
    { value: 1440, label: '24 hours' },
  ];

  // Pre-fill form with current feed values
  useEffect(() => {
    if (isOpen && feed) {
      setFormData({
        name: feed.name,
        pollingInterval: feed.pollingInterval,
      });
      setSelectedPlatforms(feed.targetPlatforms || ['linkedin']);
      setKeywordsInclude(feed.keywordsInclude || []);
      setKeywordsExclude(feed.keywordsExclude || []);
    }
  }, [isOpen, feed]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const addKeyword = (type: 'include' | 'exclude', keyword: string) => {
    if (!keyword.trim()) return;
    
    const normalizedKeyword = keyword.trim().toLowerCase();
    
    if (type === 'include') {
      if (!keywordsInclude.includes(normalizedKeyword)) {
        setKeywordsInclude(prev => [...prev, normalizedKeyword]);
      }
    } else {
      if (!keywordsExclude.includes(normalizedKeyword)) {
        setKeywordsExclude(prev => [...prev, normalizedKeyword]);
      }
    }
  };

  const removeKeyword = (type: 'include' | 'exclude', keyword: string) => {
    if (type === 'include') {
      setKeywordsInclude(prev => prev.filter(k => k !== keyword));
    } else {
      setKeywordsExclude(prev => prev.filter(k => k !== keyword));
    }
  };

  const handleKeywordKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, type: 'include' | 'exclude') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = e.target as HTMLInputElement;
      addKeyword(type, input.value);
      input.value = '';
    }
  };

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Please enter a feed name');
      return;
    }

    setLoading(true);

    try {
      const updateData: UpdateFeedInput = {
        name: formData.name.trim(),
        pollingInterval: formData.pollingInterval,
        keywordsInclude,
        keywordsExclude,
        targetPlatforms: selectedPlatforms,
      };

      await rssService.updateFeed(feed._id, updateData);
      
      toast.success('RSS feed updated successfully!');
      onFeedUpdated();
      onClose();
    } catch (error: any) {
      console.error('Failed to update RSS feed:', error);
      toast.error('Failed to update RSS feed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Edit RSS Feed
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(90vh-120px)] overflow-y-auto">
          {/* Feed Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Feed Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="My Blog RSS"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              autoFocus
            />
          </div>

          {/* Polling Interval */}
          <div>
            <label htmlFor="interval" className="block text-sm font-medium text-gray-700 mb-2">
              Check for new items every
            </label>
            <select
              id="interval"
              value={formData.pollingInterval}
              onChange={(e) => setFormData(prev => ({ ...prev, pollingInterval: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {pollingIntervals.map((interval) => (
                <option key={interval.value} value={interval.value}>
                  {interval.label}
                </option>
              ))}
            </select>
          </div>

          {/* Keyword Filters */}
          <div className="space-y-4">
            {/* Include Keywords */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Include Keywords (optional)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Articles must contain at least one of these keywords
              </p>
              <input
                type="text"
                placeholder="Type keyword and press Enter"
                onKeyPress={(e) => handleKeywordKeyPress(e, 'include')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {keywordsInclude.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {keywordsInclude.map((keyword) => (
                    <span
                      key={keyword}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                    >
                      {keyword}
                      <button
                        type="button"
                        onClick={() => removeKeyword('include', keyword)}
                        className="ml-1 text-green-600 hover:text-green-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Exclude Keywords */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exclude Keywords (optional)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Articles containing these keywords will be skipped
              </p>
              <input
                type="text"
                placeholder="Type keyword and press Enter"
                onKeyPress={(e) => handleKeywordKeyPress(e, 'exclude')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {keywordsExclude.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {keywordsExclude.map((keyword) => (
                    <span
                      key={keyword}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                    >
                      {keyword}
                      <button
                        type="button"
                        onClick={() => removeKeyword('exclude', keyword)}
                        className="ml-1 text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Platforms
            </label>
            <div className="grid grid-cols-2 gap-2">
              {platforms.map((platform) => (
                <div key={platform.id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`platform-${platform.id}`}
                    checked={selectedPlatforms.includes(platform.id)}
                    onChange={() => togglePlatform(platform.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`platform-${platform.id}`} className="ml-2 text-sm text-gray-700">
                    {platform.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name}
              className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Feed'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};