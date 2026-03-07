import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  type: ToastType;
  message: string;
  onClose: () => void;
  duration?: number;
}

const toastStyles: Record<ToastType, { bg: string; border: string; icon: JSX.Element }> = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-500',
    icon: <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />,
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    icon: <XCircle className="h-5 w-5 text-red-600" aria-hidden="true" />,
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-500',
    icon: <AlertCircle className="h-5 w-5 text-yellow-600" aria-hidden="true" />,
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    icon: <AlertCircle className="h-5 w-5 text-blue-600" aria-hidden="true" />,
  },
};

export function Toast({ type, message, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (type === 'success' && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [type, duration, onClose]);

  const styles = toastStyles[type];

  return (
    <div
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`flex items-start gap-3 p-4 rounded-lg border-l-4 ${styles.bg} ${styles.border} shadow-lg animate-slide-in`}
    >
      {styles.icon}
      <p className="flex-1 text-sm text-gray-800">{message}</p>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
