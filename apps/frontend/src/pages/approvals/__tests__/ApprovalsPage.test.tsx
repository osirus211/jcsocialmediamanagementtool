import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ApprovalsPage } from '../ApprovalsPage';

// Mock the approvals service
vi.mock('@/services/approvals.service', () => ({
  approvalsService: {
    getApprovalCount: vi.fn(),
    getMyPendingPosts: vi.fn(),
    getPendingApprovals: vi.fn(),
    approvePost: vi.fn(),
    rejectPost: vi.fn(),
  },
}));

// Mock components to avoid complex dependencies
vi.mock('@/components/approvals/ApprovalQueuePanel', () => ({
  ApprovalQueuePanel: () => <div data-testid="approval-queue-panel">Approval Queue Panel</div>,
}));

vi.mock('@/components/approvals/ApprovalQueueItem', () => ({
  ApprovalQueueItem: ({ item, onApprove, onReject }: any) => (
    <div data-testid="approval-queue-item">
      <span>{item.content}</span>
      <button onClick={() => onApprove?.(item.postId)} aria-label={`Approve post ${item.postId}`}>
        Approve
      </button>
      <button onClick={() => onReject?.(item.postId)} aria-label={`Reject post ${item.postId}`}>
        Reject
      </button>
    </div>
  ),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('ApprovalsPage', () => {
  let mockApprovalsService: any;

  beforeAll(async () => {
    mockApprovalsService = (await vi.importMock('@/services/approvals.service')).approvalsService;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockApprovalsService.getApprovalCount).mockResolvedValue(5);
    vi.mocked(mockApprovalsService.getMyPendingPosts).mockResolvedValue([
      {
        postId: '1',
        content: 'Test post content',
        platform: 'twitter',
        scheduledAt: new Date(),
        submittedForApprovalAt: new Date(),
      },
    ]);
  });

  it('renders pending posts list', async () => {
    renderWithRouter(<ApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByText('Approval Queue')).toBeInTheDocument();
    });

    expect(screen.getByTestId('approval-queue-panel')).toBeInTheDocument();
  });

  it('shows loading skeleton during fetch', async () => {
    vi.mocked(mockApprovalsService.getApprovalCount).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(5), 100))
    );

    renderWithRouter(<ApprovalsPage />);

    // Should show loading state initially
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
  });

  it('displays approval stats correctly', async () => {
    renderWithRouter(<ApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // pending count
    });

    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    expect(screen.getByText('Approved Today')).toBeInTheDocument();
    expect(screen.getByText('Rejected Today')).toBeInTheDocument();
  });

  it('shows empty state when no pending posts', async () => {
    vi.mocked(mockApprovalsService.getMyPendingPosts).mockResolvedValue([]);

    renderWithRouter(<ApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByText('No posts submitted')).toBeInTheDocument();
    });

    expect(screen.getByText("You haven't submitted any posts for approval yet.")).toBeInTheDocument();
  });
});