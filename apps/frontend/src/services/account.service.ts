/**
 * Account Service
 * 
 * Handles API calls for account management functionality
 */

import { apiClient } from '@/lib/api-client';
import type {
  LoginActivity,
  TrustedDevice,
  AccountStatus,
  EmailChangeRequest,
  ChangeEmailData,
  ChangePasswordData,
  DeactivateAccountData,
  DeleteAccountData,
  LoginHistoryResponse,
  TrustedDevicesResponse,
  AccountStatusResponse,
  EmailChangeResponse,
  PendingEmailChangeResponse,
} from '@/types/account.types';

export class AccountService {
  /**
   * Get login history
   */
  static async getLoginHistory(limit = 50): Promise<LoginActivity[]> {
    const response = await apiClient.get<LoginHistoryResponse>(`/auth/login-history?limit=${limit}`);
    return response.activities;
  }

  /**
   * Get trusted devices
   */
  static async getTrustedDevices(): Promise<TrustedDevice[]> {
    const response = await apiClient.get<TrustedDevicesResponse>('/auth/trusted-devices');
    return response.devices;
  }

  /**
   * Get account status
   */
  static async getAccountStatus(): Promise<AccountStatus> {
    const response = await apiClient.get<AccountStatusResponse>('/auth/account-status');
    return response.status;
  }

  /**
   * Get pending email change
   */
  static async getPendingEmailChange(): Promise<EmailChangeRequest | null> {
    const response = await apiClient.get<PendingEmailChangeResponse>('/auth/pending-email-change');
    return response.pendingChange;
  }

  /**
   * Request email change
   */
  static async requestEmailChange(data: ChangeEmailData): Promise<EmailChangeResponse> {
    return apiClient.post('/auth/change-email', data);
  }

  /**
   * Resend email verification
   */
  static async resendEmailVerification(): Promise<{ message: string }> {
    return apiClient.post('/auth/resend-email-verification');
  }

  /**
   * Cancel email change
   */
  static async cancelEmailChange(): Promise<{ message: string }> {
    return apiClient.delete('/auth/cancel-email-change');
  }

  /**
   * Change password
   */
  static async changePassword(data: ChangePasswordData): Promise<{ message: string }> {
    return apiClient.post('/auth/change-password', data);
  }

  /**
   * Revoke trusted device
   */
  static async revokeTrustedDevice(deviceId: string): Promise<void> {
    await apiClient.delete(`/auth/trusted-devices/${deviceId}`);
  }

  /**
   * Export account data
   */
  static async exportAccountData(): Promise<Blob> {
    const response = await apiClient.get('/auth/export-data', {
      responseType: 'blob',
    });
    return response;
  }

  /**
   * Deactivate account
   */
  static async deactivateAccount(data: DeactivateAccountData): Promise<{ message: string }> {
    return apiClient.post('/auth/deactivate-account', data);
  }

  /**
   * Delete account permanently
   */
  static async deleteAccount(data: DeleteAccountData): Promise<{ message: string }> {
    return apiClient.delete('/auth/account', { data });
  }
}