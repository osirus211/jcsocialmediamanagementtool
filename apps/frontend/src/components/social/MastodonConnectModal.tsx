import { useState, useEffect } from 'react';
import { X, ExternalLink, Info, Globe, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface MastodonConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface MastodonInstance {
  name: string;
  url: string;
  description: string;
}

export function MastodonConnectModal({ isOpen, onClose, onSuccess }: MastodonConnectModalProps) {
  const [instanceUrl, setInstanceUrl] = useState('');
  const [customInstance, setCustomInstance] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [popularInstances, setPopularInstances] = useState<MastodonInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [instanceValid, setInstanceValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPopularInstances();
    }
  }, [isOpen]);

  const loadPopularInstances = async () => {
    try {
      const response = await apiClient.get('/mastodon/instances/popular');
      setPopularInstances(response.instances || []);
    } catch (error) {
      console.error('Failed to load popular instances:', error);
      // Fallback to hardcoded list
      setPopularInstances([
        { name: 'mastodon.social', url: 'https://mastodon.social', description: 'The original Mastodon instance' },
        { name: 'fosstodon.org', url: 'https://fosstodon.org', description: 'For free and open source software enthusiasts' },
        { name: 'infosec.exchange', url: 'https://infosec.exchange', description: 'Information security community' },
        { name: 'hachyderm.io', url: 'https://hachyderm.io', description: 'Tech and security focused community' },
        { name: 'techhub.social', url: 'https://techhub.social', description: 'Technology professionals and enthusiasts' }
      ]);
    }
  };

  const validateInstance = async (url: string) => {
    if (!url.trim()) {
      setInstanceValid(null);
      return;
    }

    setIsValidating(true);
    try {
      const response = await apiClient.post('/mastodon/instances/validate', {
        instanceUrl: url.trim()
      });
      setInstanceValid(response.valid);
    } catch (error) {
      setInstanceValid(false);
    } finally {
      setIsValidating(false);
    }
  };

  const handleInstanceSelect = (instance: MastodonInstance) => {
    setSelectedInstance(instance.url);
    setInstanceUrl(instance.url);
    setShowCustomInput(false);
    setCustomInstance('');
    setInstanceValid(true);
    setError('');
  };

  const handleCustomInstanceChange = (value: string) => {
    setCustomInstance(value);
    setInstanceUrl(value);
    setSelectedInstance('');
    
    // Debounce validation
    const timeoutId = setTimeout(() => {
      validateInstance(value);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  const handleConnect = async () => {
    const finalInstanceUrl = showCustomInput ? customInstance.trim() : instanceUrl;
    
    if (!finalInstanceUrl) {
      setError('Please select or enter a Mastodon instance');
      return;
    }

    if (showCustomInput && instanceValid === false) {
      setError('Please enter a valid Mastodon instance URL');
      return;
    }

    setError('');
    setIsConnecting(true);

    try {
      const response = await apiClient.post('/mastodon/register', {
        instanceUrl: finalInstanceUrl
      });

      if (response.authUrl) {
        // Redirect to Mastodon OAuth
        window.location.href = response.authUrl;
      } else {
        throw new Error('No authorization URL returned');
      }
    } catch (error: any) {
      console.error('Mastodon connection failed:', error);
      
      const errorMessage = error.response?.data?.error || 'Failed to connect Mastodon account';
      setError(errorMessage);
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    if (!isConnecting) {
      setError('');
      setInstanceUrl('');
      setCustomInstance('');
      setSelectedInstance('');
      setShowCustomInput(false);
      setInstanceValid(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Connect Mastodon</h2>
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
          <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-purple-800">
                <p className="font-medium mb-2">About Mastodon:</p>
                <p className="text-purple-700">
                  Mastodon is a federated social network. Choose your instance (server) to connect your account. 
                  Each instance has its own community and rules, but you can interact with users from other instances.
                </p>
              </div>
            </div>
          </div>

          {/* Popular Instances */}
          {!showCustomInput && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Popular Instances</h3>
              <div className="space-y-2">
                {popularInstances.map((instance) => (
                  <button
                    key={instance.url}
                    onClick={() => handleInstanceSelect(instance)}
                    className={`w-full p-3 text-left border rounded-lg hover:bg-gray-50 transition-colors ${
                      selectedInstance === instance.url
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200'
                    }`}
                    disabled={isConnecting}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{instance.name}</span>
                          {selectedInstance === instance.url && (
                            <Check className="w-4 h-4 text-purple-600" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{instance.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Instance Toggle */}
          <div className="mb-4">
            <button
              onClick={() => {
                setShowCustomInput(!showCustomInput);
                if (!showCustomInput) {
                  setSelectedInstance('');
                  setInstanceUrl('');
                } else {
                  setCustomInstance('');
                  setInstanceValid(null);
                }
              }}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              disabled={isConnecting}
            >
              {showCustomInput ? '← Choose from popular instances' : 'Use a different instance'}
            </button>
          </div>

          {/* Custom Instance Input */}
          {showCustomInput && (
            <div className="mb-6">
              <label htmlFor="customInstance" className="block text-sm font-medium text-gray-700 mb-2">
                Instance URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  id="customInstance"
                  value={customInstance}
                  onChange={(e) => handleCustomInstanceChange(e.target.value)}
                  placeholder="https://your-instance.social"
                  className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    instanceValid === false ? 'border-red-300' : 
                    instanceValid === true ? 'border-green-300' : 'border-gray-300'
                  }`}
                  disabled={isConnecting}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  {isValidating ? (
                    <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                  ) : instanceValid === true ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : instanceValid === false ? (
                    <X className="w-4 h-4 text-red-600" />
                  ) : null}
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Enter the full URL of your Mastodon instance (e.g., https://mastodon.social)
              </p>
              {instanceValid === false && (
                <p className="mt-1 text-xs text-red-600">
                  This doesn't appear to be a valid Mastodon instance
                </p>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
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
              onClick={handleConnect}
              disabled={
                isConnecting || 
                (!instanceUrl && !customInstance) ||
                (showCustomInput && instanceValid === false)
              }
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? 'Connecting...' : 'Connect Account'}
            </button>
          </div>

          {/* Security Note */}
          <div className="mt-6 p-3 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-600">
              <strong>Privacy:</strong> We'll redirect you to your Mastodon instance to authorize access. 
              You can revoke access anytime from your instance's settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}