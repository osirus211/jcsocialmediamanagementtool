import { apiClient } from '@/lib/api-client';
import {
  DLQPreviewResponse,
  DLQStatsResponse,
  DLQReplayResponse,
} from '@/types/dlq.types';

/**
 * DLQ Service
 * API integration for Dead Letter Queue operations
 */
class DLQService {
  /**
   * Get DLQ statistics
   */
  async getStats(): Promise<DLQStatsResponse> {
    const response = await apiClient.get<DLQStatsResponse>('/admin/dlq/stats');
    return response;
  }

  /**
   * Preview failed jobs
   */
  async preview(page: number = 1, limit: number = 20): Promise<DLQPreviewResponse> {
    const response = await apiClient.get<DLQPreviewResponse>(
      `/admin/dlq/preview?page=${page}&limit=${limit}`
    );
    return response;
  }

  /**
   * Replay single job
   */
  async replayJob(jobId: string): Promise<DLQReplayResponse> {
    const response = await apiClient.post<DLQReplayResponse>(
      `/admin/dlq/replay/${jobId}`,
      {}
    );
    return response;
  }

  /**
   * Replay batch of jobs
   */
  async replayBatch(jobIds: string[]): Promise<DLQReplayResponse> {
    const response = await apiClient.post<DLQReplayResponse>(
      '/admin/dlq/replay-batch',
      { jobIds }
    );
    return response;
  }
}

export const dlqService = new DLQService();
