import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Copy, ExternalLink } from 'lucide-react';
import { clientPortalService, CreateReviewInput } from '@/services/client-portal.service';
import { usePostStore } from '@/store/post.store';
import { PostStatus } from '@/types/post.types';

interface CreateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedPostIds?: string[];
}

export const CreateReviewModal: React.FC<CreateReviewModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedPostIds = [],
}) => {
  const { posts, fetchPosts } = usePostStore();
  const [formData, setFormData] = useState<CreateReviewInput>({
    name: '',
    postIds: preselectedPostIds,
    clientEmail: '',
    clientName: '',
    expiresInDays: 7,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdReview, setCreatedReview] = useState<{
    review: any;
    portalUrl: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPosts({ status: PostStatus.SCHEDULED });
      setFormData(prev => ({
        ...prev,
        postIds: preselectedPostIds,
      }));
    }
  }, [isOpen, preselectedPostIds, fetchPosts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.postIds.length === 0) {
      setError('Please select at least one post');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      const result = await clientPortalService.createReview(formData);
      setCreatedReview(result);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostToggle = (postId: string) => {
    setFormData(prev => ({
      ...prev,
      postIds: prev.postIds.includes(postId)
        ? prev.postIds.filter(id => id !== postId)
        : [...prev.postIds, postId],
    }));
  };

  const handleCopyUrl = async () => {
    if (createdReview?.portalUrl) {
      await navigator.clipboard.writeText(createdReview.portalUrl);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      postIds: [],
      clientEmail: '',
      clientName: '',
      expiresInDays: 7,
    });
    setError(null);
    setCreatedReview(null);
    onClose();
  };

  if (!isOpen) return null;

  // Success state - show created review
  if (createdReview) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Review Created!</h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-gray-600 mb-4">
                Your client review has been created successfully. Share the link below with your client.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Link
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={createdReview.portalUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    title="Copy link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <a
                    href={createdReview.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    title="Open link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Next steps:</strong> Share this link with your client. 
                  They can review the posts and provide feedback without needing to log in.
                </p>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Create Client Review</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Review Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Review Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., March Campaign Review"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                maxLength={200}
              />
            </div>

            {/* Client Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Name
                </label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Client's name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Email
                </label>
                <input
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
                  placeholder="client@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Expiration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expires In
              </label>
              <select
                value={formData.expiresInDays}
                onChange={(e) => setFormData(prev => ({ ...prev, expiresInDays: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={1}>1 day</option>
                <option value={3}>3 days</option>
                <option value={7}>1 week</option>
                <option value={14}>2 weeks</option>
                <option value={30}>1 month</option>
              </select>
            </div>

            {/* Post Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Posts * ({formData.postIds.length} selected)
              </label>
              <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                {posts.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No scheduled posts available
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {posts.map((post) => (
                      <div key={post._id} className="p-3">
                        <label className="flex items-start space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.postIds.includes(post._id)}
                            onChange={() => handlePostToggle(post._id)}
                            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {post.content.substring(0, 100)}
                              {post.content.length > 100 && '...'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {post.scheduledAt && new Date(post.scheduledAt).toLocaleString()}
                            </div>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || formData.postIds.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Creating...' : 'Create Review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};