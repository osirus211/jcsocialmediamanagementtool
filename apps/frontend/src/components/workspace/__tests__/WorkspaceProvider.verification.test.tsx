import React from 'react';
import { render, act, waitFor, screen } from '@testing-library/react';
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

describe('WorkspaceProvider Fix Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  /**
   * Verification Test: The fix should work correctly
   * This test verifies that the infinite loop is fixed
   */
  it('should initialize workspace exactly once without infinite loops', async () => {
    const mockWorkspaces = [
      { _id: 'workspace1', name: 'Test Workspace 1', membersCount: 1 },
    ];

    let restoreWorkspaceCalls = 0;
    const mockRestoreWorkspace = vi.fn().mockImplementation(async (signal?: AbortSignal) => {
      restoreWorkspaceCalls++;
      // Simulate successful restoration
      await new Promise(resolve => setTimeout(resolve, 50));
      return Promise.resolve();
    });

    // Mock authenticated user
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      authChecked: true,
    });

    // Mock workspace store
    mockUseWorkspaceStore.mockReturnValue({
      workspaces: mockWorkspaces,
      currentWorkspace: null,
      workspacesLoaded: false,
    });

    // Mock getState to return the restore function
    mockUseWorkspaceStore.getState = vi.fn().mockReturnValue({
      workspaces: mockWorkspaces,
      currentWorkspace: mockWorkspaces[0],
      workspacesLoaded: true,
      setCurrentWorkspace: vi.fn(),
      restoreWorkspace: mockRestoreWorkspace,
    });

    const TestComponent = () => (
      <BrowserRouter>
        <WorkspaceProvider>
          <div data-testid="child-content">Test Child</div>
        </WorkspaceProvider>
      </BrowserRouter>
    );

    render(<TestComponent />);

    // Wait for initialization to complete
    await waitFor(() => {
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Verify the fix: restoreWorkspace should be called exactly once
    expect(restoreWorkspaceCalls).toBe(1);
    
    // Should not redirect when workspaces exist
    expect(mockNavigate).not.toHaveBeenCalledWith('/workspaces/create');
  });

  /**
   * Verification Test: StrictMode should not cause issues
   */
  it('should handle React StrictMode without cascading cancellations', async () => {
    const mockWorkspaces = [
      { _id: 'workspace1', name: 'Test Workspace 1', membersCount: 1 },
    ];

    let restoreWorkspaceCalls = 0;
    let cancellationCount = 0;
    
    const mockRestoreWorkspace = vi.fn().mockImplementation(async (signal?: AbortSignal) => {
      restoreWorkspaceCalls++;
      
      // Check if signal is already aborted
      if (signal?.aborted) {
        cancellationCount++;
        throw new Error('Request was cancelled');
      }
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check again after delay
      if (signal?.aborted) {
        cancellationCount++;
        throw new Error('Request was cancelled');
      }
      
      return Promise.resolve();
    });

    // Mock authenticated user
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      authChecked: true,
    });

    // Mock workspace store
    mockUseWorkspaceStore.mockReturnValue({
      workspaces: mockWorkspaces,
      currentWorkspace: null,
      workspacesLoaded: false,
    });

    // Mock getState
    mockUseWorkspaceStore.getState = vi.fn().mockReturnValue({
      workspaces: mockWorkspaces,
      currentWorkspace: mockWorkspaces[0],
      workspacesLoaded: true,
      setCurrentWorkspace: vi.fn(),
      restoreWorkspace: mockRestoreWorkspace,
    });

    const TestComponent = () => (
      <BrowserRouter>
        <WorkspaceProvider>
          <div data-testid="child-content">Test Child</div>
        </WorkspaceProvider>
      </BrowserRouter>
    );

    // Simulate StrictMode by rendering twice quickly
    const { unmount } = render(<TestComponent />);
    render(<TestComponent />);

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Clean up
    unmount();

    // The fix should prevent excessive calls and cancellations
    // Should have at most 2 calls (one for each render) and minimal cancellations
    expect(restoreWorkspaceCalls).toBeLessThanOrEqual(2);
    expect(cancellationCount).toBeLessThanOrEqual(1);
  });
});