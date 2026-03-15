/**
 * Blackout Dates Service
 * 
 * Frontend service for managing blackout dates
 */

import { apiClient } from '@/lib/api-client';

export interface BlackoutDate {
  _id: string;
  workspaceId: string;
  startDate: string;
  endDate: string;
  reason: string;
  recurring: boolean;
  recurringPattern?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    customDates?: string[];
    endRecurrence?: string;
  };
  action: 'hold' | 'reschedule' | 'cancel';
  isActive: boolean;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlackoutDateRequest {
  startDate: string;
  endDate: string;
  reason: string;
  recurring?: boolean;
  recurringPattern?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    customDates?: string[];
    endRecurrence?: string;
  };
  action?: 'hold' | 'reschedule' | 'cancel';
}

export interface UpdateBlackoutDateRequest {
  startDate?: string;
  endDate?: string;
  reason?: string;
  recurring?: boolean;
  recurringPattern?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    customDates?: string[];
    endRecurrence?: string;
  };
  action?: 'hold' | 'reschedule' | 'cancel';
  isActive?: boolean;
}

export interface BlackoutConflict {
  postId: string;
  scheduledAt: string;
  blackoutDate: BlackoutDate;
  action: 'hold' | 'reschedule' | 'cancel';
}

export interface CalendarBlackoutDate {
  date: string;
  reason: string;
  action: string;
}

export interface BlackoutCheckResult {
  isBlackedOut: boolean;
  blackoutDate?: BlackoutDate;
}

class BlackoutDatesService {
  /**
   * Create a new blackout date
   */
  async createBlackoutDate(
    workspaceId: string,
    data: CreateBlackoutDateRequest
  ): Promise<BlackoutDate> {
    const response = await apiClient.post<{ success: boolean; data: BlackoutDate }>(
      `/workspaces/${workspaceId}/blackout-dates`,
      data
    );
    return response.data;
  }

  /**
   * Get all blackout dates for a workspace
   */
  async getBlackoutDates(
    workspaceId: string,
    options: {
      isActive?: boolean;
      startDate?: string;
      endDate?: string;
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<BlackoutDate[]> {
    const params = new URLSearchParams();
    
    if (options.isActive !== undefined) {
      params.append('isActive', options.isActive.toString());
    }
    if (options.startDate) {
      params.append('startDate', options.startDate);
    }
    if (options.endDate) {
      params.append('endDate', options.endDate);
    }
    if (options.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options.skip) {
      params.append('skip', options.skip.toString());
    }

    const response = await apiClient.get<{ success: boolean; data: BlackoutDate[] }>(
      `/workspaces/${workspaceId}/blackout-dates?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get a single blackout date by ID
   */
  async getBlackoutDateById(
    workspaceId: string,
    id: string
  ): Promise<BlackoutDate> {
    const response = await apiClient.get<{ success: boolean; data: BlackoutDate }>(
      `/workspaces/${workspaceId}/blackout-dates/${id}`
    );
    return response.data;
  }

  /**
   * Update a blackout date
   */
  async updateBlackoutDate(
    workspaceId: string,
    id: string,
    data: UpdateBlackoutDateRequest
  ): Promise<BlackoutDate> {
    const response = await apiClient.patch<{ success: boolean; data: BlackoutDate }>(
      `/workspaces/${workspaceId}/blackout-dates/${id}`,
      data
    );
    return response.data;
  }

  /**
   * Delete a blackout date
   */
  async deleteBlackoutDate(
    workspaceId: string,
    id: string
  ): Promise<void> {
    await apiClient.delete(
      `/workspaces/${workspaceId}/blackout-dates/${id}`
    );
  }

  /**
   * Check if a specific date is blacked out
   */
  async checkBlackoutDate(
    workspaceId: string,
    date: string
  ): Promise<BlackoutCheckResult> {
    const response = await apiClient.get<{ success: boolean; data: BlackoutCheckResult }>(
      `/workspaces/${workspaceId}/blackout-dates/check?date=${encodeURIComponent(date)}`
    );
    return response.data;
  }

  /**
   * Find posts that conflict with blackout dates
   */
  async findConflictingPosts(
    workspaceId: string
  ): Promise<BlackoutConflict[]> {
    const response = await apiClient.get<{ success: boolean; data: BlackoutConflict[] }>(
      `/workspaces/${workspaceId}/blackout-dates/conflicts`
    );
    return response.data;
  }

  /**
   * Get blackout dates for calendar display
   */
  async getBlackoutDatesInRange(
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<CalendarBlackoutDate[]> {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });

    const response = await apiClient.get<{ success: boolean; data: CalendarBlackoutDate[] }>(
      `/workspaces/${workspaceId}/blackout-dates/calendar?${params.toString()}`
    );
    return response.data;
  }
}

export const blackoutDatesService = new BlackoutDatesService();