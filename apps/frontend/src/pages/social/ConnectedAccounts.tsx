import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSocialAccountStore } from '@/store/social.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { AccountCard } from '@/components/social/AccountCard';
import { ConnectButton } from '@/components/social/ConnectButton';
import { SuccessToast } from '@/components/feedback/SuccessToast';
import { TokenHealthDashboard } from '@/components/tokens/TokenHealthDashboard';
import { SocialPlatform, SocialAccount } from '@/types/social.types';
import { AlertCircle } from 'lucide-react';

/**
 * Type guard to check if an ID is valid (non-null, non-empty string)
 */
const isValidId = (id: any): id is string => {
  return typeof id === 'string' && id.length > 0;
};

/**
 * Generates a unique key for an account with fallback strategies
 * 
 * Strategy:
 * 1. Use account._id if valid (non-null, non-empty string)
 * 2. Fallback to platform-accountId combination if both exist
 * 3. Fallback to platform-accountName combination if both exist
 * 4. Last resort: use array index
 * 
 * Note: To handle duplicate IDs, this function should be called with a Set
 * to track seen IDs and append index if duplicate is detected.
 * 
 * @param account - The social account object
 * @param index - The array index of the account
 * @param seenIds - Optional Set to track seen IDs for duplicate detection
 * @returns A unique key string for React rendering
 */
const generateAccountKey = (
  account: SocialAccount, 
  index: number,
  seenIds?: Set<string>
): string => {
  let key: string;

  // Primary: Use account._id if valid
  if (isValidId(account._id)) {
    key = account._id;
  }
  // Fallback 1: Use platform-accountId combination
  else if (account.platform && account.accountId) {
    key = `${account.platform}-${account.accountId}`;
  }
  // Fallback 2: Use platform-accountName combination
  else if (account.platform && account.accountName) {
    key = `${account.platform}-${account.accountName}`;
  }
  // Fallback 3: Use array index as last resort
  else {
    key = `account-${index}`;
  }

  // Handle duplicates by appending index
  if (seenIds) {
    if (seenIds.has(key)) {
      key = `${key}-${index}`;
    }
    seenIds.add(key);
  }

  return key;
};

export const ConnectedAccountsPage = () => {
  const { currentWorkspace } = useWorkspaceStore();
  const { accounts, isLoading, accountsLoaded, fetchAccounts } = useSocialAccountStore();
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [searchParams] = useSearchParams();
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // OAuth callback detection effect
  useEffect(() => {
    const success = searchParams.get('success');
    const errorParam = searchParams.get('error');
    const message = searchParams.get('message');
    const platform = searchParams.get('platform');
    const account = searchParams.get('account');

    // Handle OAuth success callback
    if (success === 'true' && platform) {
      // Trigger account refresh
      fetchAccounts();

      // Show success toast
      const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
      setSuccessMessage(`${platformName} account connected successfully!`);
      setShowSuccessToast(true);

      // Clean up URL parameters
      window.history.replaceState({}, '', '/social/accounts');
    }
    // Handle OAuth error callback
    else if (errorParam) {
      // Show error message
      const errorMessage = message ? decodeURIComponent(message) : 'Failed to connect account';
      setError(errorMessage);

      // Clean up URL parameters
      window.history.replaceState({}, '', '/social/accounts');
    }
  }, [searchParams, fetchAccounts]);

  useEffect(() => {
    if (currentWorkspace && !accountsLoaded) {
      fetchAccounts();
    }
  }, [currentWorkspace, accountsLoaded, fetchAccounts]);

  if (!currentWorkspace) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">
          Please select a workspace first
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Channels</h1>
            <p className="text-gray-600 mt-1">
              Manage your connected channels for {currentWorkspace.name}
            </p>
          </div>
          <button
            onClick={() => setShowConnectDialog(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Connect Channel
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 flex-shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Token Health Dashboard - only show if we have accounts */}
        {accounts.length > 0 && (
          <div className="mb-8">
            <TokenHealthDashboard />
          </div>
        )}

        {isLoading && !accountsLoaded ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading accounts...</div>
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <div className="text-gray-500 mb-4">No accounts connected yet</div>
            <button
              onClick={() => setShowConnectDialog(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Connect Your First Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(() => {
              const seenIds = new Set<string>();
              return accounts.map((account, index) => (
                <AccountCard key={generateAccountKey(account, index, seenIds)} account={account} />
              ));
            })()}
          </div>
        )}

        {/* Connect Dialog */}
        {showConnectDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Connect Account</h2>
                <button
                  onClick={() => setShowConnectDialog(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-gray-600 mb-6">
                Choose a platform to connect your account
              </p>

              <div className="space-y-3">
                {Object.values(SocialPlatform).map((platform) => (
                  <ConnectButton
                    key={platform}
                    platform={platform}
                    onSuccess={() => {
                      setShowConnectDialog(false);
                      fetchAccounts();
                    }}
                  />
                ))}
              </div>

              <div className="mt-6 text-sm text-gray-500">
                Note: OAuth integration is ready for production credentials
              </div>
            </div>
          </div>
        )}

        {/* Success Toast */}
        {showSuccessToast && (
          <SuccessToast
            message={successMessage}
            onClose={() => setShowSuccessToast(false)}
          />
        )}
      </div>
    </div>
  );
}
