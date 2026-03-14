import { useState } from 'react';
import { X, ExternalLink, Info, MessageSquare } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface RedditConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RedditConnectModal({ isOpen, onClose, onSuccess }: RedditConnectModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setError('');
    setIsConnecting(true);

    try {
      const response = await apiClient.get('/oauth/reddit/authorize');

      if (response.url) {
        // Redirect to Reddit OAuth
        window.location.href = response.url;
      } else {
        throw new Error('No authorization URL returned');
      }
    } catch (error: any) {
      console.error('Reddit connection failed:', error);
      
      const errorMessage = error.response?.data?.error || 'Failed to connect Reddit account';
      setError(errorMessage);
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    if (!isConnecting) {
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Connect Reddit</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isConnecting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Instructions */}
          <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-orange-800">
                <p className="font-medium mb-2">Connect your Reddit account to:</p>
                <ul className="list-disc list-inside space-y-1 text-orange-700">
                  <li>Post to your subscribed subreddits</li>
                  <li>Schedule text, link, image, and video posts</li>
                  <li>Use subreddit-specific flairs</li>
                  <li>Track karma and engagement metrics</li>
                  <li>Cross-post between subreddits</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">What you can do:</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Text Posts</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Link Posts</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Image Posts</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Video Posts</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Crossposts</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Flair Support</span>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="mb-6 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Required Permissions:</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• <strong>submit</strong> - Post content to subreddits</li>
              <li>• <strong>read</strong> - Access your subscribed subreddits</li>
              <li>• <strong>identity</strong> - View your Reddit username and karma</li>
              <li>• <strong>mysubreddits</strong> - Access your subreddit list</li>
              <li>• <strong>flair</strong> - Use and manage post flairs</li>
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isConnecting}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>Connect Reddit</span>
                  <ExternalLink className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Security Note */}
          <div className="mt-6 p-3 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-600">
              <strong>Privacy:</strong> We'll redirect you to Reddit to authorize access. 
              You can revoke access anytime from your Reddit account preferences.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}