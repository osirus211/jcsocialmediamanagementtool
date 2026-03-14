/**
 * Activity Service
 * 
 * Handles team activity feed API calls
 */

import { apiClient } from '../lib/api-client';

export interface ActivityItem {
  _id: string;
  workspaceId: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityFeedResponse {
  activities: ActivityItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ActivityStats {
  totalActions: number;
  byType: Record<string, number>;
  mostActiveUser: {
    userId: string;
    name: string;
    email: string;
    count: number;
  } | null;
  period: string;
}

export interface ActivityFilters {
  page?: number;
  limit?: number;
  action?: string;
  resourceType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

class ActivityService {
  /**
   * Get activity feed for workspace
   */
  async getActivityFeed(filters?: ActivityFilters): Promise<ActivityFeedResponse> {
    const queryParams = new URLSearchParams();
    
    if (filters?.page) queryParams.append('page', filters.page.toString());
    if (filters?.limit) queryParams.append('limit', filters.limit.toString());
    if (filters?.action) queryParams.append('action', filters.action);
    if (filters?.resourceType) queryParams.append('resourceType', filters.resourceType);
    if (filters?.userId) queryParams.append('userId', filters.userId);
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    if (filters?.search) queryParams.append('search', filters.search);

    const response = await apiClient.get(`/activity?${queryParams.toString()}`);
    return response.data.data;
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(): Promise<ActivityStats> {
    const response = await apiClient.get('/activity/stats');
    return response.data.data;
  }

  /**
   * Export activity logs
   */
  async exportActivityLogs(format: 'csv' | 'json', filters?: ActivityFilters): Promise<void> {
    const queryParams = new URLSearchParams();
    queryParams.append('format', format);
    
    if (filters?.action) queryParams.append('action', filters.action);
    if (filters?.resourceType) queryParams.append('resourceType', filters.resourceType);
    if (filters?.userId) queryParams.append('userId', filters.userId);
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);

    // Create a temporary link to download the file
    const url = `/activity/export?${queryParams.toString()}`;
    const link = document.createElement('a');
    link.href = `${apiClient.defaults.baseURL}${url}`;
    link.download = `activity-export-${Date.now()}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const activityService = new ActivityService();