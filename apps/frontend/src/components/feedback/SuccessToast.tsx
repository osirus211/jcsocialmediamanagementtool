import { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface SuccessToastProps {
  message: string;
  onClose: () => void;
  duration?: number; // milliseconds
}

/**
 * SuccessToast Component
 * 
 * Shows success feedback that auto-dismisses
 * 
 * Usage:
 * <SuccessToast
 *   message="Post scheduled successfully!"
 *   onClose={() => setShowToast(false)}
 * />
 */
export function SuccessToast({
  message,
  onClose,
  duration = 3000,
}: SuccessToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="bg-green-50 border border-green-200 rounded-lg shadow-lg p-4 min-w-[300px]">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          
          <p className="flex-1 text-sm font-medium text-green-900">
            {message}
          </p>
          
          <button
            onClick={onClose}
            className="flex-shrink-0 text-green-600 hover:text-green-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
