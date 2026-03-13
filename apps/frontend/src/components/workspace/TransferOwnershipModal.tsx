import { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace.store';
import { Workspace, WorkspaceMember, WorkspaceRole } from '@/types/workspace.types';

interface TransferOwnershipModalProps {
  workspace: Workspace;
  members: WorkspaceMember[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Transfer Ownership Modal
 * 
 * Features:
 * - Select new owner from admin members
 * - Multi-step confirmation
 * - Clear warnings about consequences
 * - Type workspace name to confirm
 */
export const TransferOwnershipModal = ({
  workspace,
  members,
  isOpen,
  onClose,
}: TransferOwnershipModalProps) => {
  const { transferOwnership } = useWorkspaceStore();
  const [step, setStep] = useState(1);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Only show admin members as potential owners
  const eligibleMembers = members.filter(
    (member) => member.role === WorkspaceRole.ADMIN && member.userId !== workspace.ownerId
  );

  const selectedMember = eligibleMembers.find(
    (member) => (typeof member.userId === 'string' ? member.userId : member.userId._id) === selectedMemberId
  );

  const isNameMatch = confirmationText === workspace.name;

  const handleClose = () => {
    setStep(1);
    setSelectedMemberId('');
    setConfirmationText('');
    setError('');
    setIsLoading(false);
    onClose();
  };

  const handleTransfer = async () => {
    if (!selectedMemberId) return;

    setIsLoading(true);
    setError('');

    try {
      await transferOwnership(workspace._id, {
        newOwnerId: selectedMemberId,
      });
      handleClose();
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || 'Failed to transfer ownership');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Transfer Ownership
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Step {step} of 3
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-gray-900 dark:text-white">
                Transfer ownership of <strong>"{workspace.name}"</strong> to another admin member.
              </p>

              {eligibleMembers.length === 0 ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    No eligible members found. Only admin members can become owners. 
                    Please promote a member to admin first.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select New Owner
                  </label>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select a member...</option>
                    {eligibleMembers.map((member) => {
                      const memberUser = typeof member.userId === 'string' ? null : member.userId;
                      const memberId = typeof member.userId === 'string' ? member.userId : member.userId._id;
                      return (
                        <option key={member._id} value={memberId}>
                          {memberUser ? `${memberUser.firstName} ${memberUser.lastName} (${memberUser.email})` : 'Unknown User'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          )}

          {step === 2 && selectedMember && (
            <div className="space-y-4">
              <p className="text-gray-900 dark:text-white">
                You are about to transfer ownership to:
              </p>
              
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    {typeof selectedMember.userId === 'string' ? '?' : `${selectedMember.userId.firstName[0]}${selectedMember.userId.lastName[0]}`}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {typeof selectedMember.userId === 'string' ? 'Unknown User' : `${selectedMember.userId.firstName} ${selectedMember.userId.lastName}`}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {typeof selectedMember.userId === 'string' ? 'No email' : selectedMember.userId.email}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                  This will:
                </h4>
                <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                  <li>• Transfer full ownership to the selected member</li>
                  <li>• Change your role from Owner to Admin</li>
                  <li>• Give them access to billing and workspace deletion</li>
                  <li>• Allow them to transfer ownership again</li>
                </ul>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-gray-900 dark:text-white">
                To confirm the ownership transfer, please type the workspace name exactly:
              </p>
              
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                <code className="text-sm font-mono text-gray-900 dark:text-white">
                  {workspace.name}
                </code>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="Type workspace name here"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              {!isNameMatch && confirmationText.length > 0 && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Workspace name does not match
                </p>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                disabled={isLoading}
              >
                Back
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={step === 1 && (!selectedMemberId || eligibleMembers.length === 0)}
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleTransfer}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={isLoading || !isNameMatch}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Transferring...
                  </>
                ) : (
                  'Transfer Ownership'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};