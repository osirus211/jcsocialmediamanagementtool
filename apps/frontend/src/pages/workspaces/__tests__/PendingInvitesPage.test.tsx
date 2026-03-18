import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { PendingInvitesPage } from '../PendingInvitesPage';

// Mock the invitation service
vi.mock('@/services/invitation.service', () => ({
  invitationService: {
    getInvitations: vi.fn(),
    getInvitationStats: vi.fn(),
    resendInvitation: vi.fn(),
    cancelInvitation: vi.fn(),
    bulkCancelInvitations: vi.fn(),
  },
}));

// Mock the workspace store
vi.mock('@/store/workspace.store', () => ({
  useWorkspaceStore: vi.fn(),
}));

// Mock react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('PendingInvitesPage', () => {
  let mockInvitationService: any;
  let mockUseWorkspaceStore: any;
  let mockUseParams: any;
  let mockUseNavigate: any;
  const mockNavigate = vi.fn();

  beforeAll(async () => {
    mockInvitationService = (await vi.importMock('@/services/invitation.service')).invitationService;
    mockUseWorkspaceStore = (await vi.importMock('@/store/workspace.store')).useWorkspaceStore;
    mockUseParams = (await vi.importMock('react-router-dom')).useParams;
    mockUseNavigate = (await vi.importMock('react-router-dom')).useNavigate;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseParams.mockReturnValue({ workspaceId: 'workspace-1' });
    mockUseNavigate.mockReturnValue(mockNavigate);
    
    vi.mocked(mockUseWorkspaceStore).mockReturnValue({
      currentWorkspace: {
        _id: 'workspace-1',
        name: 'Test Workspace',
        userRole: 'admin',
      },
    });

    vi.mocked(mockInvitationService.getInvitations).mockResolvedValue({
      invitations: [
        {
          _id: '1',
          token: 'token-1',
          invitedEmail: 'test@example.com',
          role: 'member',
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          inviterName: 'Admin User',
        },
      ],
      pagination: { page: 1, limit: 10, total: 1 },
    });

    vi.mocked(mockInvitationService.getInvitationStats).mockResolvedValue({
      totalSent: 10,
      pending: 1,
      accepted: 8,
      expired: 1,
      revoked: 0,
      acceptanceRate: 80,
    });
  });

  it('renders list of pending invitations', async () => {
    renderWithRouter(<PendingInvitesPage />);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    expect(screen.getByText('member')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });

  it('shows each invite with email, role, and expiry date', async () => {
    renderWithRouter(<PendingInvitesPage />);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    expect(screen.getByText('member')).toBeInTheDocument();
    expect(screen.getByText(/Expires in \d+ days/)).toBeInTheDocument();
  });

  it('resend button calls POST resend endpoint', async () => {
    vi.mocked(mockInvitationService.resendInvitation).mockResolvedValue(undefined);

    renderWithRouter(<PendingInvitesPage />);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    const resendButton = screen.getByRole('button', { name: /resend/i });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(vi.mocked(mockInvitationService.resendInvitation)).toHaveBeenCalledWith('workspace-1', 'token-1');
    });
  });

  it('revoke button calls DELETE endpoint', async () => {
    vi.mocked(mockInvitationService.cancelInvitation).mockResolvedValue(undefined);
    
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);

    renderWithRouter(<PendingInvitesPage />);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(vi.mocked(mockInvitationService.cancelInvitation)).toHaveBeenCalledWith('workspace-1', 'token-1');
    });

    // Restore window.confirm
    window.confirm = originalConfirm;
  });

  it('shows empty state when no pending invites', async () => {
    vi.mocked(mockInvitationService.getInvitations).mockResolvedValue({
      invitations: [],
      pagination: { page: 1, limit: 10, total: 0 },
    });

    renderWithRouter(<PendingInvitesPage />);

    await waitFor(() => {
      expect(screen.getByText('No pending invitations')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton during fetch', async () => {
    vi.mocked(mockInvitationService.getInvitations).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        invitations: [],
        pagination: { page: 1, limit: 10, total: 0 },
      }), 100))
    );

    renderWithRouter(<PendingInvitesPage />);

    // Should show loading spinner initially
    expect(screen.getByRole('generic', { name: /loading/i }) || screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});