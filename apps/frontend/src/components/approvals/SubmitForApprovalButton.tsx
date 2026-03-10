/**
 * Submit For Approval Button Component
 * 
 * Button component for use in composer and post cards
 */

import React, { useState } from 'react';
// import { ClockIcon, CheckIcon, XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { approvalsService } from '../../services/approvals.service';
// import { toast } from 'react-hot-toast';

interface SubmitForApprovalButtonProps {
  postId: string;
  status: string;
  rejectionReason?: string;
  onStatusChange?: (newStatus: string) => void;
  className?: string;
}

export const SubmitForApprovalButton: React.FC<SubmitForApprovalButtonProps> = ({
  postId,
  status,
  rejectionReason,
  onStatusChange,
  className = '',
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await approvalsService.submitForApproval(postId);
      console.log('Post submitted for approval');
      onStatusChange?.('pending_approval');
    } catch (error) {
      console.error('Failed to submit post for approval');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResubmit = async () => {
    setIsSubmitting(true);
    try {
      await approvalsService.submitForApproval(postId);
      console.log('Post resubmitted for approval');
      onStatusChange?.('pending_approval');
    } catch (error) {
      console.error('Failed to resubmit post for approval');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show submit button for draft posts
  if (status === 'draft') {
    return (
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className={`inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {isSubmitting ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
        ) : (
          <span className="mr-2">📤</span>
        )}
        Submit for Approval
      </button>
    );
  }

  // Show pending badge for posts awaiting approval
  if (status === 'pending_approval') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 ${className}`}>
        <span className="mr-1">⏰</span>
        Pending Approval
      </span>
    );
  }

  // Show approved badge for approved posts
  if (status === 'approved') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 ${className}`}>
        <span className="mr-1">✅</span>
        Approved
      </span>
    );
  }

  // Show rejected badge with resubmit option for rejected posts
  if (status === 'rejected') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <span className="mr-1">❌</span>
          Rejected
          {rejectionReason && (
            <span className="ml-1">— {rejectionReason}</span>
          )}
        </span>
        <button
          onClick={handleResubmit}
          disabled={isSubmitting}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin mr-1" />
          ) : (
            <span className="mr-1">📤</span>
          )}
          Resubmit
        </button>
      </div>
    );
  }

  // Don't show anything for other statuses
  return null;
};