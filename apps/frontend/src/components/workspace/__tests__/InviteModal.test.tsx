import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { InviteMemberModal } from '../InviteMemberModal';
import { useWorkspaceStore } from '@/store/workspace.store';
import { apiClient } from '@/lib/api-client';

vi.mock('@/store/workspace.store');
vi.mock('@/lib/api-client');

const mockWorkspace = {
  _id: 'workspace-123',
  name: 'Test Workspace'
};

describe('InviteMemberModal', () => {
  beforeEach(() => {
    vi.mocked(useWorkspaceStore).mockReturnValue({
      currentWorkspace: mockWorkspace
    });
    vi.mocked(apiClient.post).mockResolvedValue({});
    vi.mocked(apiClient.get).mockResolvedValue({ invitations: [] });
  });

  it('submits correct payload', async () => {
    render(<InviteMemberModal isOpen={true} onClose={vi.fn()} />);

    const emailInput = screen.getByPlaceholderText(/enter email addresses/i);
    const roleSelect = screen.getByDisplayValue('Member - Can create and edit content');
    const submitButton = screen.getByText('Send Invitations');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(roleSelect, { target: { value: 'admin' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/workspaces/workspace-123/invitations',
        {
          email: 'test@example.com',
          role: 'admin'
        }
      );
    });
  });

  it('shows success message', async () => {
    render(<InviteMemberModal isOpen={true} onClose={vi.fn()} />);

    const emailInput = screen.getByPlaceholderText(/enter email addresses/i);
    const submitButton = screen.getByText('Send Invitations');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/successfully sent 1 invitation/i)).toBeInTheDocument();
    });
  });

  it('handles rate limit 429 error', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({
      response: {
        status: 429,
        data: { message: 'Too many invitation attempts. Please try again later.' }
      }
    });

    render(<InviteMemberModal isOpen={true} onClose={vi.fn()} />);

    const emailInput = screen.getByPlaceholderText(/enter email addresses/i);
    const submitButton = screen.getByText('Send Invitations');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/too many invitation attempts/i)).toBeInTheDocument();
    });
  });
});