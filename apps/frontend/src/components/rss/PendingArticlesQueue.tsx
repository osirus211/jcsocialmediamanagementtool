/**
 * Pending Articles Queue Component
 * Shows pending RSS articles for approval/rejection
 */

import React, { useState, useEffect } from 'react';
import { 
  ExternalLink, 
  Calendar, 
  FileText, 
  CheckCircle,
  XCircle,
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Sparkles,
  Check,
  X
} from 'lucide-react';
import { rssService, RSSFeedItem } from '@/services/rss.service';
import { toast } from '@/lib/notifications';

interface PendingArticlesQueueProps {
  onArticleProcessed?: () => void;
}

export const PendingArticlesQueue: React.FC<PendingArticlesQueueProps> = ({ 
  onArticleProcessed 
}) => {
  const [articles, setArticles] = useState<RSSFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  useEffect(() => {
    loadPendingArticles();
  }, [currentPage]);

  const loadPendingArticles = async () => {
    setLoading(true);
    try {
      const result = await rssService.getPendingArticles(currentPage, 10);
      setArticles(result.articles);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Failed to load pending articles:', error);
      toast.error('Failed to load pending articles');
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

  const handleArticleAction = async (articleId: string, status: 'approved' | 'rejected') => {
    setProcessingIds(prev => new Set([...prev, articleId]));
    
    try {
      await rssService.updateArticleStatus(articleId, status);
      
      // Remove from list optimistically
      setArticles(prev => prev.filter(article => article._id !== articleId));
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
      
      toast.success(`Article ${status}`);
      onArticleProcessed?.();
    } catch (error) {
      console.error(`Failed to ${status} article:`, error);
      toast.error(`Failed to ${status} article`);
      
      // Reload to restore state on error
      loadPendingArticles();
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
    }
  };

  const handleBulkAction = async (status: 'approved' | 'rejected') => {
    if (selectedIds.size === 0) return;
    
    setBulkProcessing(true);
    
    try {
      const result = await rssService.bulkUpdateArticleStatus(
        Array.from(selectedIds), 
        status
      );
      
      // Remove processed articles from list
      setArticles(prev => prev.filter(article => !selectedIds.has(article._id)));
      setSelectedIds(new Set());
      
      toast.success(result.message);
      onArticleProcessed?.();
    } catch (error) {
      console.error(`Failed to bulk ${status} articles:`, error);
      toast.error(`Failed to bulk ${status} articles`);
      
      // Reload to restore state on error
      loadPendingArticles();
    } finally {
      setBulkProcessing(false);
    }
  };

  const toggleArticleSelection = (articleId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === articles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(articles.map(article => article._id)));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Pending Articles</h3>
          <div className="animate-pulse h-4 bg-gray-200 rounded w-20"></div>
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse border border-gray-200 rounded-lg p-4">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No pending articles
        </h3>
        <p className="text-gray-600">
          New articles will appear here when RSS feeds are updated
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Pending Articles ({articles.length})
          </h3>
          {articles.length > 0 && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedIds.size === articles.length && articles.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-600">
                Select all
              </span>
            </div>
          )}
        </div>
        
        {selectedIds.size > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => handleBulkAction('approved')}
              disabled={bulkProcessing}
              className="flex items-center px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              {bulkProcessing ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-1" />
              )}
              Approve All
            </button>
            <button
              onClick={() => handleBulkAction('rejected')}
              disabled={bulkProcessing}
              className="flex items-center px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
            >
              {bulkProcessing ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <X className="w-4 h-4 mr-1" />
              )}
              Reject All
            </button>
          </div>
        )}
      </div>

      {/* Articles List */}
      <div className="space-y-3">
        {articles.map((article) => (
          <div key={article._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start space-x-3">
              {/* Selection checkbox */}
              <input
                type="checkbox"
                checked={selectedIds.has(article._id)}
                onChange={() => toggleArticleSelection(article._id)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 mb-2">
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 flex items-center"
                  >
                    <span className="truncate">{article.title}</span>
                    <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
                  </a>
                </h4>
                
                <div className="flex items-center text-sm text-gray-500 mb-2">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>{formatDate(article.pubDate)}</span>
                  {article.author && (
                    <>
                      <span className="mx-2">•</span>
                      <span>by {article.author}</span>
                    </>
                  )}
                  <span className="mx-2">•</span>
                  <span className="text-blue-600">
                    {(article as any).feedId?.name || 'RSS Feed'}
                  </span>
                </div>
                
                {article.description && (
                  <p className="text-sm text-gray-600 mb-3">
                    {truncateDescription(article.description)}
                  </p>
                )}
                
                {article.categories && article.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {article.categories.slice(0, 3).map((category, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {category}
                      </span>
                    ))}
                    {article.categories.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{article.categories.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  onClick={() => handleArticleAction(article._id, 'approved')}
                  disabled={processingIds.has(article._id)}
                  className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
                >
                  {processingIds.has(article._id) ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-1" />
                  )}
                  Approve
                </button>
                <button
                  onClick={() => handleArticleAction(article._id, 'rejected')}
                  disabled={processingIds.has(article._id)}
                  className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
                >
                  {processingIds.has(article._id) ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-1" />
                  )}
                  Reject
                </button>
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
    </div>
  );
};