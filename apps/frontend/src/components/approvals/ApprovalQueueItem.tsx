/**
 * Approval Queue Item Component
 * 
 * Shows a single post awaiting approval
 */

import React, { useState } from 'react';
// import { formatDistanceToNow } from 'date-fns';
// import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ApprovalQueueItem as ApprovalItem } from '../../services/approvals.service';
import { approvalsService } from '../../services/approvals.service';
// import { toast } from 'react-hot-toast';

interface ApprovalQueueItemProps {
  item: ApprovalItem;
  onApprove?: (postId: string) => void;
  onReject?: (postId: string) => void;
}

export const ApprovalQueueItem: React.FC<ApprovalQueueItemProps> = ({
  item,
  onApprove,
  onReject,
}) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await approvalsService.approvePost(item.postId);
      setStatus('approved');
      console.log('Post approved successfully');
      onApprove?.(item.postId);
    } catch (error) {
      console.error('Failed to approve post');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      console.error('Rejection reason is required');
      return;
    }

    setIsRejecting(true);
    try {
      await approvalsService.rejectPost(item.postId, rejectionReason);
      setStatus('rejected');
      setShowRejectForm(false);
      console.log('Post rejected');
      onReject?.(item.postId);
    } catch (error) {
      console.error('Failed to reject post');
    } finally {
      setIsRejecting(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const iconClass = "w-5 h-5";
    switch (platform.toLowerCase()) {
      case 'twitter':
        return <div className={`${iconClass} bg-blue-500 rounded`} />;
      case 'facebook':
        return <div className={`${iconClass} bg-blue-600 rounded`} />;
      case 'instagram':
        return <div className={`${iconClass} bg-pink-500 rounded`} />;
      case 'linkedin':
        return <div className={`${iconClass} bg-blue-700 rounded`} />;
      case 'tiktok':
        return <div className={`${iconClass} bg-black rounded`} />;
      default:
        return <div className={`${iconClass} bg-gray-500 rounded`} />;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  if (status !== 'pending') {
    return (
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            {getPlatformIcon(item.platform)}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-white line-clamp-3">
                {item.content.substring(0, 120)}
                {item.content.length > 120 && '...'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Scheduled for {new Date(item.scheduledAt).toLocaleString()}
              </p>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {getPlatformIcon(item.platform)}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 dark:text-white line-clamp-3">
              {item.content.substring(0, 120)}
              {item.content.length > 120 && '...'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Scheduled for {new Date(item.scheduledAt).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Submitted {new Date(item.submittedForApprovalAt).toLocaleDateString()} ago
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 ml-4">
          {!showRejectForm && (
            <>
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="mr-1">✓</span>
                    Approve
                  </>
                )}
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <span className="mr-1">✗</span>
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {showRejectForm && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Please provide a reason for rejection..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            rows={3}
          />
          <div className="flex items-center justify-end space-x-2 mt-3">
            <button
              onClick={() => {
                setShowRejectForm(false);
                setRejectionReason('');
              }}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={isRejecting || !rejectionReason.trim()}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRejecting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Confirm Reject'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};