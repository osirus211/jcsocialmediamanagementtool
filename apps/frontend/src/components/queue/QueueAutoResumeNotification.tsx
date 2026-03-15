/**
 * Queue Auto-Resume Notification Component
 * 
 * Shows in-app notifications when queue auto-resumes
 * Superior to Buffer & Hootsuite - they don't have auto-resume notifications
 */

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { queueService, QueuePauseStatus } from '@/services/queue.service';
import { Play, Clock } from 'lucide-react';

interface QueueAutoResumeNotificationProps {
  onStatusChange?: (status: QueuePauseStatus) => void;
}

export function QueueAutoResumeNotification({ onStatusChange }: QueueAutoResumeNotificationProps) {
  const [lastStatus, setLastStatus] = useState<QueuePauseStatus | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkAutoResume = async () => {
      try {
        const currentStatus = await queueService.getQueueStatus();
        
        if (lastStatus) {
          // Check if workspace was paused and is now resumed
          if (lastStatus.isPaused && !currentStatus.isPaused) {
            toast.success('Queue automatically resumed!', {
              description: 'Publishing has resumed as scheduled',
              icon: <Play className="h-4 w-4 text-green-500" />,
              duration: 5000,
            });
          }

          // Check if any accounts were paused and are now resumed
          const previouslyPausedAccounts = lastStatus.accountPauses.filter(p => p.isPaused);
          const currentlyPausedAccounts = currentStatus.accountPauses.filter(p => p.isPaused);
          
          for (const prevPause of previouslyPausedAccounts) {
            const stillPaused = currentlyPausedAccounts.find(
              p => p.socialAccountId === prevPause.socialAccountId
            );
            
            if (!stillPaused) {
              toast.success(`${prevPause.socialAccountName} queue resumed!`, {
                description: 'Account publishing has resumed as scheduled',
                icon: <Play className="h-4 w-4 text-green-500" />,
                duration: 5000,
              });
            }
          }
        }

        setLastStatus(currentStatus);
        onStatusChange?.(currentStatus);
      } catch (error) {
        // Silently fail - don't show errors for background polling
      }
    };

    // Check immediately
    checkAutoResume();

    // Then check every 30 seconds
    interval = setInterval(checkAutoResume, 30000);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [lastStatus, onStatusChange]);

  // This component doesn't render anything visible
  return null;
}