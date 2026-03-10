/**
 * Approvals Service
 * 
 * Handles post approval workflow API calls
 */

import { apiClient } from '../lib/api-client';

export interface ApprovalQueueItem {
  postId: string;
  workspaceId: string;
  createdBy: string;
  content: string;
  platform: string;
  scheduledAt: string;
  submittedForApprovalAt: string;
}

export interface ApprovalCount {
  count: number;
}

class ApprovalsService {
  /**
   * Get pending approvals for workspace
   */
  async getPendingApprovals(params?: { limit?: number; skip?: number }): Promise<ApprovalQueueItem[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.skip) queryParams.append('skip', params.skip.toString());

    const response = await apiClient.get(`/approvals?${queryParams.toString()}`);
    return response.data.data;
  }

  /**
   * Get pending approval count
   */
  async getApprovalCount(): Promise<number> {
    const response = await apiClient.get('/approvals/count');
    return response.data.data.count;
  }

  /**
   * Get current user's posts pending approval
   */
  async getMyPendingPosts(): Promise<ApprovalQueueItem[]> {
    const response = await apiClient.get('/approvals/my-posts');
    return response.data.data;
  }

  /**
   * Submit post for approval
   */
  async submitForApproval(postId: string): Promise<void> {
    await apiClient.post(`/approvals/${postId}/submit`);
  }

  /**
   * Approve post
   */
  async approvePost(postId: string): Promise<void> {
    await apiClient.post(`/approvals/${postId}/approve`);
  }

  /**
   * Reject post
   */
  async rejectPost(postId: string, reason: string): Promise<void> {
    await apiClient.post(`/approvals/${postId}/reject`, { reason });
  }
}

export const approvalsService = new ApprovalsService();