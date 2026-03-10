/**
 * RSS Feed Item List Component
 * Shows items from an RSS feed with draft conversion
 */

import React, { useState, useEffect } from 'react';
import { 
  ExternalLink, 
  Calendar, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Sparkles,
  CheckCircle
} from 'lucide-react';
import { rssService, RSSFeedItem, ConvertToDraftInput } from '@/services/rss.service';
import { toast } from '@/lib/notifications';
import { useNavigate } from 'react-router-dom';

interface RSSFeedItemListProps {
  feedId: string;
}

interface ConvertModalState {
  isOpen: boolean;
  item: RSSFeedItem | null;
}

export const RSSFeedItemList: React.FC<RSSFeedItemListProps> = ({ feedId }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<RSSFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [convertModal, setConvertModal] = useState<ConvertModalState>({ isOpen: false, item: null });
  const [converting, setConverting] = useState(false);
  const [convertedItems, setConvertedItems] = useState<Set<string>>(new Set());

  // Convert form state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['linkedin']);
  const [aiEnhance, setAiEnhance] = useState(false);
  const [tone, setTone] = useState<ConvertToDraftInput['tone']>('professional');

  const platforms = [
    { id: 'linkedin', name: 'LinkedIn' },
    { id: 'twitter', name: 'Twitter' },
    { id: 'facebook', name: 'Facebook' },
    { id: 'instagram', name: 'Instagram' },
  ];

  const tones = [
    { id: 'professional', name: 'Professional' },
    { id: 'casual', name: 'Casual' },
    { id: 'friendly', name: 'Friendly' },
    { id: 'humorous', name: 'Humorous' },
    { id: 'inspirational', name: 'Inspirational' },
  ];

  useEffect(() => {
    loadItems();
  }, [feedId, currentPage]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const result = await rssService.getFeedItems(feedId, currentPage, 10);
      setItems(result.items);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Failed to load RSS items:', error);
      toast.error('Failed to load RSS items');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'Unknown date';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const truncateDescription = (text?: string, maxLength = 150) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleConvertToDraft = async () => {
    if (!convertModal.item) return;

    setConverting(true);
    try {
      const result = await rssService.convertToDraft(convertModal.item._id, {
        platforms: selectedPlatforms,
        aiEnhance,
        tone,
      });

      setConvertedItems(prev => new Set([...prev, convertModal.item!._id]));
      setConvertModal({ isOpen: false, item: null });
      
      toast.success('Draft created successfully!');
      
      // Navigate to drafts page after a short delay
      setTimeout(() => {
        navigate('/drafts');
      }, 1000);
    } catch (error) {
      console.error('Failed to convert to draft:', error);
      toast.error('Failed to create draft');
    } finally {
      setConverting(false);
    }
  };

  const openConvertModal = (item: RSSFeedItem) => {
    setConvertModal({ isOpen: true, item });
    setSelectedPlatforms(['linkedin']); // Reset to default
    setAiEnhance(false);
    setTone('professional');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No items found in this feed</p>
        <p className="text-sm">Items will appear here after the next poll</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Items List */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 mb-2">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 flex items-center"
                  >
                    <span className="truncate">{item.title}</span>
                    <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
                  </a>
                </h4>
                
                <div className="flex items-center text-sm text-gray-500 mb-2">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>{formatDate(item.pubDate)}</span>
                  {item.author && (
                    <>
                      <span className="mx-2">•</span>
                      <span>by {item.author}</span>
                    </>
                  )}
                </div>
                
                {item.description && (
                  <p className="text-sm text-gray-600 mb-3">
                    {truncateDescription(item.description)}
                  </p>
                )}
                
                {item.categories && item.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.categories.slice(0, 3).map((category, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {category}
                      </span>
                    ))}
                    {item.categories.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{item.categories.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="ml-4 flex-shrink-0">
                {convertedItems.has(item._id) ? (
                  <div className="flex items-center text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    <span>Drafted</span>
                  </div>
                ) : (
                  <button
                    onClick={() => openConvertModal(item)}
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Create Draft
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </button>
          
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      )}

      {/* Convert to Draft Modal */}
      {convertModal.isOpen && convertModal.item && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Create Draft Post
              </h3>
              
              <div className="space-y-4">
                {/* Platform Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Platforms
                  </label>
                  <div className="space-y-2">
                    {platforms.map((platform) => (
                      <div key={platform.id} className="flex items-center">
                        <input
                          type="checkbox"
                          id={platform.id}
                          checked={selectedPlatforms.includes(platform.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPlatforms(prev => [...prev, platform.id]);
                            } else {
                              setSelectedPlatforms(prev => prev.filter(p => p !== platform.id));
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={platform.id} className="ml-2 text-sm text-gray-700">
                          {platform.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Enhancement */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="aiEnhance"
                    checked={aiEnhance}
                    onChange={(e) => setAiEnhance(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="aiEnhance" className="ml-2 flex items-center text-sm text-gray-700">
                    <Sparkles className="w-4 h-4 mr-1" />
                    AI Enhance content
                  </label>
                </div>

                {/* Tone Selection (only if AI enhance is enabled) */}
                {aiEnhance && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tone
                    </label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value as ConvertToDraftInput['tone'])}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {tones.map((toneOption) => (
                        <option key={toneOption.id} value={toneOption.id}>
                          {toneOption.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Preview */}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 font-medium mb-1">Preview:</p>
                  <p className="text-sm text-gray-800 line-clamp-3">
                    {convertModal.item.title}
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setConvertModal({ isOpen: false, item: null })}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConvertToDraft}
                  disabled={converting || selectedPlatforms.length === 0}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {converting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Draft'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};