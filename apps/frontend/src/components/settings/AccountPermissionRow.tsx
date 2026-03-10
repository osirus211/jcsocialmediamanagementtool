import React, { useState } from 'react';
import { SocialAccount } from '@/types/social.types';
import { accountPermissionsService, SetPermissionRequest } from '@/services/account-permissions.service';
import { toast } from '@/lib/notifications';
import { Toggle } from '@/components/ui/Toggle';

interface AccountPermissionRowProps {
  account: SocialAccount;
  userId: string;
  permissions: {
    canPost: boolean;
    canViewAnalytics: boolean;
    canManage: boolean;
    source: 'role' | 'custom';
  };
  isOwnerOrAdmin: boolean;
  onPermissionChange: (accountId: string, permissions: SetPermissionRequest) => void;
}

export const AccountPermissionRow: React.FC<AccountPermissionRowProps> = ({
  account,
  userId,
  permissions,
  isOwnerOrAdmin,
  onPermissionChange,
}) => {
  const [saving, setSaving] = useState(false);
  const [localPermissions, setLocalPermissions] = useState(permissions);

  const handleToggle = async (
    permission: 'canPost' | 'canViewAnalytics' | 'canManage',
    value: boolean
  ) => {
    if (isOwnerOrAdmin) return; // Should not happen due to disabled state

    setSaving(true);
    const newPermissions = { ...localPermissions, [permission]: value };
    setLocalPermissions(newPermissions);

    try {
      await accountPermissionsService.setAccountPermission(userId, account._id, {
        [permission]: value,
      });

      onPermissionChange(account._id, { [permission]: value });
      toast.success('Permission updated');
    } catch (error: any) {
      // Revert on error
      setLocalPermissions(localPermissions);
      toast.error(error.response?.data?.message || 'Failed to update permission');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (isOwnerOrAdmin) return;

    setSaving(true);
    try {
      await accountPermissionsService.removeAccountPermission(userId, account._id);
      
      // Reset to default permissions (all true)
      const defaultPermissions = {
        canPost: true,
        canViewAnalytics: true,
        canManage: false,
        source: 'role' as const,
      };
      
      setLocalPermissions(defaultPermissions);
      onPermissionChange(account._id, {
        canPost: true,
        canViewAnalytics: true,
        canManage: false,
      });
      
      toast.success('Permissions reset to default');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reset permissions');
    } finally {
      setSaving(false);
    }
  };

  const getPlatformIcon = (provider: string) => {
    const iconMap: Record<string, string> = {
      twitter: '𝕏',
      facebook: '📘',
      instagram: '📷',
      linkedin: '💼',
      tiktok: '🎵',
      youtube: '📺',
      threads: '🧵',
    };
    return iconMap[provider] || '📱';
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-200 last:border-b-0">
      {/* Account Info */}
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            {account.metadata?.avatarUrl ? (
              <img
                src={account.metadata.avatarUrl}
                alt={account.accountName}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <span className="text-lg">{getPlatformIcon(account.platform)}</span>
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-medium text-gray-900">{account.accountName}</span>
            <span className="text-sm text-gray-500 capitalize">({account.platform})</span>
          </div>
          <div className="text-sm text-gray-500">
            {account.metadata?.followerCount ? `${account.metadata.followerCount.toLocaleString()} followers` : ''}
          </div>
        </div>
      </div>

      {/* Permission Toggles */}
      <div className="flex items-center space-x-6">
        {/* Can Post */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700">Can Post</label>
          <div className="relative group">
            <Toggle
              checked={localPermissions.canPost}
              onChange={(value) => handleToggle('canPost', value)}
              disabled={isOwnerOrAdmin || saving}
            />
            {isOwnerOrAdmin && (
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Full access
              </div>
            )}
          </div>
        </div>

        {/* Can View Analytics */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700">Analytics</label>
          <Toggle
            checked={localPermissions.canViewAnalytics}
            onChange={(value) => handleToggle('canViewAnalytics', value)}
            disabled={isOwnerOrAdmin || saving}
          />
        </div>

        {/* Can Manage */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700">Manage</label>
          <Toggle
            checked={localPermissions.canManage}
            onChange={(value) => handleToggle('canManage', value)}
            disabled={isOwnerOrAdmin || saving}
          />
        </div>

        {/* Reset to Default */}
        {!isOwnerOrAdmin && localPermissions.source === 'custom' && (
          <button
            onClick={handleResetToDefault}
            disabled={saving}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            Reset to default
          </button>
        )}

        {/* Saving Indicator */}
        {saving && (
          <div className="flex items-center space-x-1">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-500">Saving...</span>
          </div>
        )}

        {/* Info Icon for Owner/Admin */}
        {isOwnerOrAdmin && (
          <div className="group relative">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="absolute -top-8 right-0 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              Owners and admins have full access
            </div>
          </div>
        )}
      </div>
    </div>
  );
};