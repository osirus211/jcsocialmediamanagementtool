import { useEffect, useState } from 'react';
import { useSocialAccountStore } from '@/store/social.store';
import { SocialPlatform, AccountStatus } from '@/types/social.types';
import { Check } from 'lucide-react';

interface AccountSelectorProps {
  value: string | string[];
  onChange: (accountId: string | string[]) => void;
  multiSelect?: boolean;
  platformFilter?: SocialPlatform;
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
  [SocialPlatform.TIKTOK]: '🎵',
};

export function AccountSelector({ 
  value, 
  onChange, 
  multiSelect = false,
  platformFilter 
}: AccountSelectorProps) {
  const { accounts, accountsLoaded, fetchAccounts } = useSocialAccountStore();
  const [selectedIds, setSelectedIds] = useState<string[]>(
    Array.isArray(value) ? value : value ? [value] : []
  );

  useEffect(() => {
    if (!accountsLoaded) {
      fetchAccounts();
    }
  }, [accountsLoaded, fetchAccounts]);

  useEffect(() => {
    setSelectedIds(Array.isArray(value) ? value : value ? [value] : []);
  }, [value]);

  const activeAccounts = accounts
    .filter((a) => a.status === AccountStatus.ACTIVE)
    .filter((a) => !platformFilter || a.platform === platformFilter);

  const handleToggle = (accountId: string) => {
    if (!multiSelect) {
      onChange(accountId);
      return;
    }

    const newSelectedIds = selectedIds.includes(accountId)
      ? selectedIds.filter((id) => id !== accountId)
      : [...selectedIds, accountId];
    
    setSelectedIds(newSelectedIds);
    onChange(newSelectedIds);
  };

  if (!accountsLoaded) {
    return <div className="text-gray-500">Loading accounts...</div>;
  }

  if (activeAccounts.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">
          No active accounts connected. Please connect an account first.
        </p>
      </div>
    );
  }

  // Single select mode (dropdown)
  if (!multiSelect) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Account
        </label>
        <select
          value={Array.isArray(value) ? value[0] || '' : value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        >
          <option value="">Choose an account...</option>
          {activeAccounts.map((account) => (
            <option key={account._id} value={account._id}>
              {platformIcons[account.platform]} {account.accountName} ({account.platform})
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Multi-select mode (checkboxes)
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Accounts
      </label>
      <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
        {activeAccounts.map((account) => {
          const isSelected = selectedIds.includes(account._id);
          
          return (
            <button
              key={account._id}
              type="button"
              onClick={() => handleToggle(account._id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div
                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                  isSelected
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-300'
                }`}
              >
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </div>
              
              <div className="flex items-center gap-2 flex-1 text-left">
                <span className="text-lg">{platformIcons[account.platform]}</span>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {account.accountName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {account.platform}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {selectedIds.length > 0 && (
        <p className="mt-2 text-sm text-gray-600">
          {selectedIds.length} account{selectedIds.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
}
