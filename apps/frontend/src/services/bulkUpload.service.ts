import { apiClient } from '@/lib/api-client';

export interface BulkUploadJob {
  id: string;
  workspaceId: string;
  userId: string;
  filename: string;
  totalRows: number;
  processedRows: number;
  successCount: number;
  failureCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errors: Array<{
    row: number;
    error: string;
    data?: Record<string, unknown>;
  }>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListJobsResponse {
  success: boolean;
  data: BulkUploadJob[];
}

class BulkUploadService {
  async uploadCSV(file: File): Promise<BulkUploadJob> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<{ success: boolean; data: BulkUploadJob }>(
      '/posts/bulk-upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  }

  async getJobStatus(jobId: string): Promise<BulkUploadJob> {
    const response = await apiClient.get<{ success: boolean; data: BulkUploadJob }>(
      `/posts/bulk-upload/${jobId}`
    );
    return response.data;
  }

  async listJobs(page: number = 1, limit: number = 20): Promise<BulkUploadJob[]> {
    const response = await apiClient.get<ListJobsResponse>(
      `/posts/bulk-upload?page=${page}&limit=${limit}`
    );
    return response.data;
  }
}

export const bulkUploadService = new BulkUploadService();
