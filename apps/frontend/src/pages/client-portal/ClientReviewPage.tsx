import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { clientPortalService, PublicReviewResponse, SubmitFeedbackInput } from '@/services/client-portal.service';
import { StatusBadge } from '@/components/posts/StatusBadge';
import { CheckCircle, XCircle, MessageCircle, Eye, Calendar, User } from 'lucide-react';

/**
 * ClientReviewPage Component
 * 
 * Public page for client review sessions (no authentication required)
 */
export const ClientReviewPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [reviewData, setReviewData] = useState<PublicReviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'approved' | 'rejected' | 'changes_requested' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    if (token) {
      loadReview();
    }
  }, [token]);

  // Apply branding styles
  useEffect(() => {
    if (reviewData?.branding?.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', reviewData.branding.primaryColor);
    }
    
    return () => {
      document.documentElement.style.removeProperty('--primary-color');
    };
  }, [reviewData?.branding?.primaryColor]);

  const loadReview = async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const data = await clientPortalService.getPublicReview(token);
      setReviewData(data);
      
      // Check if already submitted
      if (data.review.status !== 'pending' && data.review.status !== 'viewed') {
        setHasSubmitted(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load review');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!token || !selectedStatus) return;

    try {
      setIsSubmitting(true);
      
      const input: SubmitFeedbackInput = {
        status: selectedStatus,
        feedback: feedback.trim() || undefined,
      };

      await clientPortalService.submitFeedback(token, input);
      setHasSubmitted(true);
      
      // Reload to get updated data
      await loadReview();
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600';
      case 'rejected': return 'text-red-600';
      case 'changes_requested': return 'text-orange-600';
      case 'viewed': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-5 h-5" />;
      case 'rejected': return <XCircle className="w-5 h-5" />;
      case 'changes_requested': return <MessageCircle className="w-5 h-5" />;
      case 'viewed': return <Eye className="w-5 h-5" />;
      default: return <Calendar className="w-5 h-5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading review...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Review Not Found</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            This review may have expired or the link may be invalid.
          </p>
        </div>
      </div>
    );
  }

  if (!reviewData) return null;

  const { review, posts, branding } = reviewData;
  const brandName = branding.brandName || 'Client Review';
  const welcomeMessage = branding.welcomeMessage || 'Please review the following posts and provide your feedback.';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {branding.logoUrl && (
                <img
                  src={branding.logoUrl}
                  alt={brandName}
                  className="h-10 w-auto"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{brandName}</h1>
                <p className="text-gray-600">{review.name}</p>
              </div>
            </div>
            
            <div className={`flex items-center space-x-2 ${getStatusColor(review.status)}`}>
              {getStatusIcon(review.status)}
              <span className="font-medium capitalize">
                {review.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Welcome Message */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <p className="text-gray-700 text-lg leading-relaxed">{welcomeMessage}</p>
          
          {review.clientName && (
            <div className="mt-4 flex items-center text-sm text-gray-600">
              <User className="w-4 h-4 mr-2" />
              <span>For: {review.clientName}</span>
            </div>
          )}
        </div>

        {/* Posts */}
        <div className="space-y-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900">
            Posts for Review ({posts.length})
          </h2>
          
          {posts.map((post, index) => (
            <div key={post._id} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <StatusBadge status={post.status} />
                      {post.socialAccountId && (
                        <span className="text-sm text-gray-500">
                          {post.socialAccountId.platform} • @{post.socialAccountId.username}
                        </span>
                      )}
                    </div>
                    {post.scheduledAt && (
                      <p className="text-sm text-gray-500 mt-1">
                        Scheduled: {new Date(post.scheduledAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="prose max-w-none">
                <p className="text-gray-900 whitespace-pre-wrap">{post.content}</p>
              </div>
              
              {post.mediaUrls && post.mediaUrls.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {post.mediaUrls.map((url: string, mediaIndex: number) => (
                    <img
                      key={mediaIndex}
                      src={url}
                      alt={`Media ${mediaIndex + 1}`}
                      className="rounded-lg max-h-64 object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Feedback Section */}
        {!hasSubmitted ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Feedback</h3>
            
            {/* Status Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                What's your decision?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => setSelectedStatus('approved')}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    selectedStatus === 'approved'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <CheckCircle className="w-5 h-5 mb-2" />
                  <div className="font-medium">Approve</div>
                  <div className="text-sm text-gray-600">Ready to publish</div>
                </button>
                
                <button
                  onClick={() => setSelectedStatus('changes_requested')}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    selectedStatus === 'changes_requested'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <MessageCircle className="w-5 h-5 mb-2" />
                  <div className="font-medium">Request Changes</div>
                  <div className="text-sm text-gray-600">Needs modifications</div>
                </button>
                
                <button
                  onClick={() => setSelectedStatus('rejected')}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    selectedStatus === 'rejected'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-red-300'
                  }`}
                >
                  <XCircle className="w-5 h-5 mb-2" />
                  <div className="font-medium">Reject</div>
                  <div className="text-sm text-gray-600">Do not publish</div>
                </button>
              </div>
            </div>

            {/* Feedback Text */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Comments (Optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share any specific feedback, suggestions, or concerns..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                maxLength={2000}
              />
              <div className="text-right text-sm text-gray-500 mt-1">
                {feedback.length}/2000
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitFeedback}
              disabled={!selectedStatus || isSubmitting}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: branding.primaryColor || '#3b82f6' }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Thank You for Your Feedback!
            </h3>
            <p className="text-gray-600 mb-4">
              Your review has been submitted successfully.
            </p>
            
            {review.clientFeedback && (
              <div className="bg-gray-50 rounded-lg p-4 mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Your feedback:</p>
                <p className="text-gray-600 text-left">{review.clientFeedback}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};