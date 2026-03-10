import React, { useState, useEffect } from 'react';
import { WorkspaceMember, WorkspaceRole } from '@/types/workspace.types';
import { SocialAccount } from '@/types/social.types';
import { AccountPermissionRow } from './AccountPermissionRow';
import { accountPermissionsService, EffectivePermissions, SetPermissionRequest } from '@/services/account-permissions.service';
import { useSocialAccountStore } from '@/store/social.store';
import { toast } from '@/lib/notifications';

interface MemberPermissionsPanelProps {
  member: WorkspaceMember;
  isOpen: boolean;
  onClose: () => void;
}

export const MemberPermissionsPanel: React.FC<MemberPermissionsPanelProps> = ({
  member,
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [effectivePermissions, setEffectivePermissions] = useState<EffectivePermissions | null>(null);
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  
  const { accounts, fetchAccounts } = useSocialAccountStore();

  const isOwnerOrAdmin = member.role === WorkspaceRole.OWNER || member.role === WorkspaceRole.ADMIN;
  const memberUserId = typeof member.userId === 'string' ? member.userId : member.userId._id;
  const memberName = typeof member.userId === 'string' 
    ? 'Member' 
    : `${member.userId.firstName} ${member.userId.lastName}`;

  useEffect(() => {
    if (isOpen) {
      loadPermissions();
      fetchAccounts();
    }
  }, [isOpen, memberUserId]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const permissions = await accountPermissionsService.getEffectivePermissions(memberUserId);
      setEffectivePermissions(permissions);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (accountId: string, permissions: SetPermissionRequest) => {
    if (!effectivePermissions) return;

    // Update local state
    setEffectivePermissions(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        effectivePermissions: {
          ...prev.effectivePermissions,
          [accountId]: {
            ...prev.effectivePermissions[accountId],
            ...permissions,
            source: 'custom' as const,
          },
        },
      };
    });
  };

  const handleGrantAccessToAll = async () => {
    setBulkOperationLoading(true);
    try {
      const permissions = accounts.map(account => ({
        socialAccountId: account._id,
        canPost: true,
        canViewAnalytics: true,
        canManage: false,
      }));

      await accountPermissionsService.bulkSetPermissions(memberUserId, permissions);
      await loadPermissions(); // Reload to get updated state
      toast.success('Granted access to all accounts');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to grant access to all accounts');
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const handleRevokeAllAccess = async () => {
    setBulkOperationLoading(true);
    try {
      const permissions = accounts.map(account => ({
        socialAccountId: account._id,
        canPost: false,
        canViewAnalytics: false,
        canManage: false,
      }));

      await accountPermissionsService.bulkSetPermissions(memberUserId, permissions);
      await loadPermissions(); // Reload to get updated state
      toast.success('Revoked access to all accounts');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to revoke access to all accounts');
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const getPermissionsForAccount = (accountId: string) => {
    if (isOwnerOrAdmin) {
      return {
        canPost: true,
        canViewAnalytics: true,
        canManage: true,
        source: 'role' as const,
      };
    }

    return effectivePermissions?.effectivePermissions[accountId] || {
      canPost: true,
      canViewAnalytics: true,
      canManage: false,
      source: 'role' as const,
    };
  };

  const getRoleBadgeColor = (role: WorkspaceRole) => {
    switch (role) {
      case WorkspaceRole.OWNER:
        return 'bg-purple-100 text-purple-800';
      case WorkspaceRole.ADMIN:
        return 'bg-blue-100 text-blue-800';
      case WorkspaceRole.MEMBER:
        return 'bg-green-100 text-green-800';
      case WorkspaceRole.VIEWER:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-lg font-medium text-gray-600">
                    {memberName.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Account Permissions
                </h2>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{memberName}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                    {member.role}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-2 hover:bg-gray-100"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="p-6">
                {/* Info Banner */}
                <div className="mb-6 rounded-md bg-blue-50 p-4">
                  <div className="text-sm text-blue-800">
                    {isOwnerOrAdmin ? (
                      <p>
                        <strong>OWNER</strong> and <strong>ADMIN</strong> members have full access to all accounts and cannot be restricted.
                      </p>
                    ) : (
                      <p>
                        Configure which social media accounts this member can access. 
                        By default, <strong>EDITOR</strong> and <strong>VIEWER</strong> members have access to all accounts.
                      </p>
                    )}
                  </div>
                </div>

                {isOwnerOrAdmin ? (
                  /* Read-only summary for Owner/Admin */
                  <div className="text-center py-8">
                    <div className="text-lg font-medium text-gray-900 mb-2">
                      Full Access to All Accounts
                    </div>
                    <div className="text-sm text-gray-600">
                      This member has unrestricted access to all {accounts.length} connected social media accounts.
                    </div>
                  </div>
                ) : (
                  /* Permission controls for Editor/Viewer */
                  <div>
                    {/* Bulk Actions */}
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-medium text-gray-900">
                        Social Media Accounts ({accounts.length})
                      </h3>
                      <div className="flex space-x-3">
                        <button
                          onClick={handleGrantAccessToAll}
                          disabled={bulkOperationLoading}
                          className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200 disabled:opacity-50"
                        >
                          Grant access to all
                        </button>
                        <button
                          onClick={handleRevokeAllAccess}
                          disabled={bulkOperationLoading}
                          className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 disabled:opacity-50"
                        >
                          Revoke all access
                        </button>
                      </div>
                    </div>

                    {/* Account List */}
                    {accounts.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No social media accounts connected yet.
                      </div>
                    ) : (
                      <div className="space-y-0 border border-gray-200 rounded-lg overflow-hidden">
                        {accounts.map((account) => (
                          <AccountPermissionRow
                            key={account._id}
                            account={account}
                            userId={memberUserId}
                            permissions={getPermissionsForAccount(account._id)}
                            isOwnerOrAdmin={isOwnerOrAdmin}
                            onPermissionChange={handlePermissionChange}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};