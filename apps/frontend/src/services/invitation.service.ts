/**
 * Invitation Service
 * 
 * Handles workspace invitation operations
 */

import { apiClient } from '@/lib/api-client';

export interface WorkspaceInvitation {
  _id: string;
  token: string;
  invitedEmail: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
  inviterName: string;
}

export interface InvitationStats {
  totalSent: number;
  pending: number;
  accepted: number;
  expired: number;
  revoked: number;
  acceptanceRate: number;
}

export interface GetInvitationsParams {
  workspaceId: string;
  page?: number;
  limit?: number;
  status?: 'all' | 'pending' | 'expired' | 'accepted' | 'revoked';
  search?: string;
  role?: 'all' | 'admin' | 'member' | 'viewer';
}

export interface BulkCancelResult {
  successCount: number;
  failureCount: number;
  errors: string[];
}

class InvitationService {
  /**
   * Get invitations for workspace with filtering
   */
  async getInvitations(params: GetInvitationsParams): Promise<{
    invitations: WorkspaceInvitation[];
    pagination: {
      page: number;
      limit: number;
      total: number;
    };
  }> {
    const { workspaceId, ...queryParams } = params;
    
    const response = await apiClient.get(`/workspaces/${workspaceId}/invitations`, {
      params: queryParams,
    });

    return response;
  }

  /**
   * Resend invitation
   */
  async resendInvitation(workspaceId: string, token: string): Promise<void> {
    await apiClient.post(`/workspaces/${workspaceId}/invitations/${token}/resend`);
  }

  /**
   * Cancel/revoke invitation
   */
  async cancelInvitation(workspaceId: string, token: string): Promise<void> {
    await apiClient.delete(`/workspaces/${workspaceId}/invitations/${token}`);
  }

  /**
   * Bulk cancel invitations
   */
  async bulkCancelInvitations(workspaceId: string, tokens: string[]): Promise<BulkCancelResult> {
    const response = await apiClient.delete(`/workspaces/${workspaceId}/invitations/bulk`, {
      data: { tokens },
    });

    return response.results;
  }

  /**
   * Get invitation statistics
   */
  async getInvitationStats(workspaceId: string): Promise<InvitationStats> {
    const response = await apiClient.get(`/workspaces/${workspaceId}/invitations/stats`);
    return response.stats;
  }
}

export const invitationService = new InvitationService();