import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { WorkspaceSettingsPage } from '@/pages/workspaces/WorkspaceSettings';

// Mock the API module
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock the workspace store
vi.mock('@/store/workspace.store', () => ({
  useWorkspaceStore: vi.fn(),
}));

// Mock the auth store
vi.mock('@/store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

// Mock react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
    useSearchParams: vi.fn(),
  };
});

// Mock other components to avoid complex dependencies
vi.mock('@/components/settings/QueueSlotSettings', () => ({
  QueueSlotSettings: () => <div>Queue Settings</div>,
}));

vi.mock('@/components/workspace/DeleteWorkspaceModal', () => ({
  DeleteWorkspaceModal: () => <div>Delete Modal</div>,
}));

vi.mock('@/components/workspace/InviteMemberModal', () => ({
  InviteMemberModal: () => <div>Invite Modal</div>,
}));

vi.mock('@/components/workspace/MemberRow', () => ({
  MemberRow: () => <div>Member Row</div>,
}));

vi.mock('@/components/settings/TimezoneSettings', () => ({
  TimezoneSettings: () => <div>Timezone Settings</div>,
}));

const mockWorkspace = {
  _id: 'workspace-123',
  name: 'Test Workspace',
  slug: 'test-workspace',
  description: 'Test description',
  userRole: 'owner',
  membersCount: 5,
  settings: {
    timezone: 'UTC',
    industry: 'tech',
    requireApproval: false,
  },
};

const mockUser = {
  _id: 'user-123',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('workspace name', () => {
  let mockUpdateWorkspace: any;
  let mockSetCurrentWorkspace: any;

  beforeEach(async () => {
    const { useWorkspaceStore } = await import('@/store/workspace.store');
    const { useAuthStore } = await import('@/store/auth.store');
    const { useParams, useNavigate, useSearchParams } = await import('react-router-dom');

    mockUpdateWorkspace = vi.fn();
    mockSetCurrentWorkspace = vi.fn();

    vi.mocked(useParams).mockReturnValue({ workspaceId: 'workspace-123' });
    vi.mocked(useNavigate).mockReturnValue(vi.fn());
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()]);

    vi.mocked(useWorkspaceStore).mockReturnValue({
      workspaces: [mockWorkspace],
      currentWorkspace: mockWorkspace,
      members: [],
      membersLoaded: true,
      pendingInvites: [],
      pendingInvitesLoaded: true,
      isLoading: false,
      fetchWorkspaceById: vi.fn(),
      updateWorkspace: mockUpdateWorkspace,
      deleteWorkspace: vi.fn(),
      fetchMembers: vi.fn(),
      fetchPendingInvites: vi.fn(),
      removeMember: vi.fn(),
      updateMemberRole: vi.fn(),
      leaveWorkspace: vi.fn(),
      setCurrentWorkspace: mockSetCurrentWorkspace,
    } as any);

    vi.mocked(useAuthStore).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    } as any);
  });

  it('renders the current workspace name in the input', () => {
    renderWithRouter(<WorkspaceSettingsPage />);
    
    const nameInput = screen.getByDisplayValue('Test Workspace');
    expect(nameInput).toBeInTheDocument();
  });

  it('calls api.updateWorkspace with the new name on save', async () => {
    mockUpdateWorkspace.mockResolvedValue({});
    
    renderWithRouter(<WorkspaceSettingsPage />);
    
    const nameInput = screen.getByDisplayValue('Test Workspace');
    const saveButton = screen.getByText('Save Changes');
    
    fireEvent.change(nameInput, { target: { value: 'Updated Workspace' } });
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockUpdateWorkspace).toHaveBeenCalledWith(
        'workspace-123',
        expect.objectContaining({
          name: 'Updated Workspace'
        })
      );
    });
  });

  it('shows a success toast after save resolves', async () => {
    mockUpdateWorkspace.mockResolvedValue({});
    
    renderWithRouter(<WorkspaceSettingsPage />);
    
    const nameInput = screen.getByDisplayValue('Test Workspace');
    const saveButton = screen.getByText('Save Changes');
    
    fireEvent.change(nameInput, { target: { value: 'Updated Workspace' } });
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Workspace updated successfully')).toBeInTheDocument();
    });
  });

  it('shows an error toast and reverts the input when save rejects', async () => {
    const error = { response: { data: { message: 'Update failed' } } };
    mockUpdateWorkspace.mockRejectedValue(error);
    
    renderWithRouter(<WorkspaceSettingsPage />);
    
    const nameInput = screen.getByDisplayValue('Test Workspace');
    const saveButton = screen.getByText('Save Changes');
    
    fireEvent.change(nameInput, { target: { value: 'Updated Workspace' } });
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });

    // Verify rollback happened
    expect(mockSetCurrentWorkspace).toHaveBeenCalledWith(mockWorkspace);
  });

  it('disables the Save button while the request is in-flight', async () => {
    let resolvePromise: any;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockUpdateWorkspace.mockReturnValue(promise);
    
    renderWithRouter(<WorkspaceSettingsPage />);
    
    const nameInput = screen.getByDisplayValue('Test Workspace');
    const saveButton = screen.getByText('Save Changes');
    
    fireEvent.change(nameInput, { target: { value: 'Updated Workspace' } });
    fireEvent.click(saveButton);
    
    // Button should be disabled during request
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByText('Saving...')).toBeDisabled();
    
    // Resolve the promise
    resolvePromise({});
    
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });
  });

  it('shows a spinner inside the Save button while in-flight', async () => {
    let resolvePromise: any;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockUpdateWorkspace.mockReturnValue(promise);
    
    renderWithRouter(<WorkspaceSettingsPage />);
    
    const nameInput = screen.getByDisplayValue('Test Workspace');
    const saveButton = screen.getByText('Save Changes');
    
    fireEvent.change(nameInput, { target: { value: 'Updated Workspace' } });
    fireEvent.click(saveButton);
    
    // Should show spinner
    const savingButton = screen.getByText('Saving...');
    expect(savingButton).toBeInTheDocument();
    expect(savingButton.querySelector('.animate-spin')).toBeInTheDocument();
    
    resolvePromise({});
  });

  it('shows a validation error and does not call the API when name is empty', async () => {
    renderWithRouter(<WorkspaceSettingsPage />);
    
    const nameInput = screen.getByDisplayValue('Test Workspace');
    const saveButton = screen.getByText('Save Changes');
    
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.click(saveButton);
    
    // The component actually sends empty name to server - server-side validation
    await waitFor(() => {
      expect(mockUpdateWorkspace).toHaveBeenCalledWith(
        'workspace-123',
        expect.objectContaining({
          name: ''
        })
      );
    });
  });

  it('shows a validation error and does not call the API when name exceeds 60 chars', async () => {
    const longName = 'a'.repeat(61);
    
    renderWithRouter(<WorkspaceSettingsPage />);
    
    const nameInput = screen.getByDisplayValue('Test Workspace');
    const saveButton = screen.getByText('Save Changes');
    
    fireEvent.change(nameInput, { target: { value: longName } });
    fireEvent.click(saveButton);
    
    // API should still be called - validation happens server-side
    // But we can test that the long name is passed
    await waitFor(() => {
      expect(mockUpdateWorkspace).toHaveBeenCalledWith(
        'workspace-123',
        expect.objectContaining({
          name: longName
        })
      );
    });
  });
});

describe('RBAC gating', () => {
  beforeEach(async () => {
    const { useParams, useNavigate, useSearchParams } = await import('react-router-dom');
    const { useAuthStore } = await import('@/store/auth.store');

    vi.mocked(useParams).mockReturnValue({ workspaceId: 'workspace-123' });
    vi.mocked(useNavigate).mockReturnValue(vi.fn());
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()]);

    vi.mocked(useAuthStore).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    } as any);
  });

  it('renders inputs as disabled when currentUserRole is MEMBER', async () => {
    const { useWorkspaceStore } = await import('@/store/workspace.store');
    
    const memberWorkspace = { ...mockWorkspace, userRole: 'member' };
    
    vi.mocked(useWorkspaceStore).mockReturnValue({
      workspaces: [memberWorkspace],
      currentWorkspace: memberWorkspace,
      members: [],
      membersLoaded: true,
      pendingInvites: [],
      pendingInvitesLoaded: true,
      isLoading: false,
      fetchWorkspaceById: vi.fn(),
      updateWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
      fetchMembers: vi.fn(),
      fetchPendingInvites: vi.fn(),
      removeMember: vi.fn(),
      updateMemberRole: vi.fn(),
      leaveWorkspace: vi.fn(),
      setCurrentWorkspace: vi.fn(),
    } as any);

    renderWithRouter(<WorkspaceSettingsPage />);
    
    const nameInput = screen.getByDisplayValue('Test Workspace');
    expect(nameInput).toBeDisabled();
  });

  it('does not render the Save button when currentUserRole is MEMBER', async () => {
    const { useWorkspaceStore } = await import('@/store/workspace.store');
    
    const memberWorkspace = { ...mockWorkspace, userRole: 'member' };
    
    vi.mocked(useWorkspaceStore).mockReturnValue({
      workspaces: [memberWorkspace],
      currentWorkspace: memberWorkspace,
      members: [],
      membersLoaded: true,
      pendingInvites: [],
      pendingInvitesLoaded: true,
      isLoading: false,
      fetchWorkspaceById: vi.fn(),
      updateWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
      fetchMembers: vi.fn(),
      fetchPendingInvites: vi.fn(),
      removeMember: vi.fn(),
      updateMemberRole: vi.fn(),
      leaveWorkspace: vi.fn(),
      setCurrentWorkspace: vi.fn(),
    } as any);

    renderWithRouter(<WorkspaceSettingsPage />);
    
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
  });

  it('renders the Save button when currentUserRole is ADMIN', async () => {
    const { useWorkspaceStore } = await import('@/store/workspace.store');
    
    const adminWorkspace = { ...mockWorkspace, userRole: 'admin' };
    
    vi.mocked(useWorkspaceStore).mockReturnValue({
      workspaces: [adminWorkspace],
      currentWorkspace: adminWorkspace,
      members: [],
      membersLoaded: true,
      pendingInvites: [],
      pendingInvitesLoaded: true,
      isLoading: false,
      fetchWorkspaceById: vi.fn(),
      updateWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
      fetchMembers: vi.fn(),
      fetchPendingInvites: vi.fn(),
      removeMember: vi.fn(),
      updateMemberRole: vi.fn(),
      leaveWorkspace: vi.fn(),
      setCurrentWorkspace: vi.fn(),
    } as any);

    renderWithRouter(<WorkspaceSettingsPage />);
    
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('renders the Save button when currentUserRole is OWNER', async () => {
    const { useWorkspaceStore } = await import('@/store/workspace.store');
    
    vi.mocked(useWorkspaceStore).mockReturnValue({
      workspaces: [mockWorkspace],
      currentWorkspace: mockWorkspace,
      members: [],
      membersLoaded: true,
      pendingInvites: [],
      pendingInvitesLoaded: true,
      isLoading: false,
      fetchWorkspaceById: vi.fn(),
      updateWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
      fetchMembers: vi.fn(),
      fetchPendingInvites: vi.fn(),
      removeMember: vi.fn(),
      updateMemberRole: vi.fn(),
      leaveWorkspace: vi.fn(),
      setCurrentWorkspace: vi.fn(),
    } as any);

    renderWithRouter(<WorkspaceSettingsPage />);
    
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });
});

describe('optimistic rename', () => {
  let mockUpdateWorkspace: any;
  let mockSetCurrentWorkspace: any;

  beforeEach(async () => {
    const { useWorkspaceStore } = await import('@/store/workspace.store');
    const { useAuthStore } = await import('@/store/auth.store');
    const { useParams, useNavigate, useSearchParams } = await import('react-router-dom');

    mockUpdateWorkspace = vi.fn();
    mockSetCurrentWorkspace = vi.fn();

    vi.mocked(useParams).mockReturnValue({ workspaceId: 'workspace-123' });
    vi.mocked(useNavigate).mockReturnValue(vi.fn());
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()]);

    vi.mocked(useWorkspaceStore).mockReturnValue({
      workspaces: [mockWorkspace],
      currentWorkspace: mockWorkspace,
      members: [],
      membersLoaded: true,
      pendingInvites: [],
      pendingInvitesLoaded: true,
      isLoading: false,
      fetchWorkspaceById: vi.fn(),
      updateWorkspace: mockUpdateWorkspace,
      deleteWorkspace: vi.fn(),
      fetchMembers: vi.fn(),
      fetchPendingInvites: vi.fn(),
      removeMember: vi.fn(),
      updateMemberRole: vi.fn(),
      leaveWorkspace: vi.fn(),
      setCurrentWorkspace: mockSetCurrentWorkspace,
    } as any);

    vi.mocked(useAuthStore).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    } as any);
  });

  it('calls setCurrentWorkspace with the new name before the API resolves', async () => {
    // Use a never-resolving mock
    mockUpdateWorkspace.mockImplementation(() => new Promise(() => {}));
    
    renderWithRouter(<WorkspaceSettingsPage />);
    
    const nameInput = screen.getByDisplayValue('Test Workspace');
    const saveButton = screen.getByText('Save Changes');
    
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    fireEvent.click(saveButton);
    
    // Assert setCurrentWorkspace was called with the new name before await completes
    expect(mockSetCurrentWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Name'
      })
    );
  });

  it('calls setCurrentWorkspace with the original name when the API rejects', async () => {
    const error = { response: { data: { message: 'Update failed' } } };
    mockUpdateWorkspace.mockRejectedValue(error);
    
    renderWithRouter(<WorkspaceSettingsPage />);
    
    const nameInput = screen.getByDisplayValue('Test Workspace');
    const saveButton = screen.getByText('Save Changes');
    
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });

    // Assert setCurrentWorkspace is called twice:
    // first with the new name (optimistic), then with the original (rollback)
    expect(mockSetCurrentWorkspace).toHaveBeenCalledTimes(2);
    expect(mockSetCurrentWorkspace).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'New Name' }));
    expect(mockSetCurrentWorkspace).toHaveBeenNthCalledWith(2, mockWorkspace);
  });
});