import React from 'react';
import { render, act, waitFor, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
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

describe('WorkspaceProvider Preservation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    // Clean up any existing DOM elements
    document.body.innerHTML = '';
  });

  /**
   * Property 2: Preservation - Existing Workspace Behavior
   * These tests capture the baseline behavior that must be preserved after the fix
   * Run on UNFIXED code first to establish the expected behavior patterns
   */

  /**
   * Test Case 1: Authenticated users with workspaces get last selected workspace restored
   * EXPECTED ON UNFIXED CODE: This should PASS (baseline behavior to preserve)
   */
  it('should restore last selected workspace for authenticated users with workspaces', async () => {
    const mockWorkspaces = [
      { _id: 'workspace1', name: 'Test Workspace 1', membersCount: 1 },
      { _id: 'workspace2', name: 'Test Workspace 2', membersCount: 2 },
    ];

    const mockRestoreWorkspace = vi.fn().mockResolvedValue(undefined);

    // Mock authenticated user
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      authChecked: true,
    });

    // Mock workspace store with workspaces available
    mockUseWorkspaceStore.mockReturnValue({
      workspaces: mockWorkspaces,
      currentWorkspace: null,
      workspacesLoaded: false,
      restoreWorkspace: mockRestoreWorkspace,
    });

    // Mock getState to return state after restoration
    mockUseWorkspaceStore.getState = vi.fn().mockReturnValue({
      workspaces: mockWorkspaces,
      currentWorkspace: mockWorkspaces[0], // First workspace selected
      workspacesLoaded: true,
      setCurrentWorkspace: vi.fn(),
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
      // Should call restoreWorkspace for authenticated users
      expect(mockRestoreWorkspace).toHaveBeenCalled();
    });

    await waitFor(() => {
      // Should render children after restoration
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    // Should not redirect to create page when workspaces exist
    expect(mockNavigate).not.toHaveBeenCalledWith('/workspaces/create');
  });

  /**
   * Test Case 2: Users with no workspaces get redirected to workspace creation page
   * EXPECTED ON UNFIXED CODE: This should PASS (baseline behavior to preserve)
   */
  it('should redirect to workspace creation page when user has no workspaces', async () => {
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
      restoreWorkspace: mockRestoreWorkspace,
    });

    // Mock getState to return empty workspaces after restoration
    mockUseWorkspaceStore.getState = vi.fn().mockReturnValue({
      workspaces: [],
      currentWorkspace: null,
      workspacesLoaded: true,
      setCurrentWorkspace: vi.fn(),
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

  /**
   * Test Case 3: Restoration failures fallback to first available workspace
   * EXPECTED ON UNFIXED CODE: This should PASS (baseline behavior to preserve)
   */
  it('should fallback to first workspace when restoration fails but workspaces exist', async () => {
    const mockWorkspaces = [
      { _id: 'workspace1', name: 'Test Workspace 1', membersCount: 1 },
      { _id: 'workspace2', name: 'Test Workspace 2', membersCount: 2 },
    ];

    const mockRestoreWorkspace = vi.fn().mockRejectedValue(new Error('Restoration failed'));
    const mockSetCurrentWorkspace = vi.fn();

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
      restoreWorkspace: mockRestoreWorkspace,
    });

    // Mock getState to return workspaces available after failed restoration
    mockUseWorkspaceStore.getState = vi.fn().mockReturnValue({
      workspaces: mockWorkspaces,
      currentWorkspace: null,
      workspacesLoaded: true,
      setCurrentWorkspace: mockSetCurrentWorkspace,
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
      // Should attempt restoration
      expect(mockRestoreWorkspace).toHaveBeenCalled();
    });

    await waitFor(() => {
      // Should fallback to first workspace when restoration fails but workspaces exist
      expect(mockSetCurrentWorkspace).toHaveBeenCalledWith(mockWorkspaces[0]);
    });
  });

  /**
   * Test Case 4: Unauthenticated users skip restoration without errors
   * EXPECTED ON UNFIXED CODE: This should PASS (baseline behavior to preserve)
   */
  it('should skip restoration for unauthenticated users without errors', async () => {
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
    
    // Should not redirect anywhere
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  /**
   * Test Case 5: Loading states and UI transitions remain unchanged
   * EXPECTED ON UNFIXED CODE: This should PASS (baseline behavior to preserve)
   */
  it('should show loading state during restoration for authenticated users', async () => {
    const mockWorkspaces = [
      { _id: 'workspace1', name: 'Test Workspace 1', membersCount: 1 },
    ];

    // Create a promise we can control
    let resolveRestore: () => void;
    const restorePromise = new Promise<void>((resolve) => {
      resolveRestore = resolve;
    });

    const mockRestoreWorkspace = vi.fn().mockReturnValue(restorePromise);

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

    // Should show loading state initially
    expect(screen.getByText('Loading workspace...')).toBeInTheDocument();
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();

    // Complete the restoration
    act(() => {
      resolveRestore!();
    });

    await waitFor(() => {
      // Should show children after restoration completes
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    // Loading state should be gone
    expect(screen.queryByText('Loading workspace...')).not.toBeInTheDocument();
  });

  /**
   * Property-Based Test: Random workspace scenarios preserve behavior
   * Generate random workspace data and user scenarios to test preservation
   */
  test.prop([
    fc.record({
      isAuthenticated: fc.boolean(),
      authChecked: fc.constant(true),
      workspaces: fc.array(
        fc.record({
          _id: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          membersCount: fc.integer({ min: 1, max: 100 }),
        }),
        { maxLength: 5 }
      ),
      shouldRestoreFail: fc.boolean(),
    }),
  ])('should preserve workspace behavior for all user scenarios', async (scenario) => {
    const mockRestoreWorkspace = scenario.shouldRestoreFail
      ? vi.fn().mockRejectedValue(new Error('Restoration failed'))
      : vi.fn().mockResolvedValue(undefined);

    const mockSetCurrentWorkspace = vi.fn();

    // Mock auth store based on scenario
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: scenario.isAuthenticated,
      authChecked: scenario.authChecked,
    });

    // Mock workspace store based on scenario
    mockUseWorkspaceStore.mockReturnValue({
      workspaces: scenario.workspaces,
      currentWorkspace: null,
      workspacesLoaded: false,
      restoreWorkspace: mockRestoreWorkspace,
    });

    // Mock getState based on scenario
    mockUseWorkspaceStore.getState = vi.fn().mockReturnValue({
      workspaces: scenario.workspaces,
      currentWorkspace: scenario.workspaces[0] || null,
      workspacesLoaded: true,
      setCurrentWorkspace: mockSetCurrentWorkspace,
    });

    const TestComponent = () => (
      <BrowserRouter>
        <WorkspaceProvider>
          <div data-testid="child-content">Test Child</div>
        </WorkspaceProvider>
      </BrowserRouter>
    );

    const { unmount } = render(<TestComponent />);

    if (scenario.isAuthenticated) {
      // Authenticated users should trigger restoration
      await waitFor(() => {
        expect(mockRestoreWorkspace).toHaveBeenCalled();
      });

      if (scenario.workspaces.length === 0) {
        // No workspaces should redirect to create
        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith('/workspaces/create');
        });
      } else if (scenario.shouldRestoreFail) {
        // Failed restoration with workspaces should fallback to first
        await waitFor(() => {
          expect(mockSetCurrentWorkspace).toHaveBeenCalledWith(scenario.workspaces[0]);
        });
      }
    } else {
      // Unauthenticated users should skip restoration
      expect(mockRestoreWorkspace).not.toHaveBeenCalled();
      
      // Should render children immediately
      await waitFor(() => {
        expect(screen.getAllByTestId('child-content')).toHaveLength(1);
      });
    }

    // Clean up
    unmount();
  });

  /**
   * Test Case 6: Navigation behavior after restoration remains unchanged
   * EXPECTED ON UNFIXED CODE: This should PASS (baseline behavior to preserve)
   */
  it('should maintain consistent navigation behavior after workspace restoration', async () => {
    const mockWorkspaces = [
      { _id: 'workspace1', name: 'Test Workspace 1', membersCount: 1 },
      { _id: 'workspace2', name: 'Test Workspace 2', membersCount: 2 },
    ];

    const mockRestoreWorkspace = vi.fn().mockResolvedValue(undefined);

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
      restoreWorkspace: mockRestoreWorkspace,
    });

    // Mock getState to return successful restoration
    mockUseWorkspaceStore.getState = vi.fn().mockReturnValue({
      workspaces: mockWorkspaces,
      currentWorkspace: mockWorkspaces[0],
      workspacesLoaded: true,
      setCurrentWorkspace: vi.fn(),
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
      // Should complete restoration successfully
      expect(mockRestoreWorkspace).toHaveBeenCalled();
    });

    await waitFor(() => {
      // Should render children without any navigation
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    // Should not navigate anywhere when restoration is successful
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});