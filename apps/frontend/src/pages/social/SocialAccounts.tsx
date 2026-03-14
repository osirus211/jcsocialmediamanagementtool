import { useEffect, useState } from 'react';
import { socialService, SocialAccount } from '../../services/social.service';
import { Twitter, Linkedin, Facebook, Instagram, Plus, Trash2, AlertCircle } from 'lucide-react';
import { InstagramConnectModal } from '../../components/social/InstagramConnectModal';
import { LinkedInAccountCard } from '../../components/accounts/LinkedInAccountCard';
import { logger } from '../../lib/logger';

/**
 * Social Accounts Page
 * Connect and manage social media accounts
 */

const PLATFORM_CONFIG = {
  twitter: {
    name: 'Twitter',
    icon: Twitter,
    color: 'bg-blue-400',
    hoverColor: 'hover:bg-blue-500',
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-500',
    hoverColor: 'hover:bg-blue-600',
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: 'bg-gradient-to-r from-purple-500 to-pink-500',
    hoverColor: 'hover:from-purple-600 hover:to-pink-600',
  },
};

export function SocialAccounts() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [showInstagramModal, setShowInstagramModal] = useState(false);

  useEffect(() => {
    // Check for OAuth callback success/error first
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const oauthError = urlParams.get('error');
    
    if (success === 'true') {
      logger.info('OAuth success detected, loading accounts');
      // Clear query params from URL
      window.history.replaceState({}, '', '/social/accounts');
    } else if (oauthError) {
      logger.warn('OAuth error detected', { error: oauthError });
      const message = urlParams.get('message') || 'OAuth connection failed';
      setError(decodeURIComponent(message));
      // Clear query params from URL
      window.history.replaceState({}, '', '/social/accounts');
    }
    
    // Load accounts (will show newly connected account if OAuth succeeded)
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await socialService.getAccounts();
      setAccounts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform: string) => {
    logger.debug('handleConnect called', { platform });
    
    // Special handling for Instagram - show options modal
    if (platform === 'instagram') {
      logger.debug('Opening Instagram modal');
      setShowInstagramModal(true);
      return;
    }

    try {
      setConnectingPlatform(platform);
      const { url } = await socialService.getOAuthUrl(platform);
      // Redirect to OAuth URL
      window.location.href = url;
    } catch (err: any) {
      alert(err.message || `Failed to connect ${platform}`);
      setConnectingPlatform(null);
    }
  };

  const handleInstagramSuccess = () => {
    setShowInstagramModal(false);
    loadAccounts();
  };

  const handleDisconnect = async (accountId: string, platform?: string) => {
    try {
      await socialService.disconnectAccount(accountId);
      await loadAccounts();
    } catch (err: any) {
      alert(err.message || 'Failed to disconnect account');
    }
  };

  const getConnectedAccounts = (platform: string) => {
    return accounts.filter((acc) => acc.platform === platform);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Social Accounts</h1>
          <p className="text-gray-600 mt-2">Connect your social media accounts to start posting</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Connected Channels */}
        <div className="space-y-4">
          {Object.entries(PLATFORM_CONFIG).map(([platform, config]) => {
            const Icon = config.icon;
            const connectedAccounts = getConnectedAccounts(platform);
            const isConnecting = connectingPlatform === platform;

            // Special handling for LinkedIn - show individual account cards
            if (platform === 'linkedin' && connectedAccounts.length > 0) {
              return (
                <div key={platform} className="space-y-4">
                  {/* Platform Header */}
                  <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.color} text-white`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{config.name}</h3>
                        <p className="text-sm text-gray-500">
                          {connectedAccounts.length} account{connectedAccounts.length !== 1 ? 's' : ''} connected
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleConnect(platform)}
                      disabled={isConnecting}
                      className={`px-3 py-2 ${config.color} text-white rounded-lg ${config.hoverColor} transition flex items-center gap-2 disabled:opacity-50 text-sm`}
                    >
                      {isConnecting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Add Account
                        </>
                      )}
                    </button>
                  </div>

                  {/* LinkedIn Account Cards */}
                  {connectedAccounts.map((account) => (
                    <LinkedInAccountCard
                      key={account._id}
                      account={{
                        ...account,
                        connectedAt: account.connectedAt.toString(),
                      }}
                      onDisconnect={handleDisconnect}
                    />
                  ))}
                </div>
              );
            }

            // Default platform card for other platforms or when no accounts connected
            const hasConnectedAccount = connectedAccounts.length > 0;
            const firstAccount = connectedAccounts[0];

            return (
              <div
                key={platform}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${config.color} text-white`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{config.name}</h3>
                      {hasConnectedAccount ? (
                        <div className="mt-1">
                          <p className="text-sm text-gray-600">
                            @{firstAccount.username}
                          </p>
                          <p className="text-xs text-gray-500">
                            Connected {new Date(firstAccount.connectedAt).toLocaleDateString()}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 mt-1">Not connected</p>
                      )}
                    </div>
                  </div>

                  <div>
                    {hasConnectedAccount ? (
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to disconnect this ${platform} account?`)) {
                            handleDisconnect(firstAccount._id, platform);
                          }
                        }}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(platform)}
                        disabled={isConnecting}
                        className={`px-4 py-2 ${config.color} text-white rounded-lg ${config.hoverColor} transition flex items-center gap-2 disabled:opacity-50`}
                      >
                        {isConnecting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Connect
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Why connect accounts?</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Post to multiple platforms simultaneously</li>
            <li>• Schedule posts in advance</li>
            <li>• Track analytics across all platforms</li>
            <li>• Manage everything from one dashboard</li>
          </ul>
        </div>
      </div>

      {/* Instagram Connect Modal */}
      <InstagramConnectModal
        isOpen={showInstagramModal}
        onClose={() => setShowInstagramModal(false)}
        onSuccess={handleInstagramSuccess}
      />
    </div>
  );
}
