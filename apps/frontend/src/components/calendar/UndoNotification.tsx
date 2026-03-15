import { useEffect, useState } from 'react';
import { Post } from '@/types/post.types';
import { X, Undo2, Clock } from 'lucide-react';

interface UndoNotificationProps {
  post: Post;
  oldDate: string;
  newDate: string;
  onUndo: () => void;
  onDismiss: () => void;
}

/**
 * UndoNotification Component
 * 
 * Shows undo option for 5 seconds after reschedule
 * 
 * Features:
 * - 5-second countdown timer
 * - One-click undo functionality
 * - Smooth slide-in animation
 * - Auto-dismiss after timeout
 * - Manual dismiss option
 * 
 * Better than competitors:
 * - More prominent than Buffer's subtle undo
 * - Clearer timing than Hootsuite
 * - Better positioning than Later
 */
export function UndoNotification({
  post,
  oldDate,
  newDate,
  onUndo,
  onDismiss,
}: UndoNotificationProps) {
  const [timeLeft, setTimeLeft] = useState(5);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Slide in animation
    const showTimer = setTimeout(() => setIsVisible(true), 100);
    
    // Countdown timer
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(showTimer);
      clearInterval(interval);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300); // Wait for slide-out animation
  };

  const handleUndo = () => {
    setIsVisible(false);
    setTimeout(onUndo, 150); // Quick feedback
  };

  const oldDateTime = new Date(oldDate);
  const newDateTime = new Date(newDate);

  const formatTime = (date: Date) => 
    date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transform transition-all duration-300 ${
        isVisible 
          ? 'translate-y-0 opacity-100' 
          : 'translate-y-full opacity-0'
      }`}
    >
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Undo2 className="w-4 h-4 text-green-600" />
            </div>
            <span className="font-medium text-gray-900">
              Post Rescheduled
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="text-sm text-gray-600 mb-3">
          <div className="truncate mb-1">"{post.content}"</div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-red-600">
              {formatTime(oldDateTime)}
            </span>
            <span>→</span>
            <span className="text-green-600">
              {formatTime(newDateTime)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleUndo}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </button>
          
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>{timeLeft}s</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / 5) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}