import React from 'react';
import { render, act, waitFor, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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

describe('WorkspaceProvider Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  /**
   * Integration Test: Verify the fix works for basic scenarios
   * This test verifies that the component works correctly with the fixes
   */
  it('should handle workspace initialization correctly with fixes', async () => {
    const mockWorkspaces = [
      { _id: 'workspace1', name: 'Test Workspace 1', membersCount: 1 },
    ];

    let restoreWorkspaceCalls = 0;
    const mockRestoreWorkspace = vi.fn().mockImplementation(async (signal?: AbortSignal) => {
      restoreWorkspaceCalls++;
      // Simulate successful restoration
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

    await waitFor(() => {
      // Should render children after restoration
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    // Should call restoreWorkspace exactly once (not multiple times due to unstable deps)
    expect(restoreWorkspaceCalls).toBe(1);
    
    // Should not redirect when workspaces exist
    expect(mockNavigate).not.toHaveBeenCalledWith('/workspaces/create');
  });

  /**
   * Test: Verify AbortController cleanup works
   */
  it('should handle component unmount with proper cleanup', async () => {
    const mockWorkspaces = [
      { _id: 'workspace1', name: 'Test Workspace 1', membersCount: 1 },
    ];

    let abortSignalReceived: AbortSignal | undefined;
    const mockRestoreWorkspace = vi.fn().mockImplementation(async (signal?: AbortSignal) => {
      abortSignalReceived = signal;
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

    const { unmount } = render(<TestComponent />);

    // Wait a bit for the restoration to start
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Unmount the component
    unmount();

    // Verify that an AbortSignal was passed to restoreWorkspace
    expect(abortSignalReceived).toBeDefined();
    expect(abortSignalReceived).toBeInstanceOf(AbortSignal);
  });

  /**
   * Test: Verify unauthenticated users are handled correctly
   */
  it('should handle unauthenticated users without calling restoreWorkspace', async () => {
    const mockRestoreWorkspace = vi.fn();

    // Mock unauthenticated user
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
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
      workspacesLoaded: false,
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

    await waitFor(() => {
      // Should render children immediately for unauthenticated users
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    // Should not call restoreWorkspace for unauthenticated users
    expect(mockRestoreWorkspace).not.toHaveBeenCalled();
  });

  /**
   * Test: Verify no workspaces scenario redirects correctly
   */
  it('should redirect to create page when user has no workspaces', async () => {
    const mockRestoreWorkspace = vi.fn().mockResolvedValue(undefined);

    // Mock authenticated user
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      authChecked: true,
    });

    // Mock workspace store with no workspaces
    mockUseWorkspaceStore.mockReturnValue({
      workspaces: [],
      currentWorkspace: null,
      workspacesLoaded: false,
    });

    // Mock getState to return empty workspaces after restoration
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
          <div data-testid="child-content">Test Child</div>
        </WorkspaceProvider>
      </BrowserRouter>
    );

    render(<TestComponent />);

    await waitFor(() => {
      // Should redirect to create page when no workspaces
      expect(mockNavigate).toHaveBeenCalledWith('/workspaces/create');
    });
  });
});