import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useWorkspaceStore } from '../workspace.store';
import { apiClient } from '@/lib/api-client';

// Mock the API client
vi.mock('@/lib/api-client');
const mockApiClient = apiClient as any;

describe('Workspace Store Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Reset the store state
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspace: null,
      currentWorkspaceId: null,
      recentWorkspaceIds: [],
      isLoading: false,
      workspacesLoaded: false,
      members: [],
      membersLoaded: false,
      pendingInvites: [],
      pendingInvitesLoaded: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Unit Test: Verify request deduplication in fetchWorkspaces
   * This tests the fix for concurrent call protection
   */
  it('should deduplicate concurrent fetchWorkspaces calls', async () => {
    const mockWorkspaces = [
      { _id: 'workspace1', name: 'Test Workspace 1', membersCount: 1 },
    ];

    let apiCallCount = 0;
    mockApiClient.get.mockImplementation(async () => {
      apiCallCount++;
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100));
      return { workspaces: mockWorkspaces };
    });

    const store = useWorkspaceStore.getState();

    // Make multiple concurrent calls
    const promise1 = store.fetchWorkspaces();
    const promise2 = store.fetchWorkspaces();
    const promise3 = store.fetchWorkspaces();

    // Advance timers to complete the API call
    vi.advanceTimersByTime(100);

    // Wait for all promises to resolve
    await Promise.all([promise1, promise2, promise3]);

    // Should only make one API call despite multiple concurrent requests
    expect(apiCallCount).toBe(1);
    expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    
    // All calls should have the same result
    const state = useWorkspaceStore.getState();
    expect(state.workspaces).toEqual(mockWorkspaces);
    expect(state.workspacesLoaded).toBe(true);
  });

  /**
   * Unit Test: Verify AbortController integration in fetchWorkspaces
   * This tests the fix for request cancellation support
   */
  it('should handle AbortController signals in fetchWorkspaces', async () => {
    let receivedSignal: AbortSignal | undefined;
    mockApiClient.get.mockImplementation(async (url: string, options?: any) => {
      receivedSignal = options?.signal;
      await new Promise(resolve => setTimeout(resolve, 100));
      return { workspaces: [] };
    });

    const store = useWorkspaceStore.getState();
    const abortController = new AbortController();

    // Call fetchWorkspaces with AbortSignal
    const promise = store.fetchWorkspaces(abortController.signal);

    // Advance timers slightly
    vi.advanceTimersByTime(50);

    // Verify signal was passed to API client
    expect(receivedSignal).toBe(abortController.signal);

    // Complete the request
    vi.advanceTimersByTime(50);
    await promise;
  });

  /**
   * Unit Test: Verify exponential backoff in restoreWorkspace
   * This tests the fix for retry logic with proper delays
   */
  it('should implement exponential backoff in restoreWorkspace retries', async () => {
    let apiCallCount = 0;
    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;

    // Mock setTimeout to capture delays
    vi.spyOn(global, 'setTimeout').mockImplementation((callback: any, delay: number) => {
      delays.push(delay);
      return originalSetTimeout(callback, 0); // Execute immediately for test
    });

    // Mock fetchWorkspaces to fail first 2 times, then succeed
    const mockFetchWorkspaces = vi.fn().mockImplementation(async () => {
      apiCallCount++;
      if (apiCallCount <= 2) {
        throw new Error('Network error');
      }
      return Promise.resolve();
    });

    // Replace the fetchWorkspaces method in the store
    useWorkspaceStore.setState({
      fetchWorkspaces: mockFetchWorkspaces,
    });

    const store = useWorkspaceStore.getState();

    // Call restoreWorkspace
    await store.restoreWorkspace();

    // Should have made 3 attempts (1 initial + 2 retries)
    expect(apiCallCount).toBe(3);

    // Should have exponential backoff delays: 1000ms, 2000ms
    expect(delays).toEqual([1000, 2000]);

    // Restore original setTimeout
    vi.restoreAllMocks();
  });

  /**
   * Unit Test: Verify retry limit in restoreWorkspace
   * This tests that retries stop after maximum attempts
   */
  it('should stop retrying after maximum attempts in restoreWorkspace', async () => {
    let apiCallCount = 0;

    // Mock fetchWorkspaces to always fail
    const mockFetchWorkspaces = vi.fn().mockImplementation(async () => {
      apiCallCount++;
      throw new Error('Network error');
    });

    // Replace the fetchWorkspaces method in the store
    useWorkspaceStore.setState({
      fetchWorkspaces: mockFetchWorkspaces,
    });

    const store = useWorkspaceStore.getState();

    // Call restoreWorkspace and expect it to throw after max attempts
    await expect(store.restoreWorkspace()).rejects.toThrow('Network error');

    // Should have made 4 attempts (1 initial + 3 retries)
    expect(apiCallCount).toBe(4);

    // Should clear workspace data after all retries fail
    const state = useWorkspaceStore.getState();
    expect(state.currentWorkspace).toBe(null);
    expect(state.currentWorkspaceId).toBe(null);
    expect(state.workspacesLoaded).toBe(true);
  });

  /**
   * Unit Test: Verify cancellation handling in restoreWorkspace
   * This tests that cancelled requests don't retry
   */
  it('should not retry when request is cancelled in restoreWorkspace', async () => {
    let apiCallCount = 0;

    // Mock fetchWorkspaces to throw AbortError
    const mockFetchWorkspaces = vi.fn().mockImplementation(async (signal?: AbortSignal) => {
      apiCallCount++;
      const error = new Error('Request was cancelled');
      error.name = 'AbortError';
      throw error;
    });

    // Replace the fetchWorkspaces method in the store
    useWorkspaceStore.setState({
      fetchWorkspaces: mockFetchWorkspaces,
    });

    const store = useWorkspaceStore.getState();
    const abortController = new AbortController();

    // Call restoreWorkspace with cancelled signal
    await expect(store.restoreWorkspace(abortController.signal)).rejects.toThrow('Request was cancelled');

    // Should only make 1 attempt (no retries for cancelled requests)
    expect(apiCallCount).toBe(1);
  });
});