import { useState, memo, useCallback } from 'react';
import { WorkspaceMember, WorkspaceRole, MemberStatus } from '@/types/workspace.types';
import { useAuthStore } from '@/store/auth.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { RemoveMemberModal } from './RemoveMemberModal';

interface MemberRowProps {
  member: WorkspaceMember;
  workspaceId: string;
  isOwner: boolean;
  isAdmin: boolean;
  onRoleChange: (member: WorkspaceMember, newRole: WorkspaceRole) => void;
  onRemove?: (member: WorkspaceMember) => () => void;
}

export const MemberRow = memo<MemberRowProps>(({ member, workspaceId, isOwner, isAdmin, onRoleChange, onRemove }) => {
  const { user } = useAuthStore();
  const { deactivateMember, reactivateMember } = useWorkspaceStore();
  
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const memberUser = typeof member.userId === 'string' ? null : member.userId;
  const memberUserId = typeof member.userId === 'string' ? member.userId : member.userId._id;
  const isCurrentUser = memberUserId === user?._id;
  const isActive = member.isActive;

  // Cannot perform actions on owner or yourself
  const canPerformActions = isAdmin && member.role !== WorkspaceRole.OWNER && !isCurrentUser;

  const handleDeactivate = useCallback(async () => {
    if (!canPerformActions) return;
    
    setIsLoading(true);
    try {
      await deactivateMember(workspaceId, memberUserId);
      setShowActionsMenu(false);
    } catch (error: any) {
      console.error('Failed to deactivate member:', error);
      // Error handling could be improved with toast notifications
    } finally {
      setIsLoading(false);
    }
  }, [canPerformActions, deactivateMember, workspaceId, memberUserId]);

  const handleReactivate = useCallback(async () => {
    if (!canPerformActions) return;
    
    setIsLoading(true);
    try {
      await reactivateMember(workspaceId, memberUserId);
      setShowActionsMenu(false);
    } catch (error: any) {
      console.error('Failed to reactivate member:', error);
      // Error handling could be improved with toast notifications
    } finally {
      setIsLoading(false);
    }
  }, [canPerformActions, reactivateMember, workspaceId, memberUserId]);

  const handleRoleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onRoleChange(member, e.target.value as WorkspaceRole);
  }, [onRoleChange, member]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setShowActionsMenu(!showActionsMenu);
    } else if (e.key === 'Escape') {
      setShowActionsMenu(false);
    }
  }, [showActionsMenu]);

  const handleRemoveClick = useCallback(() => {
    setShowRemoveModal(true);
    setShowActionsMenu(false);
  }, []);

  const handleCloseRemoveModal = useCallback(() => {
    setShowRemoveModal(false);
  }, []);

  const toggleActionsMenu = useCallback(() => {
    setShowActionsMenu(!showActionsMenu);
  }, [showActionsMenu]);

  const closeActionsMenu = useCallback(() => {
    setShowActionsMenu(false);
  }, []);

  const getStatusBadge = () => {
    if (!isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          Deactivated
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
        Active
      </span>
    );
  };

  const getRoleBadge = () => {
    const roleColors = {
      [WorkspaceRole.OWNER]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      [WorkspaceRole.ADMIN]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      [WorkspaceRole.MEMBER]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      [WorkspaceRole.VIEWER]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${roleColors[member.role]}`}>
        {member.role}
      </span>
    );
  };

  const formatJoinedDate = () => {
    if (!member.joinedAt) return 'Unknown';
    
    const date = new Date(member.joinedAt);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <div className="flex items-center gap-4 flex-1">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
            {memberUser?.avatar ? (
              <img
                src={memberUser.avatar}
                alt={`${memberUser.firstName} ${memberUser.lastName}`}
                className="w-full h-full object-cover"
              />
            ) : (
              memberUser ? `${memberUser.firstName[0]}${memberUser.lastName[0]}` : '?'
            )}
          </div>

          {/* Member Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                {memberUser ? `${memberUser.firstName} ${memberUser.lastName}` : 'Unknown User'}
                {isCurrentUser && (
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(You)</span>
                )}
              </h3>
              {getStatusBadge()}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="truncate">{memberUser?.email || 'No email'}</span>
              <span>•</span>
              <span>Joined {formatJoinedDate()}</span>
            </div>
          </div>

          {/* Role Badge */}
          <div className="flex-shrink-0">
            {getRoleBadge()}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {/* Role Selector */}
          {canPerformActions && isActive ? (
            <select
              value={member.role}
              onChange={handleRoleChange}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white capitalize"
              disabled={isLoading}
              aria-label={`Change role for ${memberUser ? `${memberUser.firstName} ${memberUser.lastName}` : 'member'}`}
            >
              <option value={WorkspaceRole.ADMIN}>Admin</option>
              <option value={WorkspaceRole.MEMBER}>Member</option>
              <option value={WorkspaceRole.VIEWER}>Viewer</option>
            </select>
          ) : (
            <div className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 capitalize">
              {member.role}
            </div>
          )}

          {/* Actions Menu */}
          {canPerformActions && (
            <div className="relative">
              <button
                onClick={toggleActionsMenu}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                disabled={isLoading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {showActionsMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                  <div className="py-1">
                    {isActive ? (
                      <button
                        onClick={handleDeactivate}
                        className="w-full text-left px-4 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        disabled={isLoading}
                      >
                        {isLoading ? 'Deactivating...' : 'Deactivate Member'}
                      </button>
                    ) : (
                      <button
                        onClick={handleReactivate}
                        className="w-full text-left px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        disabled={isLoading}
                      >
                        {isLoading ? 'Reactivating...' : 'Reactivate Member'}
                      </button>
                    )}
                    
                    <button
                      onClick={handleRemoveClick}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      disabled={isLoading}
                    >
                      Remove Member
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Remove Member Modal */}
      {showRemoveModal && (
        <RemoveMemberModal
          member={member}
          workspaceId={workspaceId}
          isOpen={showRemoveModal}
          onClose={handleCloseRemoveModal}
          onRemove={onRemove}
        />
      )}

      {/* Click outside to close menu */}
      {showActionsMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={closeActionsMenu}
        />
      )}
    </>
  );
});

MemberRow.displayName = 'MemberRow';