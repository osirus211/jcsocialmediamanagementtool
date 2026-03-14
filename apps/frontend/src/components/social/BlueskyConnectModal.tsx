import { useState } from 'react';
import { X, Eye, EyeOff, ExternalLink, Info } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface BlueskyConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BlueskyConnectModal({ isOpen, onClose, onSuccess }: BlueskyConnectModalProps) {
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsConnecting(true);

    try {
      await apiClient.post('/bluesky/connect', {
        handle: handle.trim(),
        appPassword: appPassword.trim(),
      });

      onSuccess();
      onClose();
      
      // Reset form
      setHandle('');
      setAppPassword('');
    } catch (error: any) {
      console.error('Bluesky connection failed:', error);
      
      const errorMessage = error.response?.data?.error || 'Failed to connect Bluesky account';
      const errorCode = error.response?.data?.code;
      
      if (errorCode === 'INVALID_CREDENTIALS') {
        setError('Invalid handle or app password. Please check your credentials.');
      } else if (errorCode === 'ACCOUNT_ALREADY_EXISTS') {
        setError('This Bluesky account is already connected.');
      } else if (errorCode === 'PROFILE_NOT_FOUND') {
        setError('Bluesky profile not found. Please check your handle.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    if (!isConnecting) {
      setError('');
      setHandle('');
      setAppPassword('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">🦋</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Connect Bluesky</h2>
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
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">How to create an App Password:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>Go to Bluesky Settings → Privacy & Security</li>
                  <li>Click "App Passwords"</li>
                  <li>Click "Add App Password"</li>
                  <li>Name it "Social Media Scheduler" and create</li>
                  <li>Copy the generated password and paste it below</li>
                </ol>
                <a
                  href="https://bsky.app/settings/app-passwords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center mt-2 text-blue-600 hover:text-blue-800 font-medium"
                >
                  Open Bluesky Settings
                  <ExternalLink className="w-4 h-4 ml-1" />
                </a>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Handle Input */}
            <div>
              <label htmlFor="handle" className="block text-sm font-medium text-gray-700 mb-2">
                Bluesky Handle
              </label>
              <input
                type="text"
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="username.bsky.social"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                required
                disabled={isConnecting}
              />
              <p className="mt-1 text-xs text-gray-500">
                Your full Bluesky handle (e.g., alice.bsky.social)
              </p>
            </div>

            {/* App Password Input */}
            <div>
              <label htmlFor="appPassword" className="block text-sm font-medium text-gray-700 mb-2">
                App Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="appPassword"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  required
                  disabled={isConnecting}
                  minLength={19}
                  maxLength={19}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={isConnecting}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                19-character app password from Bluesky settings
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isConnecting}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isConnecting || !handle.trim() || !appPassword.trim()}
                className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect Account'}
              </button>
            </div>
          </form>

          {/* Security Note */}
          <div className="mt-6 p-3 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-600">
              <strong>Security:</strong> Your app password is encrypted and stored securely. 
              You can revoke access anytime from your Bluesky settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}