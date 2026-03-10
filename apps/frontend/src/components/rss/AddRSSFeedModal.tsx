/**
 * Add RSS Feed Modal Component
 * Modal form for adding new RSS feeds
 */

import React, { useState } from 'react';
import { X, Loader2, Globe, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react';
import { rssService, CreateFeedInput } from '@/services/rss.service';
import { toast } from '@/lib/notifications';

interface AddRSSFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFeedAdded: () => void;
}

export const AddRSSFeedModal: React.FC<AddRSSFeedModalProps> = ({
  isOpen,
  onClose,
  onFeedAdded,
}) => {
  const [formData, setFormData] = useState({
    url: '',
    name: '',
    pollingInterval: 60,
    enabled: true,
  });
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['linkedin']);
  const [autoCreateDrafts, setAutoCreateDrafts] = useState(false);
  const [aiEnhanceDrafts, setAiEnhanceDrafts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);

  const platforms = [
    { id: 'linkedin', name: 'LinkedIn' },
    { id: 'twitter', name: 'Twitter' },
    { id: 'facebook', name: 'Facebook' },
    { id: 'instagram', name: 'Instagram' },
  ];

  const pollingIntervals = [
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' },
    { value: 360, label: '6 hours' },
    { value: 720, label: '12 hours' },
    { value: 1440, label: '24 hours' },
  ];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const validateUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleUrlChange = (url: string) => {
    setFormData(prev => ({ ...prev, url }));
    
    // Auto-generate name from URL if name is empty
    if (!formData.name && url) {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '');
        const suggestedName = hostname.split('.')[0];
        setFormData(prev => ({ 
          ...prev, 
          name: suggestedName.charAt(0).toUpperCase() + suggestedName.slice(1) + ' RSS'
        }));
      } catch {
        // Invalid URL, don't auto-generate name
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateUrl(formData.url)) {
      toast.error('Please enter a valid HTTP or HTTPS URL');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Please enter a feed name');
      return;
    }

    setLoading(true);
    setValidating(true);

    try {
      const feedInput: CreateFeedInput = {
        name: formData.name.trim(),
        url: formData.url.trim(),
        pollingInterval: formData.pollingInterval,
        enabled: formData.enabled,
      };

      await rssService.addFeed(feedInput);
      
      toast.success('RSS feed added successfully!');
      onFeedAdded();
      onClose();
      
      // Reset form
      setFormData({
        url: '',
        name: '',
        pollingInterval: 60,
        enabled: true,
      });
      setSelectedPlatforms(['linkedin']);
      setAutoCreateDrafts(false);
      setAiEnhanceDrafts(false);
    } catch (error: any) {
      console.error('Failed to add RSS feed:', error);
      if (error.response?.status === 400) {
        toast.error('Could not parse RSS feed — check the URL');
      } else {
        toast.error('Failed to add RSS feed');
      }
    } finally {
      setLoading(false);
      setValidating(false);
    }
  };

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Add RSS Feed
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* RSS URL */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              RSS Feed URL *
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="url"
                id="url"
                value={formData.url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://example.com/feed.xml"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

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

          {/* Auto-create Drafts Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-700">Auto-create drafts</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Automatically create draft posts from new RSS items
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoCreateDrafts(!autoCreateDrafts)}
              className="flex items-center"
            >
              {autoCreateDrafts ? (
                <ToggleRight className="w-6 h-6 text-blue-500" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-gray-400" />
              )}
            </button>
          </div>

          {/* AI Enhancement Toggle (only if auto-create is enabled) */}
          {autoCreateDrafts && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div>
                <div className="flex items-center">
                  <Sparkles className="w-4 h-4 text-blue-500 mr-1" />
                  <span className="text-sm font-medium text-gray-700">AI Enhance drafts</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Use AI to improve content before creating drafts
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAiEnhanceDrafts(!aiEnhanceDrafts)}
                className="flex items-center"
              >
                {aiEnhanceDrafts ? (
                  <ToggleRight className="w-6 h-6 text-blue-500" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-gray-400" />
                )}
              </button>
            </div>
          )}

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
              disabled={loading || !formData.url || !formData.name}
              className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {validating ? 'Validating feed...' : 'Adding...'}
                </>
              ) : (
                'Add Feed'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};