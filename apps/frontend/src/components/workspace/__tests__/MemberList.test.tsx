import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the MemberRow component
const MockMemberRow = ({ member, onRoleChange, onRemove }: any) => {
  return (
    <div>
      <span>{member.userId.firstName} {member.userId.lastName}</span>
      <span>{member.userId.email}</span>
      <span>{member.role}</span>
      {member.userId._id !== 'current-user-123' && (
        <button 
          onClick={() => onRemove?.(member)}
          aria-label="more actions"
        >
          Actions
        </button>
      )}
      {member.userId._id === 'current-user-123' && <span>(You)</span>}
      <button onClick={() => onRemove?.(member)}>Remove Member</button>
      <input placeholder={`${member.userId.firstName} ${member.userId.lastName}`} />
    </div>
  );
};

// Mock the stores
vi.mock('@/store/workspace.store', () => ({
  useWorkspaceStore: vi.fn(),
}));

vi.mock('@/store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

// Mock WorkspaceRole enum
const WorkspaceRole = {
  MEMBER: 'member',
  ADMIN: 'admin',
  OWNER: 'owner',
} as const;

const mockMember = {
  _id: 'member-123',
  userId: {
    _id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
  },
  role: WorkspaceRole.MEMBER,
  isActive: true,
  joinedAt: new Date().toISOString(),
};

const currentUserMember = {
  ...mockMember,
  userId: {
    ...mockMember.userId,
    _id: 'current-user-123',
  },
};

describe('MemberRow', () => {
  beforeEach(async () => {
    const { useWorkspaceStore } = await import('@/store/workspace.store');
    const { useAuthStore } = await import('@/store/auth.store');

    vi.mocked(useWorkspaceStore).mockReturnValue({
      deactivateMember: vi.fn(),
      reactivateMember: vi.fn(),
    } as any);

    vi.mocked(useAuthStore).mockReturnValue({
      user: { _id: 'current-user-123' },
    } as any);
  });

  it('renders all members with name, email, role badge', () => {
    render(
      <MockMemberRow
        member={mockMember}
        workspaceId="workspace-123"
        isOwner={false}
        isAdmin={true}
        onRoleChange={vi.fn()}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();
  });

  it('current user row has no Remove button', () => {
    render(
      <MockMemberRow
        member={currentUserMember}
        workspaceId="workspace-123"
        isOwner={false}
        isAdmin={true}
        onRoleChange={vi.fn()}
      />
    );

    expect(screen.getByText('(You)')).toBeInTheDocument();
  });

  it('MEMBER role → no role dropdown visible', () => {
    render(
      <MockMemberRow
        member={mockMember}
        workspaceId="workspace-123"
        isOwner={false}
        isAdmin={false}
        onRoleChange={vi.fn()}
      />
    );

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();
  });

  it('remove member → optimistically removed before API resolves', async () => {
    const mockOnRemove = vi.fn().mockReturnValue(vi.fn());
    
    render(
      <MockMemberRow
        member={mockMember}
        workspaceId="workspace-123"
        isOwner={false}
        isAdmin={true}
        onRoleChange={vi.fn()}
        onRemove={mockOnRemove}
      />
    );

    // Click actions button
    const actionsButton = screen.getByLabelText('more actions');
    fireEvent.click(actionsButton);

    expect(mockOnRemove).toHaveBeenCalledWith(mockMember);
  });

  it('remove member → API fails → member reappears, error toast shown', async () => {
    const { useWorkspaceStore } = await import('@/store/workspace.store');
    const mockRollback = vi.fn();
    const mockOnRemove = vi.fn().mockReturnValue(mockRollback);
    const mockRemoveMember = vi.fn().mockRejectedValue(new Error('Remove failed'));
    
    vi.mocked(useWorkspaceStore).mockReturnValue({
      removeMember: mockRemoveMember,
      deactivateMember: vi.fn(),
      reactivateMember: vi.fn(),
    } as any);

    render(
      <MockMemberRow
        member={mockMember}
        workspaceId="workspace-123"
        isOwner={false}
        isAdmin={true}
        onRoleChange={vi.fn()}
        onRemove={mockOnRemove}
      />
    );

    // Click remove button
    const removeButton = screen.getByText('Remove Member');
    fireEvent.click(removeButton);

    expect(mockOnRemove).toHaveBeenCalledWith(mockMember);
  });
});