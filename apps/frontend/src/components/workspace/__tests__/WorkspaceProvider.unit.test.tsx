import React from 'react';
import { render, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceProvider } from '../WorkspaceProvider';
import { useAuthStore } from '@/store/auth.store';
import { useWorkspaceStore } from '@/store/workspace.store';

// Mock the stores
vi.mock('@/store/auth.store');
vi.mock('@/store/workspace.store');

const mockUseAuthStore = useAuthStore as any;
const mockUseWorkspaceStore = useWorkspaceStore as any;

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('WorkspaceProvider Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  /**
   * Unit Test: Verify useCallback creates stable function references
   * This tests the fix for unstable useEffect dependencies
   */
  it('should create stable function references with useCallback', () => {
    const mockRestoreWorkspace = vi.fn().mockResolvedValue(undefined);

    // Mock authenticated user
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      authChecked: true,
    });

    // Mock workspace store
    mockUseWorkspaceStore.mockReturnValue({
      workspaces: [],
      currentWorkspace: null,
      workspacesLoaded: false,
    });

    // Mock getState
    mockUseWorkspaceStore.getState = vi.fn().mockReturnValue({
      workspaces: [],
      currentWorkspace: null,
      workspacesLoaded: true,
      setCurrentWorkspace: vi.fn(),
      restoreWorkspace: mockRestoreWorkspace,
    });

    const TestComponent = () => (
      <BrowserRouter>
        <WorkspaceProvider>
          <div>Test Child</div>
        </WorkspaceProvider>
      </BrowserRouter>
    );

    // Render multiple times to test stability
    const { rerender } = render(<TestComponent />);
    
    // Re-render should not cause additional calls due to stable dependencies
    rerender(<TestComponent />);
    rerender(<TestComponent />);

    // The restoreWorkspace should only be called once despite multiple re-renders
    // This verifies that the useCallback creates stable function references
    expect(mockRestoreWorkspace).toHaveBeenCalledTimes(1);
  });

  /**
   * Unit Test: Verify AbortController is created and passed correctly
   * This tests the fix for React StrictMode handling and request cancellation
   */
  it('should create AbortController and pass signal to restoreWorkspace', async () => {
    let receivedSignal: AbortSignal | undefined;
    const mockRestoreWorkspace = vi.fn().mockImplementation(async (signal?: AbortSignal) => {
      receivedSignal = signal;
      return Promise.resolve();
    });

    // Mock authenticated user
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      authChecked: true,
    });

    // Mock workspace store
    mockUseWorkspaceStore.mockReturnValue({
      workspaces: [],
      currentWorkspace: null,
      workspacesLoaded: false,
    });

    // Mock getState
    mockUseWorkspaceStore.getState = vi.fn().mockReturnValue({
      workspaces: [],
      currentWorkspace: null,
      workspacesLoaded: true,
      setCurrentWorkspace: vi.fn(),
      restoreWorkspace: mockRestoreWorkspace,
    });

    const TestComponent = () => (
      <BrowserRouter>
        <WorkspaceProvider>
          <div>Test Child</div>
        </WorkspaceProvider>
      </BrowserRouter>
    );

    render(<TestComponent />);

    // Wait for the effect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Verify that an AbortSignal was passed
    expect(receivedSignal).toBeDefined();
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(mockRestoreWorkspace).toHaveBeenCalledWith(receivedSignal);
  });

  /**
   * Unit Test: Verify cleanup function cancels requests
   * This tests the fix for proper cleanup on unmount
   */
  it('should cancel requests on component unmount', async () => {
    let receivedSignal: AbortSignal | undefined;
    const mockRestoreWorkspace = vi.fn().mockImplementation(async (signal?: AbortSignal) => {
      receivedSignal = signal;
      // Simulate a longer operation
      await new Promise(resolve => setTimeout(resolve, 100));
      return Promise.resolve();
    });

    // Mock authenticated user
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      authChecked: true,
    });

    // Mock workspace store
    mockUseWorkspaceStore.mockReturnValue({
      workspaces: [],
      currentWorkspace: null,
      workspacesLoaded: false,
    });

    // Mock getState
    mockUseWorkspaceStore.getState = vi.fn().mockReturnValue({
      workspaces: [],
      currentWorkspace: null,
      workspacesLoaded: true,
      setCurrentWorkspace: vi.fn(),
      restoreWorkspace: mockRestoreWorkspace,
    });

    const TestComponent = () => (
      <BrowserRouter>
        <WorkspaceProvider>
          <div>Test Child</div>
        </WorkspaceProvider>
      </BrowserRouter>
    );

    const { unmount } = render(<TestComponent />);

    // Wait for the restoration to start
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Verify signal was created and passed
    expect(receivedSignal).toBeDefined();
    expect(receivedSignal).toBeInstanceOf(AbortSignal);

    // Unmount the component
    unmount();

    // Verify signal is aborted after unmount (this is the correct behavior)
    expect(receivedSignal?.aborted).toBe(true);
  });
});