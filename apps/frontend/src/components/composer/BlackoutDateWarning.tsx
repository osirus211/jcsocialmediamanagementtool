import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, RotateCcw, Ban, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { blackoutDatesService, BlackoutCheckResult } from '@/services/blackout-dates.service';
import { useWorkspace } from '@/hooks/useWorkspace';

interface BlackoutDateWarningProps {
  scheduledDate: string | Date;
  onReschedule?: (newDate: Date) => void;
  className?: string;
}

export const BlackoutDateWarning: React.FC<BlackoutDateWarningProps> = ({
  scheduledDate,
  onReschedule,
  className
}) => {
  const { workspace } = useWorkspace();
  const [blackoutCheck, setBlackoutCheck] = useState<BlackoutCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (workspace?._id && scheduledDate && !dismissed) {
      checkBlackoutDate();
    }
  }, [workspace?._id, scheduledDate, dismissed]);

  const checkBlackoutDate = async () => {
    try {
      setLoading(true);
      const dateString = typeof scheduledDate === 'string' 
        ? scheduledDate 
        : scheduledDate.toISOString();
      
      const result = await blackoutDatesService.checkBlackoutDate(
        workspace!._id,
        dateString
      );
      
      setBlackoutCheck(result);
    } catch (error) {
      console.error('Failed to check blackout date:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionDetails = (action: string) => {
    switch (action) {
      case 'hold':
        return {
          icon: Clock,
          color: 'yellow',
          title: 'Post will be held',
          description: 'Your post will be held and published after the blackout period ends.'
        };
      case 'reschedule':
        return {
          icon: RotateCcw,
          color: 'blue',
          title: 'Post will be rescheduled',
          description: 'Your post will be automatically rescheduled to the next available time slot.'
        };
      case 'cancel':
        return {
          icon: Ban,
          color: 'red',
          title: 'Post will be cancelled',
          description: 'Your post will be cancelled and will not be published.'
        };
      default:
        return {
          icon: AlertTriangle,
          color: 'gray',
          title: 'Blackout period',
          description: 'This date falls within a blackout period.'
        };
    }
  };

  if (loading || dismissed || !blackoutCheck?.isBlackedOut || !blackoutCheck.blackoutDate) {
    return null;
  }

  const { blackoutDate } = blackoutCheck;
  const actionDetails = getActionDetails(blackoutDate.action);
  const ActionIcon = actionDetails.icon;

  const colorClasses = {
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
  };

  const iconColorClasses = {
    yellow: 'text-yellow-600',
    blue: 'text-blue-600',
    red: 'text-red-600',
    gray: 'text-gray-600',
  };

  return (
    <div className={`${colorClasses[actionDetails.color as keyof typeof colorClasses]} border rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <ActionIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColorClasses[actionDetails.color as keyof typeof iconColorClasses]}`} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-sm">
              {actionDetails.title}
            </h4>
            <button
              onClick={() => setDismissed(true)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <p className="text-sm mb-2">
            {actionDetails.description}
          </p>
          
          <div className="text-xs space-y-1">
            <div>
              <strong>Blackout Period:</strong> {format(parseISO(blackoutDate.startDate), 'MMM d, yyyy')}
              {blackoutDate.startDate !== blackoutDate.endDate && (
                <> - {format(parseISO(blackoutDate.endDate), 'MMM d, yyyy')}</>
              )}
            </div>
            <div>
              <strong>Reason:</strong> {blackoutDate.reason}
            </div>
          </div>

          {blackoutDate.action === 'cancel' && onReschedule && (
            <div className="mt-3">
              <button
                onClick={() => {
                  // Suggest a date after the blackout period
                  const suggestedDate = new Date(parseISO(blackoutDate.endDate));
                  suggestedDate.setDate(suggestedDate.getDate() + 1);
                  onReschedule(suggestedDate);
                }}
                className="text-sm bg-white border border-current rounded px-3 py-1 hover:bg-opacity-10"
              >
                Reschedule to {format(new Date(parseISO(blackoutDate.endDate).getTime() + 24 * 60 * 60 * 1000), 'MMM d')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};