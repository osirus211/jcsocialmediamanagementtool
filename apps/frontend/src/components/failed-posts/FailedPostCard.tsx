import { useState } from 'react';
import { DLQJob, RetryStatus } from '@/types/dlq.types';
import { AlertCircle, RefreshCw, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { ConfirmDeleteModal } from '@/components/modals/ConfirmDeleteModal';

interface FailedPostCardProps {
  job: DLQJob;
  onRetry: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  retryStatus: RetryStatus;
  retryError: string | null;
  isRetrying: boolean;
}

/**
 * FailedPostCard Component
 * 
 * Displays a single failed post with retry/delete actions
 * 
 * Features:
 * - Shows post content
 * - Shows error message with hints
 * - Retry button with loading state
 * - Delete button with confirmation
 * - Status indicators
 */
export function FailedPostCard({
  job,
  onRetry,
  onDelete,
  retryStatus,
  retryError,
  isRetrying,
}: FailedPostCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRetry = () => {
    onRetry(job.id);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(job.id);
    setIsDeleting(false);
    setShowDeleteModal(false);
  };

  /**
   * Get error hint based on error message
   */
  const getErrorHint = (error: string): string | null => {
    const lowerError = error.toLowerCase();
    
    if (lowerError.includes('token') || lowerError.includes('expired') || lowerError.includes('unauthorized')) {
      return 'Token expired. Please reconnect your account.';
    }
    
    if (lowerError.includes('media') || lowerError.includes('upload') || lowerError.includes('file')) {
      return 'Media upload failed. Try uploading the media again.';
    }
    
    if (lowerError.includes('network') || lowerError.includes('timeout') || lowerError.includes('connection')) {
      return 'Network error. Retry should work.';
    }
    
    if (lowerError.includes('rate limit') || lowerError.includes('too many')) {
      return 'Rate limit reached. Wait a few minutes before retrying.';
    }
    
    return null;
  };

  const errorHint = getErrorHint(job.error);
  const failedAt = new Date(job.failedAt);
  const scheduledAt = job.data.scheduledAt ? new Date(job.data.scheduledAt) : null;

  return (
    <>
      <div className="bg-white border border-red-200 rounded-lg p-4 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-2 flex-1">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 mb-1">Failed Post</h3>
              <p className="text-sm text-gray-600 line-clamp-2">{job.data.content}</p>
            </div>
          </div>
          
          {/* Status indicator */}
          {retryStatus === RetryStatus.SUCCESS && (
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Retried</span>
            </div>
          )}
          
          {retryStatus === RetryStatus.FAILED && (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <XCircle className="w-4 h-4" />
              <span>Failed</span>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
          {scheduledAt && (
            <div>
              <span className="text-gray-500">Scheduled:</span>
              <span className="ml-2 text-gray-900">
                {scheduledAt.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}
          
          <div>
            <span className="text-gray-500">Failed:</span>
            <span className="ml-2 text-gray-900">
              {failedAt.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>
          
          {job.data.platform && (
            <div>
              <span className="text-gray-500">Platform:</span>
              <span className="ml-2 text-gray-900 capitalize">{job.data.platform}</span>
            </div>
          )}
          
          <div>
            <span className="text-gray-500">Attempts:</span>
            <span className="ml-2 text-gray-900">{job.attemptsMade}</span>
          </div>
        </div>

        {/* Error message */}
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
          <p className="text-sm text-red-900 font-medium mb-1">Error:</p>
          <p className="text-sm text-red-800">{job.error}</p>
          
          {errorHint && (
            <div className="mt-2 pt-2 border-t border-red-200">
              <p className="text-sm text-red-700">
                💡 {errorHint}
              </p>
            </div>
          )}
        </div>

        {/* Retry error (if any) */}
        {retryError && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
            <p className="text-sm text-red-900 font-medium mb-1">Retry Failed:</p>
            <p className="text-sm text-red-800">{retryError}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleRetry}
            disabled={isRetrying || retryStatus === RetryStatus.RETRYING}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRetrying || retryStatus === RetryStatus.RETRYING ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Retry Post
              </>
            )}
          </button>
          
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={isRetrying}
            className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <ConfirmDeleteModal
          title="Delete Failed Post"
          message="Are you sure you want to delete this failed post? This action cannot be undone."
          itemName={job.data.content}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
}
