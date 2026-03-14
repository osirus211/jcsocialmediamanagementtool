import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircle, 
  XCircle, 
  MessageCircle, 
  Eye, 
  Calendar, 
  User, 
  Building, 
  Lock, 
  EyeOff,
  Send,
  ThumbsUp,
  ThumbsDown,
  Clock,
  ExternalLink,
  Shield
} from 'lucide-react';
import { clientPortalService, ClientPortal, PostApproval } from '@/services/client-portal.service';

interface Post {
  _id: string;
  content: string;
  scheduledAt?: string;
  socialAccountId: {
    platform: string;
    username: string;
    profilePicture?: string;
  };
  mediaUrls?: string[];
}

export const ClientPortalView: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  const [portal, setPortal] = useState<ClientPortal | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'comment' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (slug) {
      loadPortal();
    }
  }, [slug]);

  const loadPortal = async () => {
    if (!slug) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await clientPortalService.getPublicPortal(slug);
      setPortal(response.portal);
      setPosts(response.posts);
      
      // Check if password is required
      if (response.portal.passwordProtected) {
        setPasswordRequired(true);
      }
    } catch (err: any) {
      if (err.message.includes('password') || err.message.includes('protected')) {
        setPasswordRequired(true);
      } else {
        setError(err.message || 'Failed to load portal');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPassword = async () => {
    if (!slug || !password) return;

    try {
      setIsVerifyingPassword(true);
      const response = await clientPortalService.verifyPortalPassword(slug, password);
      
      if (response.valid) {
        setPasswordRequired(false);
        await loadPortal();
      } else {
        setError('Invalid password');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify password');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleAction = async (postId: string, action: 'approve' | 'reject' | 'comment') => {
    if (!slug) return;

    try {
      setIsSubmitting(true);
      
      if (action === 'approve') {
        await clientPortalService.approvePost(slug, postId, feedback);
      } else if (action === 'reject') {
        await clientPortalService.rejectPost(slug, postId, feedback);
      } else if (action === 'comment') {
        await clientPortalService.commentOnPost(slug, postId, feedback);
      }

      // Reload portal to get updated status
      await loadPortal();
      
      // Reset form
      setSelectedPost(null);
      setActionType(null);
      setFeedback('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit action');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPostApproval = (postId: string): PostApproval | undefined => {
    return portal?.postApprovals.find(approval => approval.postId === postId);
  };

  const getPostComments = (postId: string) => {
    return portal?.comments.filter(comment => comment.postId === postId) || [];
  };

  const getProgressStats = () => {
    if (!portal) return { reviewed: 0, total: 0, percentage: 0 };
    
    const total = portal.posts.length;
    const reviewed = portal.postApprovals.filter(
      a => a.status === 'approved' || a.status === 'rejected'
    ).length;
    const percentage = total > 0 ? (reviewed / total) * 100 : 0;
    
    return { reviewed, total, percentage };
  };

  const getPlatformIcon = (platform: string) => {
    // You can replace these with actual platform icons
    const icons: { [key: string]: string } = {
      facebook: '📘',
      instagram: '📷',
      twitter: '🐦',
      linkedin: '💼',
      tiktok: '🎵',
      youtube: '📺',
    };
    return icons[platform.toLowerCase()] || '📱';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading portal...</p>
        </div>
      </div>
    );
  }

  if (error && !passwordRequired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Portal Not Available</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (passwordRequired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md mx-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Protected Portal</h2>
            <p className="text-gray-600">This portal is password protected. Please enter the password to continue.</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && verifyPassword()}
                  placeholder="Enter portal password"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={verifyPassword}
              disabled={!password || isVerifyingPassword}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isVerifyingPassword ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Verifying...
                </div>
              ) : (
                'Access Portal'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Portal not found</p>
        </div>
      </div>
    );
  }

  const stats = getProgressStats();
  const isCompleted = stats.reviewed === stats.total && stats.total > 0;

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: '#f9fafb',
        '--primary-color': portal.branding.primaryColor,
        '--accent-color': portal.branding.accentColor,
      } as React.CSSProperties}
    >
      {/* Header */}
      <div 
        className="bg-white shadow-sm border-b"
        style={{ borderBottomColor: portal.branding.primaryColor + '20' }}
      >
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {portal.branding.logo && (
                <img
                  src={portal.branding.logo}
                  alt={portal.branding.companyName}
                  className="h-12 w-auto"
                />
              )}
              <div>
                <h1 
                  className="text-2xl font-bold"
                  style={{ color: portal.branding.primaryColor }}
                >
                  {portal.branding.companyName}
                </h1>
                <p className="text-gray-600">{portal.name}</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <User className="w-4 h-4 mr-1" />
                {portal.clientName}
              </div>
              {portal.clientCompany && (
                <div className="flex items-center text-sm text-gray-600">
                  <Building className="w-4 h-4 mr-1" />
                  {portal.clientCompany}
                </div>
              )}
            </div>
          </div>

          {portal.branding.customMessage && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-gray-700">{portal.branding.customMessage}</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Review Progress</span>
            <span className="text-sm text-gray-600">{stats.reviewed} of {stats.total} posts reviewed</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{ 
                width: `${stats.percentage}%`,
                backgroundColor: portal.branding.accentColor 
              }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {isCompleted ? (
          /* Completion Screen */
          <div className="text-center py-12">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: portal.branding.accentColor + '20' }}
            >
              <CheckCircle 
                className="w-10 h-10"
                style={{ color: portal.branding.accentColor }}
              />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">All Posts Reviewed!</h2>
            <p className="text-gray-600 mb-8">
              Thank you for reviewing all the content. Your feedback has been recorded and the team will be notified.
            </p>
            <div className="bg-white rounded-lg shadow-sm p-6 max-w-md mx-auto">
              <h3 className="font-semibold text-gray-900 mb-4">Review Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Posts:</span>
                  <span className="font-medium">{stats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span>Approved:</span>
                  <span className="font-medium text-green-600">
                    {portal.postApprovals.filter(a => a.status === 'approved').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Rejected:</span>
                  <span className="font-medium text-red-600">
                    {portal.postApprovals.filter(a => a.status === 'rejected').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Comments:</span>
                  <span className="font-medium">{portal.comments.length}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Posts Grid */
          <div className="space-y-6">
            {posts.map((post) => {
              const approval = getPostApproval(post._id);
              const comments = getPostComments(post._id);
              const isReviewed = approval && (approval.status === 'approved' || approval.status === 'rejected');

              return (
                <div key={post._id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {/* Post Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getPlatformIcon(post.socialAccountId.platform)}</span>
                        <div>
                          <p className="font-medium text-gray-900 capitalize">
                            {post.socialAccountId.platform}
                          </p>
                          <p className="text-sm text-gray-600">@{post.socialAccountId.username}</p>
                        </div>
                      </div>
                      
                      {post.scheduledAt && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(post.scheduledAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Post Content */}
                  <div className="p-4">
                    <p className="text-gray-900 whitespace-pre-wrap mb-4">{post.content}</p>
                    
                    {post.mediaUrls && post.mediaUrls.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {post.mediaUrls.slice(0, 4).map((url, index) => (
                          <img
                            key={index}
                            src={url}
                            alt={`Media ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    )}

                    {/* Status Badge */}
                    {isReviewed && (
                      <div className="mb-4">
                        {approval?.status === 'approved' ? (
                          <span 
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                            style={{ backgroundColor: portal.branding.accentColor }}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                            <XCircle className="w-4 h-4 mr-1" />
                            Rejected
                          </span>
                        )}
                        {approval?.feedback && (
                          <p className="text-sm text-gray-600 mt-2">
                            <strong>Feedback:</strong> {approval.feedback}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Comments */}
                    {comments.length > 0 && (
                      <div className="mb-4 space-y-2">
                        <h4 className="text-sm font-medium text-gray-900">Comments:</h4>
                        {comments.map((comment, index) => (
                          <div key={index} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm text-gray-700">{comment.text}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(comment.createdAt).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!isReviewed && (
                      <div className="flex items-center space-x-2">
                        {portal.allowedActions.approve && (
                          <button
                            onClick={() => {
                              setSelectedPost(post._id);
                              setActionType('approve');
                            }}
                            className="flex items-center px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                            style={{ backgroundColor: portal.branding.accentColor }}
                          >
                            <ThumbsUp className="w-4 h-4 mr-2" />
                            Approve
                          </button>
                        )}
                        
                        {portal.allowedActions.reject && (
                          <button
                            onClick={() => {
                              setSelectedPost(post._id);
                              setActionType('reject');
                            }}
                            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            <ThumbsDown className="w-4 h-4 mr-2" />
                            Reject
                          </button>
                        )}
                        
                        {portal.allowedActions.comment && (
                          <button
                            onClick={() => {
                              setSelectedPost(post._id);
                              setActionType('comment');
                            }}
                            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Comment
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {selectedPost && actionType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {actionType === 'approve' ? 'Approve Post' :
                 actionType === 'reject' ? 'Reject Post' : 'Add Comment'}
              </h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {actionType === 'comment' ? 'Comment' : 'Feedback (optional)'}
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={
                    actionType === 'approve' ? 'Any additional notes...' :
                    actionType === 'reject' ? 'Please explain why this post needs changes...' :
                    'Add your comment...'
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setSelectedPost(null);
                    setActionType(null);
                    setFeedback('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction(selectedPost, actionType)}
                  disabled={isSubmitting || (actionType === 'comment' && !feedback.trim())}
                  className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ 
                    backgroundColor: actionType === 'reject' ? '#dc2626' : portal.branding.primaryColor 
                  }}
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Submitting...
                    </div>
                  ) : (
                    actionType === 'approve' ? 'Approve' :
                    actionType === 'reject' ? 'Reject' : 'Add Comment'
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