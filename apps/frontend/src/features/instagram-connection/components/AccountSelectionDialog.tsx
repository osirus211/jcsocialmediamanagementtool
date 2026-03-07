/**
 * AccountSelectionDialog Component
 * 
 * Displays discovered Instagram Business accounts and allows user selection
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { useState } from 'react';
import type { DiscoveredInstagramAccount } from '../types';

interface AccountSelectionDialogProps {
  accounts: DiscoveredInstagramAccount[];
  onSave: (selectedIds: string[]) => Promise<void>;
  onCancel?: () => void;
  isOpen: boolean;
}

export function AccountSelectionDialog({
  accounts,
  onSave,
  onCancel,
  isOpen,
}: AccountSelectionDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleAccount = (accountId: string) => {
    setSelectedIds(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === accounts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(accounts.map(acc => acc.id));
    }
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) {
      setSaveError('Please select at least one account');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(selectedIds);
    } catch (error: any) {
      setSaveError(error.message || 'Failed to save accounts');
      setIsSaving(false);
    }
  };

  const allSelected = selectedIds.length === accounts.length && accounts.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Select Instagram Accounts
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Choose which accounts you want to connect to your workspace
          </p>
        </div>

        {/* Account List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Select All */}
          {accounts.length > 1 && (
            <div className="mb-4 pb-4 border-b border-gray-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select All ({accounts.length} accounts)
                </span>
              </label>
            </div>
          )}

          {/* Account Cards */}
          <div className="space-y-3">
            {accounts.map(account => (
              <AccountCard
                key={account.id}
                account={account}
                isSelected={selectedIds.includes(account.id)}
                onToggle={() => handleToggleAccount(account.id)}
              />
            ))}
          </div>

          {accounts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No accounts found</p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {saveError && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-100">
            <p className="text-sm text-red-800">{saveError}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {selectedIds.length} of {accounts.length} selected
          </div>
          <div className="flex gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:ring-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || selectedIds.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Connect Selected Accounts'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AccountCardProps {
  account: DiscoveredInstagramAccount;
  isSelected: boolean;
  onToggle: () => void;
}

function AccountCard({ account, isSelected, onToggle }: AccountCardProps) {
  return (
    <label
      className={`
        flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}
      `}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
      />

      {/* Profile Image */}
      {account.profilePictureUrl ? (
        <img
          src={account.profilePictureUrl}
          alt={account.username}
          className="w-12 h-12 rounded-full object-cover"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
          </svg>
        </div>
      )}

      {/* Account Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            @{account.username}
          </h3>
          {account.alreadyConnected && (
            <span className="px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded">
              Connected
            </span>
          )}
        </div>
        {account.name && (
          <p className="text-sm text-gray-600 truncate">{account.name}</p>
        )}
        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
          {account.followersCount !== undefined && (
            <span>{account.followersCount.toLocaleString()} followers</span>
          )}
          {account.pageName && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              {account.pageName}
            </span>
          )}
        </div>
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <div className="flex-shrink-0">
          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}
    </label>
  );
}
