/**
 * Background Job Service
 * 
 * Simple background job processing system
 */

import { logger } from '../utils/logger';
import { WorkspaceService } from './WorkspaceService';
import mongoose from 'mongoose';

export enum JobType {
  WORKSPACE_MEMBER_CLEANUP = 'WORKSPACE_MEMBER_CLEANUP',
}

export interface Job {
  id: string;
  type: JobType;
  payload: any;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

class BackgroundJobService {
  private jobs: Map<string, Job> = new Map();
  private processing = false;
  private readonly MAX_ATTEMPTS = 3;
  private readonly BATCH_SIZE = 100;

  /**
   * Add job to queue
   */
  async addJob(type: JobType, payload: any): Promise<string> {
    const jobId = new mongoose.Types.ObjectId().toString();
    const job: Job = {
      id: jobId,
      type,
      payload,
      attempts: 0,
      maxAttempts: this.MAX_ATTEMPTS,
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    logger.info(`Job added to queue: ${type}`, { jobId, payload });

    // Start processing asynchronously - don't wait for it
    if (!this.processing) {
      // Use setTimeout to ensure this runs in the next tick, completely async
      setTimeout(() => this.processJobs(), 0);
    }

    return jobId;
  }

  /**
   * Process jobs in queue
   */
  private async processJobs(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const pendingJobs = Array.from(this.jobs.values())
        .filter(job => !job.processedAt && job.attempts < job.maxAttempts)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      for (const job of pendingJobs) {
        try {
          await this.processJob(job);
          job.processedAt = new Date();
          logger.info(`Job completed: ${job.type}`, { jobId: job.id });
        } catch (error) {
          job.attempts++;
          job.error = error.message;
          
          if (job.attempts >= job.maxAttempts) {
            logger.error(`Job failed after ${job.maxAttempts} attempts: ${job.type}`, {
              jobId: job.id,
              error: error.message,
              payload: job.payload
            });
          } else {
            // Exponential backoff
            const delay = Math.pow(2, job.attempts) * 1000;
            setTimeout(() => {
              if (!this.processing) {
                setImmediate(() => this.processJobs());
              }
            }, delay);
            logger.warn(`Job failed, retrying in ${delay}ms: ${job.type}`, {
              jobId: job.id,
              attempt: job.attempts,
              error: error.message
            });
          }
        }
      }

      // Clean up completed jobs older than 1 hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      for (const [jobId, job] of this.jobs.entries()) {
        if (job.processedAt && job.processedAt < oneHourAgo) {
          this.jobs.delete(jobId);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process individual job
   */
  private async processJob(job: Job): Promise<void> {
    switch (job.type) {
      case JobType.WORKSPACE_MEMBER_CLEANUP:
        await this.processWorkspaceMemberCleanup(job.payload);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  /**
   * Process workspace member cleanup job
   */
  private async processWorkspaceMemberCleanup(payload: {
    workspaceId: string;
    userId: string;
    removedAt: Date;
  }): Promise<void> {
    const { workspaceId, userId, removedAt } = payload;
    
    logger.info('Processing workspace member cleanup', { workspaceId, userId });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Import models to avoid circular dependency
      const { Post } = await import('../models/Post');
      const { WorkspaceMember } = await import('../models/WorkspaceMember');
      
      // Get the member to check if they still exist (might have been fully removed already)
      const member = await WorkspaceMember.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(userId)
      });

      // Process posts in batches of 100
      let processedCount = 0;
      let batch = 0;
      
      if (member) {
        while (true) {
          const posts = await Post.find({
            userId: new mongoose.Types.ObjectId(userId),
            workspaceId: new mongoose.Types.ObjectId(workspaceId)
          })
          .limit(this.BATCH_SIZE)
          .session(session);

          if (posts.length === 0) break;

          // Delete posts in this batch
          const postIds = posts.map(p => p._id);
          await Post.deleteMany({
            _id: { $in: postIds }
          }, { session });

          processedCount += posts.length;
          batch++;
          
          logger.info(`Cleaned up batch ${batch}: ${posts.length} posts`, {
            workspaceId,
            userId,
            totalProcessed: processedCount
          });

          // Small delay between batches to avoid overwhelming the database
          if (posts.length === this.BATCH_SIZE) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Now fully remove the member record
        await WorkspaceMember.findOneAndDelete({
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          userId: new mongoose.Types.ObjectId(userId)
        }, { session });

        logger.info(`Member cleanup completed: ${processedCount} posts deleted`, {
          workspaceId,
          userId,
          batches: batch
        });
      }

      // Import WorkspaceService to avoid circular dependency
      const { workspaceService } = await import('./WorkspaceService');
      
      // Log completion to activity log
      await workspaceService.logActivityPublic({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(userId),
        action: 'MEMBER_REMOVED' as any,
        details: { 
          cleanupCompleted: true,
          removedAt,
          processedAt: new Date(),
          postsDeleted: processedCount || 0
        },
      });

      await session.commitTransaction();
      logger.info('Workspace member cleanup transaction completed', { workspaceId, userId });
    } catch (error) {
      await session.abortTransaction();
      logger.error('Workspace member cleanup failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): Job | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get queue stats
   */
  getStats(): {
    total: number;
    pending: number;
    completed: number;
    failed: number;
  } {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      pending: jobs.filter(j => !j.processedAt && j.attempts < j.maxAttempts).length,
      completed: jobs.filter(j => j.processedAt).length,
      failed: jobs.filter(j => j.attempts >= j.maxAttempts && !j.processedAt).length,
    };
  }
}

export const backgroundJobService = new BackgroundJobService();