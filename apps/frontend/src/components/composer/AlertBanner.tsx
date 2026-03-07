import { AlertCircle, RefreshCw, X } from 'lucide-react';

interface AlertBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  isRetrying?: boolean;
}

export function AlertBanner({ message, onRetry, onDismiss, isRetrying = false }: AlertBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg"
    >
      <div className="flex items-start gap-3 flex-1">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-red-800">{message}</p>
      </div>
      
      <div className="flex items-center gap-2 self-end sm:self-auto">
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Retry failed operation"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        )}
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-600 hover:text-red-800 transition-colors"
            aria-label="Dismiss error message"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
