import React, { useState } from 'react';
import { Switch } from '@headlessui/react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { SocialAccount } from '@/types/social.types';
import { accountPermissionsService, SetPermissionRequest } from '@/services/account-permissions.service';
import { toast } from 'react-hot-toast';

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
            {account.profilePicture ? (
              <img
                src={account.profilePicture}
                alt={account.accountName}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <span className="text-lg">{getPlatformIcon(account.provider)}</span>
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-medium text-gray-900">{account.accountName}</span>
            <span className="text-sm text-gray-500 capitalize">({account.provider})</span>
          </div>
          <div className="text-sm text-gray-500">
            {account.followerCount ? `${account.followerCount.toLocaleString()} followers` : ''}
          </div>
        </div>
      </div>

      {/* Permission Toggles */}
      <div className="flex items-center space-x-6">
        {/* Can Post */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700">Can Post</label>
          <div className="relative">
            <Switch
              checked={localPermissions.canPost}
              onChange={(value) => handleToggle('canPost', value)}
              disabled={isOwnerOrAdmin || saving}
              className={`${
                localPermissions.canPost ? 'bg-blue-600' : 'bg-gray-200'
              } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isOwnerOrAdmin || saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <span
                className={`${
                  localPermissions.canPost ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
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
          <Switch
            checked={localPermissions.canViewAnalytics}
            onChange={(value) => handleToggle('canViewAnalytics', value)}
            disabled={isOwnerOrAdmin || saving}
            className={`${
              localPermissions.canViewAnalytics ? 'bg-blue-600' : 'bg-gray-200'
            } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isOwnerOrAdmin || saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <span
              className={`${
                localPermissions.canViewAnalytics ? 'translate-x-6' : 'translate-x-1'
              } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </Switch>
        </div>

        {/* Can Manage */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700">Manage</label>
          <Switch
            checked={localPermissions.canManage}
            onChange={(value) => handleToggle('canManage', value)}
            disabled={isOwnerOrAdmin || saving}
            className={`${
              localPermissions.canManage ? 'bg-blue-600' : 'bg-gray-200'
            } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isOwnerOrAdmin || saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <span
              className={`${
                localPermissions.canManage ? 'translate-x-6' : 'translate-x-1'
              } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </Switch>
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
            <InformationCircleIcon className="h-5 w-5 text-gray-400" />
            <div className="absolute -top-8 right-0 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              Owners and admins have full access
            </div>
          </div>
        )}
      </div>
    </div>
  );
};