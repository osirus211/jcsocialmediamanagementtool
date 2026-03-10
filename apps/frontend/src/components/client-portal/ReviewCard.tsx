import React, { useState } from 'react';
import { ClientReview, clientPortalService } from '@/services/client-portal.service';
import { 
  Eye, 
  CheckCircle, 
  XCircle, 
  MessageCircle, 
  Calendar, 
  User, 
  Mail, 
  Copy, 
  ExternalLink,
  Trash2,
  MoreVertical
} from 'lucide-react';

interface ReviewCardProps {
  review: ClientReview;
  onDelete: () => void;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ review, onDelete }) => {
  const [showActions, setShowActions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      case 'changes_requested': return 'text-orange-600 bg-orange-100';
      case 'viewed': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'changes_requested': return <MessageCircle className="w-4 h-4" />;
      case 'viewed': return <Eye className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  const getPortalUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/review/${review.token}`;
  };

  const handleCopyUrl = async () => {
    const url = getPortalUrl();
    await navigator.clipboard.writeText(url);
    // Could add a toast notification here
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      await clientPortalService.deleteReview(review._id);
      onDelete();
    } catch (error) {
      console.error('Failed to delete review:', error);
      // Could add error handling here
    } finally {
      setIsDeleting(false);
    }
  };

  const isExpired = review.expiresAt && new Date(review.expiresAt) < new Date();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {review.name}
          </h3>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center">
              <User className="w-4 h-4 mr-1" />
              {review.createdBy.firstName} {review.createdBy.lastName}
            </div>
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              {new Date(review.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showActions && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
              <div className="py-1">
                <button
                  onClick={handleCopyUrl}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </button>
                <a
                  href={getPortalUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Review
                </a>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between mb-4">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(review.status)}`}>
          {getStatusIcon(review.status)}
          <span className="ml-2 capitalize">
            {review.status.replace('_', ' ')}
          </span>
        </div>

        {isExpired && (
          <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full">
            Expired
          </span>
        )}
      </div>

      {/* Client Info */}
      {(review.clientName || review.clientEmail) && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            {review.clientName && (
              <div className="flex items-center mb-1">
                <User className="w-4 h-4 mr-2" />
                {review.clientName}
              </div>
            )}
            {review.clientEmail && (
              <div className="flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                {review.clientEmail}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">{review.postIds.length}</div>
          <div className="text-xs text-gray-600">Posts</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">{review.viewCount}</div>
          <div className="text-xs text-gray-600">Views</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">
            {review.expiresAt ? Math.max(0, Math.ceil((new Date(review.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : '∞'}
          </div>
          <div className="text-xs text-gray-600">Days Left</div>
        </div>
      </div>

      {/* Client Feedback */}
      {review.clientFeedback && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm font-medium text-blue-900 mb-1">Client Feedback:</div>
          <div className="text-sm text-blue-800">{review.clientFeedback}</div>
        </div>
      )}

      {/* Reviewed At */}
      {review.reviewedAt && (
        <div className="mt-4 text-xs text-gray-500">
          Reviewed: {new Date(review.reviewedAt).toLocaleString()}
        </div>
      )}

      {/* Click outside to close actions menu */}
      {showActions && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowActions(false)}
        />
      )}
    </div>
  );
};