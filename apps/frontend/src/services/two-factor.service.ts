/**
 * Two-Factor Authentication Service
 * 
 * Handles API calls for 2FA setup, verification, and management
 */

import { apiClient } from '@/lib/api-client';

export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
}

export interface TwoFactorVerifySetupResponse {
  backupCodes: string[];
}

export interface TwoFactorValidateResponse {
  valid: boolean;
  message: string;
}

export interface CompleteLoginResponse {
  user: any;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export class TwoFactorService {
  /**
   * Start 2FA setup - generate secret and QR code
   */
  static async setupTwoFactor(): Promise<TwoFactorSetupResponse> {
    return apiClient.get('/v2/2fa/setup');
  }

  /**
   * Verify setup token and enable 2FA
   */
  static async verifySetup(token: string): Promise<TwoFactorVerifySetupResponse> {
    return apiClient.post('/v2/2fa/verify-setup', { token });
  }

  /**
   * Validate 2FA token (for login)
   */
  static async validateToken(userId: string, token: string): Promise<TwoFactorValidateResponse> {
    return apiClient.post('/v2/2fa/validate', { userId, token });
  }

  /**
   * Complete login after 2FA verification
   */
  static async completeLogin(userId: string, token: string): Promise<CompleteLoginResponse> {
    return apiClient.post('/v2/auth/complete-login', { userId, token });
  }

  /**
   * Disable 2FA
   */
  static async disableTwoFactor(token: string): Promise<void> {
    return apiClient.post('/v2/2fa/disable', { token });
  }

  /**
   * Regenerate backup codes
   */
  static async regenerateBackupCodes(token: string): Promise<TwoFactorVerifySetupResponse> {
    return apiClient.post('/v2/2fa/regenerate-backup-codes', { token });
  }
}