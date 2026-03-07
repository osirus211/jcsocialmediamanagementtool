import { AlertCircle, FileText } from 'lucide-react';

interface DraftRecoveryModalProps {
  draftContent: string;
  lastSavedAt: Date;
  onRestore: () => void;
  onDiscard: () => void;
}

/**
 * DraftRecoveryModal Component
 * 
 * Asks user to restore or discard unsaved draft
 * 
 * Shown when:
 * - User returns to composer
 * - Unsaved draft found in sessionStorage
 */
export function DraftRecoveryModal({
  draftContent,
  lastSavedAt,
  onRestore,
  onDiscard,
}: DraftRecoveryModalProps) {
  const timeAgo = getTimeAgo(lastSavedAt);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Unsaved draft found
            </h2>
            <p className="text-sm text-gray-600">
              You have an unsaved draft from {timeAgo}. Would you like to restore it?
            </p>
          </div>
        </div>

        {/* Draft preview */}
        <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4">
          <p className="text-xs text-gray-600 mb-1">Draft content:</p>
          <p className="text-sm text-gray-900 line-clamp-3">{draftContent}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onRestore}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Restore Draft
          </button>
          
          <button
            onClick={onDiscard}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Start Fresh
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Get human-readable time ago
 */
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) {
    return 'just now';
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
