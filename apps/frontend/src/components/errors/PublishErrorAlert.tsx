import { AlertCircle, X } from 'lucide-react';

interface PublishErrorAlertProps {
  error: string;
  postContent?: string;
  onRetry?: () => void;
  onDismiss: () => void;
}

/**
 * PublishErrorAlert Component
 * 
 * Shows publish failure with clear messaging and actions
 */
export function PublishErrorAlert({
  error,
  postContent,
  onRetry,
  onDismiss,
}: PublishErrorAlertProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-red-600" />
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 mb-1">
            Failed to publish post
          </h3>
          
          <p className="text-sm text-red-800 mb-3">
            {error}
          </p>
          
          {postContent && (
            <div className="bg-white border border-red-200 rounded p-2 mb-3">
              <p className="text-xs text-gray-600 mb-1">Post content:</p>
              <p className="text-sm text-gray-900 line-clamp-2">{postContent}</p>
            </div>
          )}
          
          <div className="flex gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            )}
            
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 border border-red-300 text-red-700 text-sm rounded hover:bg-red-50 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
        
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-red-600 hover:text-red-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
