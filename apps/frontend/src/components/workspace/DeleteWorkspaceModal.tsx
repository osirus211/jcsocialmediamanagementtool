import { useState } from 'react';
import { Workspace } from '@/types/workspace.types';

interface DeleteWorkspaceModalProps {
  workspace: Workspace;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

/**
 * Multi-step Delete Workspace Modal
 * 
 * Step 1: Warning with consequences
 * Step 2: Type workspace name to confirm
 * Step 3: Final delete button activates when name matches
 */
export const DeleteWorkspaceModal = ({
  workspace,
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: DeleteWorkspaceModalProps) => {
  const [step, setStep] = useState(1);
  const [confirmationText, setConfirmationText] = useState('');
  const [error, setError] = useState('');

  const isNameMatch = confirmationText === workspace.name;

  const handleClose = () => {
    setStep(1);
    setConfirmationText('');
    setError('');
    onClose();
  };

  const handleConfirm = async () => {
    try {
      setError('');
      await onConfirm();
      handleClose();
    } catch (error: any) {
      setError(error.message || 'Failed to delete workspace');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Workspace
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Step {step} of 2
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-gray-900 dark:text-white">
                You are about to permanently delete <strong>"{workspace.name}"</strong>.
              </p>
              
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
                  This action will:
                </h4>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                  <li>• Delete all posts and scheduled content</li>
                  <li>• Remove all team members from the workspace</li>
                  <li>• Delete all analytics and reporting data</li>
                  <li>• Cancel any active subscriptions</li>
                  <li>• Permanently delete all workspace data</li>
                </ul>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Warning:</strong> This action cannot be undone. All data will be permanently lost.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-gray-900 dark:text-white">
                To confirm deletion, please type the workspace name exactly as shown:
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                disabled={isLoading}
              >
                Back
              </button>
            )}

            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                disabled={isLoading}
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={isLoading || !isNameMatch}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Workspace'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};