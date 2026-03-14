import { SocialAccount, SocialPlatform, AccountStatus } from '@/types/social.types';
import { useSocialAccountStore } from '@/store/social.store';
import { useState } from 'react';

interface AccountCardProps {
  account: SocialAccount;
}

const platformIcons: Record<SocialPlatform, string> = {
  [SocialPlatform.TWITTER]: '𝕏',
  [SocialPlatform.LINKEDIN]: 'in',
  [SocialPlatform.FACEBOOK]: 'f',
  [SocialPlatform.INSTAGRAM]: '📷',
  [SocialPlatform.YOUTUBE]: '▶️',
  [SocialPlatform.THREADS]: '@',
  [SocialPlatform.BLUESKY]: '🦋',
  [SocialPlatform.MASTODON]: '🐘',
  [SocialPlatform.REDDIT]: '🔴',
  [SocialPlatform.GOOGLE_BUSINESS]: 'G',
  [SocialPlatform.PINTEREST]: 'P',
};

const platformColors: Record<SocialPlatform, string> = {
  [SocialPlatform.TWITTER]: 'bg-black text-white',
  [SocialPlatform.LINKEDIN]: 'bg-blue-600 text-white',
  [SocialPlatform.FACEBOOK]: 'bg-blue-500 text-white',
  [SocialPlatform.INSTAGRAM]: 'bg-gradient-to-br from-purple-600 to-pink-500 text-white',
  [SocialPlatform.YOUTUBE]: 'bg-red-600 text-white',
  [SocialPlatform.THREADS]: 'bg-black text-white',
  [SocialPlatform.BLUESKY]: 'bg-sky-500 text-white',
  [SocialPlatform.MASTODON]: 'bg-purple-600 text-white',
  [SocialPlatform.REDDIT]: 'bg-orange-500 text-white',
  [SocialPlatform.GOOGLE_BUSINESS]: 'bg-blue-700 text-white',
  [SocialPlatform.PINTEREST]: 'bg-red-600 text-white',
};

const statusColors: Record<AccountStatus, string> = {
  [AccountStatus.ACTIVE]: 'bg-green-100 text-green-800',
  [AccountStatus.EXPIRED]: 'bg-yellow-100 text-yellow-800',
  [AccountStatus.REVOKED]: 'bg-red-100 text-red-800',
};

export function AccountCard({ account }: AccountCardProps) {
  const { disconnectAccount, syncAccount } = useSocialAccountStore();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleDisconnect = async () => {
    if (!confirm(`Disconnect ${account.accountName}?`)) return;

    try {
      setIsDisconnecting(true);
      await disconnectAccount(account._id);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to disconnect account');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      await syncAccount(account._id);
      alert('Account synced successfully!');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to sync account';
      const requiresReconnect = error.response?.data?.requiresReconnect || error.response?.data?.error === 'TOKEN_EXPIRED';
      
      if (requiresReconnect) {
        alert(`${errorMessage}\n\nPlease disconnect and reconnect your account to continue using it.`);
      } else {
        alert(errorMessage);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold ${
              platformColors[account.platform]
            }`}
          >
            {platformIcons[account.platform]}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{account.accountName}</h3>
            <p className="text-sm text-gray-500 capitalize">{account.platform}</p>
          </div>
        </div>

        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            statusColors[account.status]
          }`}
        >
          {account.status}
        </span>
      </div>

      {account.metadata?.followerCount && (
        <div className="mt-3 text-sm text-gray-600">
          {account.metadata.followerCount.toLocaleString()} followers
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSync}
          disabled={isSyncing || account.status !== AccountStatus.ACTIVE}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSyncing ? 'Syncing...' : 'Sync'}
        </button>
        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="px-3 py-1.5 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
        </button>
      </div>

      {account.status === AccountStatus.EXPIRED && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          ⚠️ Connection expired. Please disconnect and reconnect this account.
        </div>
      )}

      {account.lastSyncAt && (
        <div className="mt-2 text-xs text-gray-400">
          Last synced: {new Date(account.lastSyncAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
