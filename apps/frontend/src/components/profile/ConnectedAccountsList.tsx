/**
 * Connected Accounts List Component
 * 
 * Displays user's connected social media accounts
 */

import { useState, useEffect } from 'react';
import { Link, ExternalLink, Plus, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { socialService } from '@/services/social.service';
import type { SocialAccount } from '@/types/social.types';
import { AccountStatus } from '@/types/social.types';
import type { SocialAccount as ServiceSocialAccount } from '@/services/social.service';

export function ConnectedAccountsList() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<ServiceSocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const accountsData = await socialService.getAccounts();
      setAccounts(accountsData);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load connected accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      facebook: '📘',
      instagram: '📷',
      twitter: '🐦',
      linkedin: '💼',
      youtube: '📺',
      tiktok: '🎵',
      pinterest: '📌',
      threads: '🧵',
      bluesky: '🦋',
    };
    return icons[platform.toLowerCase()] || '🔗';
  };

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      facebook: 'bg-blue-100 text-blue-800 border-blue-200',
      instagram: 'bg-pink-100 text-pink-800 border-pink-200',
      twitter: 'bg-sky-100 text-sky-800 border-sky-200',
      linkedin: 'bg-blue-100 text-blue-800 border-blue-200',
      youtube: 'bg-red-100 text-red-800 border-red-200',
      tiktok: 'bg-gray-100 text-gray-800 border-gray-200',
      pinterest: 'bg-red-100 text-red-800 border-red-200',
      threads: 'bg-gray-100 text-gray-800 border-gray-200',
      bluesky: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return colors[platform.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      case 'expired':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Connected';
      case 'error':
        return 'Error';
      case 'expired':
        return 'Expired';
      default:
        return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Accounts</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={loadAccounts}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {accounts.length === 0 
            ? 'No connected accounts' 
            : `${accounts.length} connected account${accounts.length === 1 ? '' : 's'}`
          }
        </p>
        
        <button
          onClick={() => navigate('/connect-v2')}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Connect Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <Link className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Connected Accounts</h3>
          <p className="text-gray-600 mb-4">
            Connect your social media accounts to start managing your posts
          </p>
          <button
            onClick={() => navigate('/connect-v2')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Connect Your First Account
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account._id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg border ${getPlatformColor(account.platform)}`}>
                  <span className="text-lg">
                    {getPlatformIcon(account.platform)}
                  </span>
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">
                      {account.displayName || account.username}
                    </h4>
                {account.isActive ? (
                  <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                    Connected
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                    Disconnected
                  </span>
                )}
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <p className="capitalize">{account.platform}</p>
                    {account.profileImageUrl && (
                      <a
                        href={`https://${account.platform}.com/${account.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                      >
                        View Profile
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <p className="text-xs text-gray-500">
                      Connected {new Date(account.connectedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!account.isActive && (
                  <button
                    onClick={() => navigate('/connect-v2')}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                  >
                    Reconnect
                  </button>
                )}
                
                <button
                  onClick={() => navigate('/social/accounts')}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">About Connected Accounts</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Connected accounts allow you to publish posts directly to your social media</li>
          <li>• You can manage posting permissions and view analytics for each account</li>
          <li>• Accounts may need to be reconnected periodically for security</li>
          <li>• You can disconnect accounts at any time from the Social Accounts page</li>
        </ul>
      </div>
    </div>
  );
}