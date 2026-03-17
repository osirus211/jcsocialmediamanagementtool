// @ts-nocheck
/**
 * Analytics Store Tests
 * 
 * Tests for the extended analytics store functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAnalyticsStore } from '../analytics.store';

// Mock API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    defaults: {
      baseURL: 'http://localhost:3000/api/v1'
    }
  }
}));

describe('Analytics Store', () => {
  beforeEach(() => {
    // Reset store state
    useAnalyticsStore.getState().clearAnalytics();
  });

  it('should initialize with correct default state', () => {
    const state = useAnalyticsStore.getState();
    
    expect(state.overview).toBeNull();
    expect(state.platformMetrics).toEqual([]);
    expect(state.growthMetrics).toEqual([]);
    expect(state.postAnalytics).toEqual({});
    expect(state.isLoading).toBe(false);
    expect(state.dateRange.startDate).toBeNull();
    expect(state.dateRange.endDate).toBeNull();
    expect(state.dateRange.preset).toBeNull();
  });

  it('should set date range correctly', () => {
    const { setDateRange } = useAnalyticsStore.getState();
    
    setDateRange('2024-01-01', '2024-01-31', 'Last 30 days');
    
    const state = useAnalyticsStore.getState();
    expect(state.dateRange.startDate).toBe('2024-01-01');
    expect(state.dateRange.endDate).toBe('2024-01-31');
    expect(state.dateRange.preset).toBe('Last 30 days');
  });

  it('should set loading state correctly', () => {
    const { setLoading } = useAnalyticsStore.getState();
    
    setLoading(true);
    expect(useAnalyticsStore.getState().isLoading).toBe(true);
    
    setLoading(false);
    expect(useAnalyticsStore.getState().isLoading).toBe(false);
  });

  it('should clear analytics correctly', () => {
    const { clearAnalytics, setDateRange } = useAnalyticsStore.getState();
    
    // Set some data first
    setDateRange('2024-01-01', '2024-01-31', 'Last 30 days');
    
    // Clear analytics
    clearAnalytics();
    
    const state = useAnalyticsStore.getState();
    expect(state.overview).toBeNull();
    expect(state.platformMetrics).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.dateRange.startDate).toBeNull();
    expect(state.dateRange.endDate).toBeNull();
    expect(state.dateRange.preset).toBeNull();
  });
});