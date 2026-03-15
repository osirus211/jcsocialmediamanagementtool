import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkspaceProvider } from '../WorkspaceProvider';
import { useAuthStore } from '@/store/auth.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { apiClient } from '@/lib/api-client';

// Mock the stores
vi.mock('@/store/auth.store');
vi.mock('@/store/workspace.store');
vi.mock('@/lib/api-client');

const mockUseAuthStore = useAuthStore as any;
const mockUseWorkspaceStore = useWorkspaceStore as any;
const mockApiClient = apiClient as any;

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('WorkspaceProvider Bug Condition Exploration', () => {
  let effectExecutionCount = 0;
  let fetchWorkspacesCallCount = 0;
  let concurrentCallCount = 0;
  let maxConcurrentCalls = 0;
  let retryDelays: number[] = [];
  let requestStartTimes: number[] = [];

  const mockWorkspaces = [
    { _id: 'workspace1', name: 'Test Workspace 1', membersCount: 1 },
    { _id: 'workspace2', name: 'Test Workspace 2', membersCount: 2 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Reset counters
    effectExecutionCount = 0;
    fetchWorkspacesCallCount = 0;
    concurrentCallCount = 0;
    maxConcurrentCalls = 0;
    retryDelays = [];
    requestStartTimes = [];

    // Mock auth store - authenticated user
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      authChecked: true,
    });

    // Create a mock fetchWorkspaces that tracks concurrent calls
    const mockFetchWorkspaces = vi.fn().mockImplementation(async () => {
      fetchWorkspacesCallCount++;
      concurrentCallCount++;
      maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCallCount);
      requestStartTimes.push(Date.now());
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      concurrentCallCount--;
      return Promise.resolve();
    });

    // Create a mock restoreWorkspace that tracks retries and delays
    const mockRestoreWorkspace = vi.fn().mockImplementation(async () => {
      let attempts = 0;
      const MAX_ATTEMPTS = 3;
      
      const attemptRestore = async (): Promise<void> => {
        try {
          await mockFetchWorkspaces();
          // Simulate failure on first few attempts to trigger retries
          if (attempts < 2) {
            attempts++;
            throw new Error('Simulated network error');
          }
        } catch (error) {
          if (attempts < MAX_ATTEMPTS) {
            const startTime = Date.now();
            // Current implementation has NO delay (immediate retry)
            const delay = 0; // This is the bug - should have exponential backoff
            retryDelays.push(delay);
            
            if (delay > 0) {
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            return attemptRestore();
          }
          throw error;
        }
      };
      
      return attemptRestore();
    });

    // Mock workspace store with unstable function references (the bug)
    mockUseWorkspaceStore.mockImplementation((selector?: any) => {
      if (selector) {
        return selector({
          workspaces: mockWorkspaces,
          currentWorkspace: null,
          workspacesLoaded: false,
          // This creates a NEW function reference each time (the bug)
          restoreWorkspace: mockRestoreWorkspace,
        });
      }
      
      return {
        workspaces: mockWorkspaces,
        currentWorkspace: null,
        workspacesLoaded: false,
        // This creates a NEW function reference each time (the bug)
        restoreWorkspace: mockRestoreWorkspace,
      };
    });

    // Mock getState to return updated state after operations
    mockUseWorkspaceStore.getState = vi.fn().mockReturnValue({
      workspaces: mockWorkspaces,
      currentWorkspace: mockWorkspaces[0],
      workspacesLoaded: true,
      setCurrentWorkspace: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Test Case 1: Unstable Dependencies Test
   * EXPECTED ON UNFIXED CODE: useEffect runs continuously (50+ times in 5 seconds)
   * This test should FAIL on unfixed code because the effect will re-run continuously
   */
  it('should execute useEffect exactly once with stable dependencies', async () => {
    // Spy on useEffect to count executions
    const originalUseEffect = React.useEffect;
    const useEffectSpy = vi.spyOn(React, 'useEffect').mockImplementation((effect, deps) => {
      // Only count the workspace initialization effect (the one with restoreWorkspace in deps)
      if (deps && deps.some((dep: any) => typeof dep === 'function')) {
        effectExecutionCount++;
      }
      return originalUseEffect(effect, deps);
    });

    const TestComponent = () => (
      <BrowserRouter>
        <WorkspaceProvider>
          <div>Test Child</div>
        </WorkspaceProvider>
      </BrowserRouter>
    );

    render(<TestComponent />);

    // Let the component run for 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      // On UNFIXED code, this will fail because useEffect runs continuously
      // Expected: 1 execution (stable dependencies)
      // Actual on unfixed code: 50+ executions (unstable dependencies)
      expect(effectExecutionCount).toBeLessThanOrEqual(1);
    });

    useEffectSpy.mockRestore();
  });

  /**
   * Test Case 2: Concurrent Calls Test  
   * EXPECTED ON UNFIXED CODE: 10+ concurrent fetchWorkspaces calls
   * This test should FAIL on unfixed code because no deduplication exists
   */
  it('should prevent concurrent fetchWorkspaces calls', async () => {
    const TestComponent = () => (
      <BrowserRouter>
        <WorkspaceProvider>
          <div>Test Child</div>
        </WorkspaceProvider>
      </BrowserRouter>
    );

    render(<TestComponent />);

    // Trigger multiple rapid re-renders to simulate the unstable dependency issue
    for (let i = 0; i < 10; i++) {
      act(() => {
        // Force re-render by advancing time slightly
        vi.advanceTimersByTime(10);
      });
    }

    await waitFor(() => {
      // On UNFIXED code, this will fail because multiple concurrent calls are made
      // Expected: < 10 total requests (with deduplication)
      // Actual on unfixed code: 10+ concurrent requests (no deduplication)
      expect(maxConcurrentCalls).toBeLessThan(10);
    });
  });

  /**
   * Test Case 3: Immediate Retry Test
   * EXPECTED ON UNFIXED CODE: 0ms delays between retries
   * This test should FAIL on unfixed code because retries are immediate
   */
  it('should implement exponential backoff for retries', async () => {
    const TestComponent = () => (
      <BrowserRouter>
        <WorkspaceProvider>
          <div>Test Child</div>
        </WorkspaceProvider>
      </BrowserRouter>
    );

    render(<TestComponent />);

    // Wait for the restoration attempts to complete
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    await waitFor(() => {
      // On UNFIXED code, this will fail because retries have 0ms delay
      // Expected: delays of [1000, 2000] (exponential backoff)
      // Actual on unfixed code: delays of [0, 0] (immediate retry)
      expect(retryDelays.length).toBeGreaterThan(0);
      if (retryDelays.length > 0) {
        expect(retryDelays[0]).toBeGreaterThanOrEqual(1000); // First retry should have 1s delay
      }
      if (retryDelays.length > 1) {
        expect(retryDelays[1]).toBeGreaterThanOrEqual(2000); // Second retry should have 2s delay
      }
    });
  });

  /**
   * Test Case 4: StrictMode Double-Invoke Test
   * EXPECTED ON UNFIXED CODE: 2x requests without cleanup
   * This test should FAIL on unfixed code because no AbortController cleanup exists
   */
  it('should handle React StrictMode double-invocation gracefully', async () => {
    // Simulate StrictMode by rendering twice
    const TestComponent = () => (
      <BrowserRouter>
        <WorkspaceProvider>
          <div>Test Child</div>
        </WorkspaceProvider>
      </BrowserRouter>
    );

    const { unmount } = render(<TestComponent />);
    
    // Simulate StrictMode double-invoke by rendering again immediately
    render(<TestComponent />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Unmount to trigger cleanup
    unmount();

    await waitFor(() => {
      // On UNFIXED code, this will fail because requests are doubled without cleanup
      // Expected: ≤ 2 total requests (with proper cleanup/deduplication)
      // Actual on unfixed code: 4+ requests (double-invocation without cleanup)
      expect(fetchWorkspacesCallCount).toBeLessThanOrEqual(2);
    });
  });

  /**
   * Integration Test: Single Successful Initialization
   * This test encodes the expected behavior - exactly one successful workspace initialization
   * EXPECTED ON UNFIXED CODE: This will FAIL due to multiple issues above
   */
  it('should execute exactly one successful workspace initialization', async () => {
    const TestComponent = () => (
      <BrowserRouter>
        <WorkspaceProvider>
          <div>Test Child</div>
        </WorkspaceProvider>
      </BrowserRouter>
    );

    render(<TestComponent />);

    // Let the component initialize
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      // This is the core property: exactly one successful initialization
      // On UNFIXED code, this will fail due to:
      // - Continuous re-renders from unstable dependencies
      // - Multiple concurrent API calls
      // - Immediate retries creating request floods
      // - StrictMode double-invocation
      
      // Expected: exactly 1 successful initialization
      // Actual on unfixed code: multiple failed attempts, resource exhaustion
      expect(fetchWorkspacesCallCount).toBe(1);
      expect(maxConcurrentCalls).toBe(1);
      expect(effectExecutionCount).toBe(1);
    });
  });

  /**
   * Resource Exhaustion Prevention Test
   * EXPECTED ON UNFIXED CODE: This will FAIL due to request flooding
   */
  it('should prevent resource exhaustion', async () => {
    const TestComponent = () => (
      <BrowserRouter>
        <WorkspaceProvider>
          <div>Test Child</div>
        </WorkspaceProvider>
      </BrowserRouter>
    );

    render(<TestComponent />);

    // Simulate a longer period to see resource usage
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    await waitFor(() => {
      // On UNFIXED code, this will fail because of request flooding
      // Expected: < 10 total requests (resource management)
      // Actual on unfixed code: 100+ requests (resource exhaustion)
      expect(fetchWorkspacesCallCount).toBeLessThan(10);
    });
  });
});