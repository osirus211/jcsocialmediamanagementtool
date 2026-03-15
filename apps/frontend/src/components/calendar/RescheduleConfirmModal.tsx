import { useState } from 'react';
import { Post } from '@/types/post.types';
import { X, Calendar, Clock, ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/posts/StatusBadge';
import { getPlatformIcon } from '@/lib/platform-utils';

interface RescheduleConfirmModalProps {
  post: Post;
  oldDate: string;
  newDate: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * RescheduleConfirmModal Component
 * 
 * Confirmation modal before rescheduling posts
 * 
 * Features:
 * - Shows old vs new date/time clearly
 * - Post preview with content
 * - Platform indicators
 * - Smooth animations
 * - Keyboard shortcuts (Enter/Escape)
 * 
 * Superior to competitors:
 * - More detailed preview than Buffer
 * - Clearer time comparison than Hootsuite
 * - Better visual design than Later
 */
export function RescheduleConfirmModal({
  post,
  oldDate,
  newDate,
  onConfirm,
  onCancel,
}: RescheduleConfirmModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const oldDateTime = new Date(oldDate);
  const newDateTime = new Date(newDate);

  const formatDateTime = (date: Date) => ({
    date: date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }),
  });

  const oldFormatted = formatDateTime(oldDateTime);
  const newFormatted = formatDateTime(newDateTime);

  const handleConfirm = async () => {
    setIsConfirming(true);
    await onConfirm();
    setIsConfirming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const platformIcon = getPlatformIcon(post.socialAccountId || 'unknown');

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Reschedule Post
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Post Preview */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start gap-3">
            {/* Platform icon */}
            {platformIcon && (
              <img 
                src={platformIcon} 
                alt={post.socialAccountId} 
                className="w-8 h-8 rounded"
              />
            )}
            
            <div className="flex-1 min-w-0">
              {/* Status */}
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={post.status} />
                <span className="text-sm text-gray-500">
                  {post.socialAccountId}
                </span>
              </div>
              
              {/* Content */}
              <p className="text-sm text-gray-800 line-clamp-4">
                {post.content}
              </p>
              
              {/* Media indicator */}
              {post.mediaUrls && post.mediaUrls.length > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <span>📷</span>
                  <span>{post.mediaUrls.length} media file{post.mediaUrls.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Date/Time Comparison */}
        <div className="p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">
            Schedule Change
          </h3>
          
          <div className="space-y-4">
            {/* Old date/time */}
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex-shrink-0">
                <Calendar className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-red-800">
                  Current: {oldFormatted.date}
                </div>
                <div className="text-sm text-red-600 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {oldFormatted.time}
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>

            {/* New date/time */}
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex-shrink-0">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-green-800">
                  New: {newFormatted.date}
                </div>
                <div className="text-sm text-green-600 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {newFormatted.time}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isConfirming}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isConfirming ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Rescheduling...
              </>
            ) : (
              'Confirm Reschedule'
            )}
          </button>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="px-6 pb-4 text-xs text-gray-500 text-center">
          Press Enter to confirm or Escape to cancel
        </div>
      </div>
    </div>
  );
}