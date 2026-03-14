import { useState } from 'react';
import { WorkspaceMember } from '@/types/workspace.types';
import { useWorkspaceStore } from '@/store/workspace.store';

interface RemoveMemberModalProps {
  member: WorkspaceMember;
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const RemoveMemberModal = ({ member, workspaceId, isOpen, onClose }: RemoveMemberModalProps) => {
  const { removeMember } = useWorkspaceStore();
  const [confirmationText, setConfirmationText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const memberUser = typeof member.userId === 'string' ? null : member.userId;
  const memberUserId = typeof member.userId === 'string' ? member.userId : member.userId._id;
  const memberName = memberUser ? `${memberUser.firstName} ${memberUser.lastName}` : 'Unknown User';
  const expectedText = memberName;

  const handleRemove = async () => {
    if (confirmationText !== expectedText) {
      setError('Please type the member name exactly as shown');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await removeMember(workspaceId, memberUserId);
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to remove member');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Remove Member
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This action cannot be undone
              </p>
            </div>
          </div>

          {/* Member Info */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                {memberUser ? `${memberUser.firstName[0]}${memberUser.lastName[0]}` : '?'}
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {memberName}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {memberUser?.email || 'No email'}
                </div>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
              What happens when you remove this member:
            </h4>
            <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
              <li>• They will lose access to this workspace immediately</li>
              <li>• All their active sessions will be revoked</li>
              <li>• Their scheduled posts will be archived or reassigned</li>
              <li>• Any pending invitations for this user will be cancelled</li>
              <li>• This action cannot be undone</li>
            </ul>
          </div>

          {/* Confirmation Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type <span className="font-semibold text-red-600 dark:text-red-400">{expectedText}</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => {
                setConfirmationText(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={expectedText}
              disabled={isLoading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleRemove}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || confirmationText !== expectedText}
            >
              {isLoading ? 'Removing...' : 'Remove Member'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};