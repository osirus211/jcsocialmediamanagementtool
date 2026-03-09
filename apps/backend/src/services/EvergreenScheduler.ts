/**
 * Evergreen Scheduler
 * 
 * Periodically schedules evergreen rule evaluation jobs
 * 
 * Features:
 * - Polls every 15 minutes
 * - Queries enabled evergreen rules
 * - Respects rule-specific repostInterval
 * - Prevents duplicate jobs per rule
 * - Uses distributed locking for coordination
 * - Tracks metrics
 */

import { EvergreenRule } from '../models/EvergreenRule';
import { EvergreenQueue } from '../queue/EvergreenQueue';
import { logger } from '../utils/logger';
import { getRedisClient } from '../config/redis';

export class EvergreenScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly POLL_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private readonly LOCK_KEY = 'evergreen-scheduler:lock';
  private readonly LOCK_TTL = 120; // 2 minutes

  // Metrics
  private metrics = {
    scheduler_runs_total: 0,
    rules_evaluated_total: 0,
    rules_scheduled_total: 0,
    rules_skipped_total: 0,
  };

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Evergreen scheduler already running');
      return;
    }

    this.isRunning = true;

    logger.info('Evergreen scheduler started', {
      pollInterval: this.POLL_INTERVAL,
    });

    // Immediate execution
    this.poll();

    // Interval execution
    this.intervalId = setInterval(() => {
      this.poll();
    }, this.POLL_INTERVAL);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Evergreen scheduler stopped');
  }

  /**
   * Poll for rules that need evaluation
   */
  private async poll(): Promise<void> {
    this.metrics.scheduler_runs_total++;

    logger.debug('Evergreen scheduler heartbeat');

    // Acquire distributed lock
    const lockAcquired = await this.acquireLock();

    if (!lockAcquired) {
      logger.debug('Could not acquire evergreen scheduler lock, skipping poll');
      return;
    }

    try {
      logger.debug('Evergreen scheduler: evaluating rules');

      // Query all enabled evergreen rules
      const rules = await EvergreenRule.find({ enabled: true }).lean();

      this.metrics.rules_evaluated_total += rules.length;

      if (!rules.length) {
        logger.debug('No enabled evergreen rules found');
        return;
      }

      logger.info('Evergreen scheduler: found enabled rules', {
        count: rules.length,
      });

      const now = Date.now();

      for (const rule of rules) {
        try {
          // Check if rule needs evaluation based on repostInterval
          const shouldEvaluate = this.shouldEvaluateRule(rule, now);

          if (!shouldEvaluate) {
            this.metrics.rules_skipped_total++;
            logger.debug('Evergreen rule interval not elapsed', {
              ruleId: rule._id.toString(),
              repostInterval: rule.repostInterval,
              lastRepostedAt: rule.lastRepostedAt,
              repostCount: rule.repostCount,
              maxReposts: rule.maxReposts,
            });
            continue;
          }

          // Enqueue evaluation job
          await this.enqueueRuleEvaluation(rule);
          this.metrics.rules_scheduled_total++;

        } catch (error: any) {
          logger.error('Failed to schedule evergreen rule evaluation', {
            ruleId: rule._id.toString(),
            error: error.message,
          });
        }
      }

      logger.info('Evergreen scheduler: poll completed', {
        evaluated: rules.length,
        scheduled: this.metrics.rules_scheduled_total,
        skipped: this.metrics.rules_skipped_total,
      });

    } catch (error: any) {
      logger.error('Evergreen scheduler error', {
        error: error.message,
      });
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Check if rule should be evaluated based on repostInterval
   */
  private shouldEvaluateRule(rule: any, now: number): boolean {
    // Check if max reposts reached (unless unlimited)
    if (rule.maxReposts !== -1 && rule.repostCount >= rule.maxReposts) {
      return false;
    }

    // If never reposted, evaluate immediately
    if (!rule.lastRepostedAt) {
      return true;
    }

    // Calculate time since last repost
    const lastRepostedAt = new Date(rule.lastRepostedAt).getTime();
    const repostIntervalMs = rule.repostInterval * 24 * 60 * 60 * 1000; // Convert days to ms
    const timeSinceLastRepost = now - lastRepostedAt;

    // Evaluate if interval has elapsed
    return timeSinceLastRepost >= repostIntervalMs;
  }

  /**
   * Enqueue rule evaluation job
   * Prevents duplicate jobs using Redis lock
   */
  private async enqueueRuleEvaluation(rule: any): Promise<void> {
    const ruleId = rule._id.toString();
    const redis = getRedisClient();
    const lockKey = `evergreen-rule:evaluation:${ruleId}`;

    try {
      // Check if rule is already being evaluated
      const existingLock = await redis.get(lockKey);
      if (existingLock) {
        logger.debug('Evergreen rule already has evaluation lock', {
          ruleId,
        });
        return;
      }

      // Set lock (expires in 30 minutes)
      await redis.setex(lockKey, 30 * 60, Date.now().toString());

      // Enqueue evaluation job
      await EvergreenQueue.addRuleEvaluation({
        ruleId,
        workspaceId: rule.workspaceId.toString(),
        postId: rule.postId.toString(),
      });

      logger.info('Evergreen rule evaluation job enqueued', {
        ruleId,
        workspaceId: rule.workspaceId.toString(),
        postId: rule.postId.toString(),
      });

    } catch (error: any) {
      logger.error('Failed to enqueue evergreen rule evaluation', {
        ruleId,
        error: error.message,
      });

      // Release lock on error
      try {
        await redis.del(lockKey);
      } catch {}

      throw error;
    }
  }

  /**
   * Acquire distributed lock
   */
  private async acquireLock(): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const result = await redis.set(
        this.LOCK_KEY,
        Date.now().toString(),
        'EX',
        this.LOCK_TTL,
        'NX'
      );
      return result === 'OK';
    } catch (error: any) {
      logger.error('Failed to acquire evergreen scheduler lock', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(this.LOCK_KEY);
    } catch (error: any) {
      logger.error('Failed to release evergreen scheduler lock', {
        error: error.message,
      });
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      pollInterval: this.POLL_INTERVAL,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Force immediate poll (for testing/debugging)
   */
  async forcePoll(): Promise<void> {
    await this.poll();
  }
}

export const evergreenScheduler = new EvergreenScheduler();
