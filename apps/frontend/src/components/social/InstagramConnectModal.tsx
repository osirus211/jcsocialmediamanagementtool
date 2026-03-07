/**
 * Instagram Connect Modal - Simplified
 * 
 * Direct connection to Instagram Professional accounts
 * No provider selection needed - unified flow
 */

import { useState } from 'react';
import { Instagram, X, Info, CheckCircle } from 'lucide-react';
import { apiClient } from '../../lib/api-client';

interface InstagramConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function InstagramConnectModal({ isOpen, onClose, onSuccess }: InstagramConnectModalProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);

      const response = await apiClient.post<{
        success: boolean;
        authorizationUrl: string;
        state: string;
      }>('/oauth/instagram/connect', { providerType: 'INSTAGRAM_BUSINESS' });

      // Redirect to OAuth URL
      window.location.href = response.authorizationUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to initiate connection');
      setConnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Instagram className="w-6 h-6 text-white" />
              <h2 className="text-xl font-bold text-white">Connect Instagram</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition"
              disabled={connecting}
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Error Alert */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800">
                <Info className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              Connect your Instagram Professional account to schedule and publish content.
            </p>

            {/* Features */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">What you can do:</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Publish posts, stories, and reels</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Schedule content in advance</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Manage comments and messages</span>
                </li>
              </ul>
            </div>

            {/* Requirements */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Requirements:</p>
                  <p className="text-blue-800">
                    You need an Instagram Professional account (Business or Creator). 
                    Personal accounts are not supported.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Connect Button */}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {connecting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Connecting...
              </>
            ) : (
              <>
                <Instagram className="w-5 h-5" />
                Connect Instagram Account
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
