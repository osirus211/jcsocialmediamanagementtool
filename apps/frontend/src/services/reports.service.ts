/**
 * Reports Service
 * Frontend service for scheduled reports API calls
 */

import { apiClient } from '@/lib/api-client';

export interface ScheduledReport {
  _id: string;
  workspaceId: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  format: 'pdf' | 'csv';
  reportType: 'overview' | 'posts' | 'hashtags' | 'followers' | 'full';
  recipients: string[];
  platforms: string[];
  dateRange: number;
  lastSentAt?: Date;
  nextSendAt: Date;
  isActive: boolean;
  createdBy: {
    _id: string;
    email: string;
    name?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReportData {
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  format: 'pdf' | 'csv';
  reportType: 'overview' | 'posts' | 'hashtags' | 'followers' | 'full';
  recipients: string[];
  platforms?: string[];
  dateRange?: number;
  isActive?: boolean;
}

export interface UpdateReportData {
  name?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  format?: 'pdf' | 'csv';
  reportType?: 'overview' | 'posts' | 'hashtags' | 'followers' | 'full';
  recipients?: string[];
  platforms?: string[];
  dateRange?: number;
  isActive?: boolean;
}

class ReportsService {
  /**
   * List scheduled reports for workspace
   */
  async listReports(): Promise<ScheduledReport[]> {
    const response = await apiClient.get<{ success: boolean; data: ScheduledReport[] }>(
      '/reports'
    );

    return response.data;
  }

  /**
   * Create scheduled report
   */
  async createReport(data: CreateReportData): Promise<ScheduledReport> {
    const response = await apiClient.post<{ success: boolean; data: ScheduledReport }>(
      '/reports',
      data
    );

    return response.data;
  }

  /**
   * Update scheduled report
   */
  async updateReport(id: string, data: UpdateReportData): Promise<ScheduledReport> {
    const response = await apiClient.patch<{ success: boolean; data: ScheduledReport }>(
      `/reports/${id}`,
      data
    );

    return response.data;
  }

  /**
   * Delete scheduled report
   */
  async deleteReport(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean; message: string }>(
      `/reports/${id}`
    );
  }

  /**
   * Send report immediately
   */
  async sendNow(id: string): Promise<void> {
    await apiClient.post<{ success: boolean; message: string }>(
      `/reports/${id}/send-now`
    );
  }
}

export const reportsService = new ReportsService();