/**
 * Dashboard Service
 * Frontend service for dashboard layout API calls
 */

import { apiClient } from '@/lib/api-client';
import { DashboardLayout, Widget } from '@/types/dashboard.types';

class DashboardService {
  /**
   * Get dashboard layout
   */
  async getLayout(): Promise<DashboardLayout> {
    const response = await apiClient.get<{ success: boolean; data: DashboardLayout }>(
      '/dashboard/layout'
    );

    return response.data;
  }

  /**
   * Save dashboard layout
   */
  async saveLayout(widgets: Widget[]): Promise<DashboardLayout> {
    const response = await apiClient.post<{ success: boolean; data: DashboardLayout }>(
      '/dashboard/layout',
      { widgets }
    );

    return response.data;
  }

  /**
   * Reset dashboard layout to default
   */
  async resetLayout(): Promise<DashboardLayout> {
    const response = await apiClient.post<{ success: boolean; data: DashboardLayout }>(
      '/dashboard/layout/reset'
    );

    return response.data;
  }
}

export const dashboardService = new DashboardService();