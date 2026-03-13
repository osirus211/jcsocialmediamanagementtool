/**
 * GDPR Service
 * 
 * Handles GDPR compliance API calls
 */

import { apiClient } from '@/lib/api-client';

export interface GDPRExportData {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    bio?: string;
    timezone?: string;
    language?: string;
    createdAt: Date;
    lastLoginAt?: Date;
    isEmailVerified: boolean;
    twoFactorEnabled: boolean;
  };
  workspaces: any[];
  posts: any[];
  socialAccounts: any[];
  analytics: any[];
  loginHistory: any[];
  auditLogs: any[];
  exportMetadata: {
    exportedAt: string;
    requestId: string;
    format: 'json' | 'csv';
    dataRetentionPolicy: string;
  };
}

export interface GDPRRequest {
  id: string;
  type: 'data_export' | 'data_deletion' | 'data_access' | 'data_rectification' | 'consent_withdrawal';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  requestedAt: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
  retentionUntil?: string;
  processingNotes?: string;
}

export interface GDPRRequestsResponse {
  requests: GDPRRequest[];
  total: number;
}

export interface DeleteAccountRequest {
  password: string;
  gracePeriodDays?: number;
  anonymizeAuditLogs?: boolean;
  revokeOAuthTokens?: boolean;
  cancelSubscriptions?: boolean;
}

export interface DeleteAccountResponse {
  message: string;
  requestId: string;
  gracePeriodUntil: string;
  gracePeriodDays: number;
  note: string;
}

export interface CancelDeletionRequest {
  password: string;
}

export interface CancelDeletionResponse {
  message: string;
  requestId: string;
  accountRestored: boolean;
  note: string;
}

export interface ConsentPreferences {
  marketingEmails?: boolean;
  analyticsTracking?: boolean;
  functionalCookies?: boolean;
}

export interface ConsentResponse {
  message: string;
  preferences: ConsentPreferences;
}

export interface DataSummary {
  user: {
    accountCreated: string;
    lastLogin?: string;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
  };
  dataCounts: {
    workspaces: number;
    posts: number;
    socialAccounts: number;
    analytics: number;
    loginHistory: number;
    auditLogs: number;
  };
  dataRetentionPolicy: {
    posts: string;
    analytics: string;
    auditLogs: string;
    loginHistory: string;
  };
  yourRights: {
    dataPortability: string;
    rectification: string;
    erasure: string;
    restriction: string;
    objection: string;
  };
}

export class GDPRService {
  /**
   * Export user data (GDPR Article 20 - Right to Data Portability)
   */
  static async exportUserData(format: 'json' | 'csv' = 'json'): Promise<Blob> {
    const response = await apiClient.get(`/gdpr/export?format=${format}`, {
      responseType: 'blob',
    });
    return response;
  }

  /**
   * Request account deletion (GDPR Article 17 - Right to Erasure)
   */
  static async requestAccountDeletion(data: DeleteAccountRequest): Promise<DeleteAccountResponse> {
    return apiClient.post('/gdpr/delete-account', data);
  }

  /**
   * Cancel account deletion request
   */
  static async cancelAccountDeletion(data: CancelDeletionRequest): Promise<CancelDeletionResponse> {
    return apiClient.post('/gdpr/cancel-deletion', data);
  }

  /**
   * Get GDPR request history
   */
  static async getGDPRRequests(): Promise<GDPRRequestsResponse> {
    return apiClient.get('/gdpr/requests');
  }

  /**
   * Get data summary (GDPR Article 15 - Right of Access)
   */
  static async getDataSummary(): Promise<DataSummary> {
    return apiClient.get('/gdpr/data-summary');
  }

  /**
   * Update consent preferences
   */
  static async updateConsent(preferences: ConsentPreferences): Promise<ConsentResponse> {
    return apiClient.post('/gdpr/consent', preferences);
  }

  /**
   * Download exported data as file
   */
  static async downloadExportedData(format: 'json' | 'csv' = 'json'): Promise<void> {
    try {
      const blob = await this.exportUserData(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gdpr-data-export-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading exported data:', error);
      throw error;
    }
  }
}