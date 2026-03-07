import { SaveStatus } from '@/types/composer.types';
import { Loader2, Check, AlertCircle } from 'lucide-react';

interface StatusBarProps {
  saveStatus: SaveStatus;
  lastSaved?: Date;
  errorMessage?: string;
}

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
};

export function StatusBar({ saveStatus, lastSaved, errorMessage }: StatusBarProps) {
  return (
    <div 
      className="flex items-center gap-2 text-sm"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {saveStatus === 'saving' && (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />
          <span className="text-gray-600">Saving...</span>
        </>
      )}

      {saveStatus === 'saved' && lastSaved && (
        <>
          <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
          <span className="text-gray-600">
            Saved {formatTimeAgo(lastSaved)}
          </span>
        </>
      )}

      {saveStatus === 'error' && (
        <>
          <AlertCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
          <span className="text-red-600" role="alert">
            {errorMessage || 'Error saving'}
          </span>
        </>
      )}

      {saveStatus === 'idle' && lastSaved && (
        <span className="text-gray-500 text-xs">
          Last saved {formatTimeAgo(lastSaved)}
        </span>
      )}
    </div>
  );
}
