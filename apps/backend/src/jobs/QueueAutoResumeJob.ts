/**
 * Queue Auto-Resume Job
 * 
 * Scheduled job to automatically resume paused queues when their resume time is reached
 * Superior to Buffer & Hootsuite - they don't have auto-resume functionality
 */

import { queueService } from '../services/QueueService';
import { logger } from '../utils/logger';

export class QueueAutoResumeJob {
  /**
   * Process auto-resume for all workspaces
   * Should be run every minute via cron job
   */
  static async processAutoResume(): Promise<void> {
    try {
      logger.debug('Starting queue auto-resume job');

      await queueService.processAutoResume();

      logger.debug('Queue auto-resume job completed');
    } catch (error: any) {
      logger.error('Error in queue auto-resume job', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get statistics about auto-resume operations
   */
  static async getAutoResumeStats(): Promise<{
    workspacesWithScheduledResume: number;
    accountsWithScheduledResume: number;
    nextResumeTime?: Date;
  }> {
    try {
      const { Workspace } = await import('../models/Workspace');
      const now = new Date();

      // Count workspaces with scheduled resume
      const workspacesWithScheduledResume = await Workspace.countDocuments({
        'queuePause.isPaused': true,
        'queuePause.resumeAt': { $gt: now },
      });

      // Count accounts with scheduled resume
      const workspacesWithAccountResumes = await Workspace.find({
        'queuePause.accountPauses': {
          $elemMatch: {
            isPaused: true,
            resumeAt: { $gt: now },
          },
        },
      });

      let accountsWithScheduledResume = 0;
      let nextResumeTime: Date | undefined;

      for (const workspace of workspacesWithAccountResumes) {
        const activeAccountPauses = workspace.queuePause.accountPauses.filter(
          pause => pause.isPaused && pause.resumeAt && pause.resumeAt > now
        );
        accountsWithScheduledResume += activeAccountPauses.length;

        // Find earliest resume time
        for (const pause of activeAccountPauses) {
          if (pause.resumeAt && (!nextResumeTime || pause.resumeAt < nextResumeTime)) {
            nextResumeTime = pause.resumeAt;
          }
        }
      }

      // Also check workspace-level resume times
      const workspaceResumes = await Workspace.find({
        'queuePause.isPaused': true,
        'queuePause.resumeAt': { $gt: now },
      }).sort({ 'queuePause.resumeAt': 1 }).limit(1);

      if (workspaceResumes.length > 0) {
        const workspaceResumeTime = workspaceResumes[0].queuePause.resumeAt;
        if (!nextResumeTime || (workspaceResumeTime && workspaceResumeTime < nextResumeTime)) {
          nextResumeTime = workspaceResumeTime;
        }
      }

      const stats = {
        workspacesWithScheduledResume,
        accountsWithScheduledResume,
        nextResumeTime,
      };

      logger.debug('Auto-resume stats generated', stats);

      return stats;
    } catch (error: any) {
      logger.error('Error generating auto-resume stats', {
        error: error.message,
      });
      throw error;
    }
  }
}