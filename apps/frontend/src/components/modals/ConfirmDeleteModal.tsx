import { AlertCircle } from 'lucide-react';

interface ConfirmDeleteModalProps {
  title: string;
  message: string;
  itemName?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

/**
 * ConfirmDeleteModal Component
 * 
 * Confirms before deleting (safety)
 * 
 * Usage:
 * <ConfirmDeleteModal
 *   title="Delete Post"
 *   message="Are you sure you want to delete this post?"
 *   itemName={post.content}
 *   onConfirm={handleDelete}
 *   onCancel={() => setShowModal(false)}
 * />
 */
export function ConfirmDeleteModal({
  title,
  message,
  itemName,
  onConfirm,
  onCancel,
  isDeleting = false,
}: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {title}
            </h2>
            <p className="text-sm text-gray-600">
              {message}
            </p>
          </div>
        </div>

        {itemName && (
          <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4">
            <p className="text-sm text-gray-900 line-clamp-2">{itemName}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
