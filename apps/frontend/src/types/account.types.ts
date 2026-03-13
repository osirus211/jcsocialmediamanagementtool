/**
 * Account Management Types
 * 
 * Types for account settings, security, and management functionality
 */

export interface LoginActivity {
  id: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  location?: string;
  device?: string;
}

export interface TrustedDevice {
  id: string;
  name: string;
  browser: string;
  os: string;
  lastUsed: string;
  isCurrent: boolean;
  fingerprint: string;
}

export interface AccountStatus {
  status: 'active' | 'suspended' | 'deactivated';
  createdAt: string;
  lastLoginAt: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

export interface EmailChangeRequest {
  id: string;
  newEmail: string;
  requestedAt: string;
  expiresAt: string;
  token: string;
}

export interface ChangeEmailData {
  newEmail: string;
  password: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface DeactivateAccountData {
  password: string;
}

export interface DeleteAccountData {
  password: string;
}

export interface ExportDataResponse {
  downloadUrl: string;
  expiresAt: string;
}

// API Response Types
export interface LoginHistoryResponse {
  activities: LoginActivity[];
  total: number;
}

export interface TrustedDevicesResponse {
  devices: TrustedDevice[];
}

export interface AccountStatusResponse {
  status: AccountStatus;
}

export interface EmailChangeResponse {
  message: string;
  verificationSent: boolean;
}

export interface PendingEmailChangeResponse {
  pendingChange: EmailChangeRequest | null;
}