/**
 * Webhook Delivery Log Component
 * 
 * Displays detailed delivery history for a webhook endpoint
 */

import React, { useState, useEffect } from 'react';
import { webhooksService, WebhookDeliveryHistory, WebhookDelivery } from '@/services/webhooks.service';

// Simple utility to format time ago
const formatDistanceToNow = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
};

interface WebhookDeliveryLogProps {
  webhookId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const WebhookDeliveryLog: React.FC<WebhookDeliveryLogProps> = ({
  webhookId,
  isOpen,
  onClose,
}) => {
  const [deliveryHistory, setDeliveryHistory] = useState<WebhookDeliveryHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    event: '',
    status: '',
  });
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (isOpen && webhookId) {
      loadDeliveryHistory();
    }
  }, [isOpen, webhookId, filters]);

  const loadDeliveryHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const history = await webhooksService.getDeliveryHistory(webhookId, {
        limit: 50,
        skip: 0,
        event: filters.event || undefined,
        status: filters.status || undefined,
      });
      setDeliveryHistory(history);
    } catch (err: any) {
      setError(err.message || 'Failed to load delivery history');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    setRetrying(true);
    try {
      const result = await webhooksService.retryFailedDeliveries(webhookId);
      // Show success message (you might want to use a toast notification)
      alert(`${result.message}`);
      // Reload delivery history
      await loadDeliveryHistory();
    } catch (err: any) {
      alert(`Failed to retry deliveries: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  };

  const getStatusBadge = (status: WebhookDelivery['status']) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
    switch (status) {
      case 'success':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'failed':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'dead_letter':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'pending':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getStatusText = (status: WebhookDelivery['status']) => {
    switch (status) {
      case 'success':
        return 'Success';
      case 'failed':
        return 'Failed';
      case 'dead_letter':
        return 'Dead Letter';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Webhook Delivery History</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats and Filters */}
        {deliveryHistory && (
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex space-x-6">
                <div className="text-sm">
                  <span className="text-gray-500">Total:</span>
                  <span className="ml-1 font-medium">{deliveryHistory.stats.totalDeliveries}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Success:</span>
                  <span className="ml-1 font-medium text-green-600">{deliveryHistory.stats.successfulDeliveries}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Failed:</span>
                  <span className="ml-1 font-medium text-yellow-600">{deliveryHistory.stats.failedDeliveries}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Dead Letter:</span>
                  <span className="ml-1 font-medium text-red-600">{deliveryHistory.stats.deadLetterDeliveries}</span>
                </div>
              </div>
              <button
                onClick={handleRetryFailed}
                disabled={retrying || deliveryHistory.stats.failedDeliveries === 0}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {retrying ? 'Retrying...' : 'Retry Failed'}
              </button>
            </div>

            {/* Filters */}
            <div className="flex space-x-4">
              <select
                value={filters.event}
                onChange={(e) => setFilters({ ...filters, event: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">All Events</option>
                <option value="post.published">Post Published</option>
                <option value="post.failed">Post Failed</option>
                <option value="analytics.updated">Analytics Updated</option>
                <option value="follower.milestone">Follower Milestone</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">All Statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="dead_letter">Dead Letter</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="px-6 py-12 text-center">
              <div className="text-red-600 mb-2">Error loading delivery history</div>
              <div className="text-sm text-gray-500">{error}</div>
              <button
                onClick={loadDeliveryHistory}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : deliveryHistory?.deliveries.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No delivery history found
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {deliveryHistory?.deliveries.map((delivery) => (
                <div key={delivery._id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={getStatusBadge(delivery.status)}>
                          {getStatusText(delivery.status)}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{delivery.event}</span>
                        <span className="text-sm text-gray-500">
                          Attempt {delivery.attempt}/{delivery.maxAttempts}
                        </span>
                        {delivery.statusCode && (
                          <span className="text-sm text-gray-500">
                            HTTP {delivery.statusCode}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        {formatDistanceToNow(new Date(delivery.createdAt))}
                        {delivery.deliveredAt && (
                          <span className="ml-2">
                            • Delivered {formatDistanceToNow(new Date(delivery.deliveredAt))}
                          </span>
                        )}
                        {delivery.nextRetryAt && (
                          <span className="ml-2">
                            • Next retry {formatDistanceToNow(new Date(delivery.nextRetryAt))}
                          </span>
                        )}
                      </div>
                      {delivery.errorMessage && (
                        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                          {delivery.errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};