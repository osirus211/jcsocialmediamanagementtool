import { apiClient } from '../lib/api-client';

export interface AccountPermission {
  _id: string;
  workspaceId: string;
  userId: string;
  socialAccountId: string;
  canPost: boolean;
  canViewAnalytics: boolean;
  canManage: boolean;
  grantedBy: string;
  grantedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountPermissionData {
  socialAccountId: string;
  canPost: boolean;
  canViewAnalytics: boolean;
  canManage: boolean;
}

export interface EffectivePermissions {
  role: string;
  accountPermissions: AccountPermission[];
  effectivePermissions: {
    [socialAccountId: string]: {
      canPost: boolean;
      canViewAnalytics: boolean;
      canManage: boolean;
      source: 'role' | 'custom';
    };
  };
}

export interface SetPermissionRequest {
  canPost?: boolean;
  canViewAnalytics?: boolean;
  canManage?: boolean;
}

export interface BulkSetPermissionsRequest {
  permissions: AccountPermissionData[];
}

class AccountPermissionsService {
  /**
   * Get all account permissions for a member
   */
  async getMemberPermissions(userId: string): Promise<AccountPermission[]> {
    const response = await apiClient.get(`/account-permissions/${userId}`);
    return response.data.data;
  }

  /**
   * Set permissions for a specific account
   */
  async setAccountPermission(
    userId: string,
    socialAccountId: string,
    permissions: SetPermissionRequest
  ): Promise<AccountPermission> {
    const response = await apiClient.put(
      `/account-permissions/${userId}/${socialAccountId}`,
      permissions
    );
    return response.data.data;
  }

  /**
   * Remove custom permissions (revert to default)
   */
  async removeAccountPermission(userId: string, socialAccountId: string): Promise<void> {
    await apiClient.delete(`/account-permissions/${userId}/${socialAccountId}`);
  }

  /**
   * Get effective permissions summary
   */
  async getEffectivePermissions(userId: string): Promise<EffectivePermissions> {
    const response = await apiClient.get(`/account-permissions/${userId}/effective`);
    return response.data.data;
  }

  /**
   * Bulk set permissions for multiple accounts
   */
  async bulkSetPermissions(
    userId: string,
    permissions: AccountPermissionData[]
  ): Promise<AccountPermission[]> {
    const response = await apiClient.post(`/account-permissions/${userId}/bulk`, {
      permissions,
    });
    return response.data.data;
  }
}

export const accountPermissionsService = new AccountPermissionsService();