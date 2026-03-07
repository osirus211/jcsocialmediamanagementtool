/**
 * Instagram Connection Service
 * 
 * API integration for Instagram Business account connection flow
 * 
 * Requirements: 5.2, 5.3, 5.4
 */

import { apiClient } from '../../../lib/api-client';
import type { DiscoveredInstagramAccount } from '../types';

export interface OAuthInitiateResponse {
  success: boolean;
  authorizationUrl: string;
  state: string;
  platform: string;
}

export interface TokenExchangeResponse {
  success: boolean;
  accounts: DiscoveredInstagramAccount[];
}

export interface SaveAccountsRequest {
  accountIds: string[];
}

export interface SaveAccountsResponse {
  success: boolean;
  saved: Array<{
    _id: string;
    username: string;
  }>;
  failed: Array<{
    username: string;
    error: string;
  }>;
}

export class InstagramConnectionService {
  /**
   * Initiate OAuth flow - Get authorization URL
   */
  async initiateOAuth(): Promise<OAuthInitiateResponse> {
    try {
      const response = await apiClient.post<OAuthInitiateResponse>(
        '/oauth/instagram/authorize'
      );
      return response;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to initiate OAuth'
      );
    }
  }

  /**
   * Exchange authorization code for token and discover accounts
   * 
   * Note: This happens automatically via OAuth callback redirect
   * The backend handles the code exchange and account discovery
   * This method is for checking the result after redirect
   */
  async checkConnectionStatus(): Promise<{
    success: boolean;
    accounts?: DiscoveredInstagramAccount[];
    error?: string;
  }> {
    try {
      // Check if there are any new Instagram accounts
      const response = await apiClient.get<{
        success: boolean;
        accounts: DiscoveredInstagramAccount[];
      }>('/social/accounts?platform=instagram&recent=true');

      return {
        success: true,
        accounts: response.accounts,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to check connection status',
      };
    }
  }

  /**
   * Save selected Instagram accounts
   * 
   * Note: In the current backend implementation, accounts are automatically
   * saved during the OAuth callback. This method is for future enhancement
   * where users can select which accounts to connect.
   */
  async saveAccounts(accountIds: string[]): Promise<SaveAccountsResponse> {
    try {
      const response = await apiClient.post<SaveAccountsResponse>(
        '/social/accounts/instagram/save',
        { accountIds }
      );
      return response;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to save accounts'
      );
    }
  }

  /**
   * Get all Instagram accounts for current workspace
   */
  async getInstagramAccounts(): Promise<DiscoveredInstagramAccount[]> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        accounts: DiscoveredInstagramAccount[];
      }>('/social/accounts?platform=instagram');

      return response.accounts || [];
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to fetch Instagram accounts'
      );
    }
  }
}

export const instagramConnectionService = new InstagramConnectionService();
