/**
 * Queue Service
 * 
 * Frontend service for comprehensive queue management
 */

import { apiClient } from '@/lib/api-client';

export interface QueuedPost {
  id: string;
  workspaceId: string;
  content: string;
  platform: string;
  socialAccountId: string;
  socialAccountName: string;
  scheduledAt: string;
  queueSlot?: string;
  mediaIds: string[];
  status: string;
  createdAt: string;
  createdBy: string;
  order: number;
}

export interface QueueStats {
  totalPosts: number;
  postsByPlatform: Record<string, number>;
  nextPostTime?: string;
  averageInterval: number;
  queueHealth: 'good' | 'warning' | 'critical';
}

export interface QueueResponse {
  posts: QueuedPost[];
  stats: QueueStats;
  total: number;
}

export interface ReorderQueueRequest {
  postId: string;
  newPosition: number;
}

export interface MovePostRequest {
  postId: string;
}

export interface ShuffleQueueRequest {
  platform?: string;
  preserveTimeSlots?: boolean;
  distributionStrategy?: 'random' | 'balanced' | 'optimal';
}

export interface BulkOperationRequest {
  operation: 'remove' | 'reschedule' | 'move_to_top' | 'move_to_bottom';
  postIds: string[];
  options?: {
    scheduledAt?: string;
  };
}

export interface BulkOperationResponse {
  success: number;
  failed: Array<{
    postId: string;
    reason: string;
  }>;
}

export interface QueuePauseStatus {
  isPaused: boolean;
  pausedAt?: string;
  pausedBy?: string;
  resumeAt?: string;
  reason?: string;
  accountPauses: Array<{
    socialAccountId: string;
    socialAccountName: string;
    platform: string;
    isPaused: boolean;
    pausedAt: string;
    pausedBy: string;
    resumeAt?: string;
    reason?: string;
  }>;
}

export interface PauseQueueRequest {
  accountId?: string;
  resumeAt?: string;
  reason?: string;
}

export interface ResumeQueueRequest {
  accountId?: string;
}

export interface PauseUntilRequest {
  resumeAt: string;
  accountId?: string;
  reason?: string;
}

class QueueService {
  /**
   * Get queue with all scheduled posts
   */
  async getQueue(
    platform?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<QueueResponse> {
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const response = await apiClient.get<{ success: boolean; data: QueueResponse }>(
      `/queue?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Reorder queue by moving post to new position
   */
  async reorderQueue(request: ReorderQueueRequest): Promise<QueuedPost[]> {
    const response = await apiClient.post<{ success: boolean; data: QueuedPost[] }>(
      '/queue/reorder',
      request
    );
    return response.data;
  }

  /**
   * Move post up one position
   */
  async movePostUp(postId: string): Promise<QueuedPost[]> {
    const response = await apiClient.post<{ success: boolean; data: QueuedPost[] }>(
      '/queue/move-up',
      { postId }
    );
    return response.data;
  }

  /**
   * Move post down one position
   */
  async movePostDown(postId: string): Promise<QueuedPost[]> {
    const response = await apiClient.post<{ success: boolean; data: QueuedPost[] }>(
      '/queue/move-down',
      { postId }
    );
    return response.data;
  }

  /**
   * Move post to top of queue
   */
  async moveToTop(postId: string): Promise<QueuedPost[]> {
    const response = await apiClient.post<{ success: boolean; data: QueuedPost[] }>(
      '/queue/move-to-top',
      { postId }
    );
    return response.data;
  }

  /**
   * Move post to bottom of queue
   */
  async moveToBottom(postId: string): Promise<QueuedPost[]> {
    const response = await apiClient.post<{ success: boolean; data: QueuedPost[] }>(
      '/queue/move-to-bottom',
      { postId }
    );
    return response.data;
  }

  /**
   * Remove post from queue
   */
  async removeFromQueue(postId: string): Promise<void> {
    await apiClient.post('/queue/remove', { postId });
  }

  /**
   * Shuffle queue with smart distribution
   */
  async shuffleQueue(request: ShuffleQueueRequest = {}): Promise<QueuedPost[]> {
    const response = await apiClient.post<{ success: boolean; data: QueuedPost[] }>(
      '/queue/shuffle',
      request
    );
    return response.data;
  }

  /**
   * Bulk operations on queue
   */
  async bulkOperation(request: BulkOperationRequest): Promise<BulkOperationResponse> {
    const response = await apiClient.post<{ success: boolean; data: BulkOperationResponse }>(
      '/queue/bulk',
      request
    );
    return response.data;
  }

  /**
   * PAUSE QUEUE METHODS - Superior to Buffer & Hootsuite
   */

  /**
   * Pause entire workspace queue or specific account
   */
  async pauseQueue(request: PauseQueueRequest = {}): Promise<QueuePauseStatus> {
    const response = await apiClient.post<{ success: boolean; data: QueuePauseStatus }>(
      '/queue/pause',
      request
    );
    return response.data;
  }

  /**
   * Resume entire workspace queue or specific account
   */
  async resumeQueue(request: ResumeQueueRequest = {}): Promise<QueuePauseStatus> {
    const response = await apiClient.post<{ success: boolean; data: QueuePauseStatus }>(
      '/queue/resume',
      request
    );
    return response.data;
  }

  /**
   * Pause queue until specific date/time
   */
  async pauseUntil(request: PauseUntilRequest): Promise<QueuePauseStatus> {
    const response = await apiClient.post<{ success: boolean; data: QueuePauseStatus }>(
      '/queue/pause-until',
      request
    );
    return response.data;
  }

  /**
   * Get current queue pause status
   */
  async getQueueStatus(): Promise<QueuePauseStatus> {
    const response = await apiClient.get<{ success: boolean; data: QueuePauseStatus }>(
      '/queue/status'
    );
    return response.data;
  }
}

export const queueService = new QueueService();