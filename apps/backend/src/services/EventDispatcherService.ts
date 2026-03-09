/**
 * Event Dispatcher Service
 * 
 * Routes system events to matching workflows and enqueues execution jobs
 * 
 * Features:
 * - Event-to-workflow matching by trigger type
 * - Workspace isolation enforcement
 * - Idempotency protection against duplicate triggers
 * - Metrics tracking for observability
 * - Graceful error handling with DLQ integration
 */

import mongoose from 'mongoose';
import { Workflow, IWorkflow, WorkflowTriggerType } from '../models/Workflow';
import { WorkflowRun, WorkflowRunStatus } from '../models/WorkflowRun';
import { WorkflowQueue } from '../queue/WorkflowQueue';
import { IdempotencyService } from './IdempotencyService';
import { logger } from '../utils/logger';

export interface SystemEvent {
  eventId: string;
  eventType: string;
  workspaceId: string;
  timestamp: Date;
  data: Record<string, any>;
}

export interface TriggerEvaluationResult {
  shouldExecute: boolean;
  reason?: string;
}

export class EventDispatcherService {
  private static idempotencyService = IdempotencyService.getInstance();
  
  // In-memory metrics (will be exposed via MetricsCollector)
  private static metrics = {
    workflow_triggers_total: 0,
    workflow_triggers_matched: 0,
    workflow_triggers_enqueued: 0,
    workflow_triggers_failed: 0,
    workflow_dispatch_latency_sum: 0,
    workflow_dispatch_latency_count: 0,
  };

  /**
   * Handle incoming system event
   * Routes event to matching workflows and enqueues execution jobs
   */
  static async handleEvent(event: SystemEvent): Promise<void> {
    const startTime = Date.now();
    this.metrics.workflow_triggers_total++;

    try {
      logger.info('Event received', {
        eventId: event.eventId,
        eventType: event.eventType,
        workspaceId: event.workspaceId,
      });

      // Prevent duplicate event processing using idempotency
      const idempotencyKey = this.idempotencyService.generateKey(
        'event',
        event.eventId,
        'dispatch',
        event.timestamp
      );

      const alreadyProcessed = await this.idempotencyService.check(idempotencyKey);
      if (alreadyProcessed) {
        logger.info('Event already processed (idempotency)', {
          eventId: event.eventId,
          eventType: event.eventType,
        });
        return;
      }

      // Find matching workflows
      const workflows = await this.matchWorkflows(event.eventType, event.workspaceId);

      if (workflows.length === 0) {
        logger.debug('No workflows matched event', {
          eventId: event.eventId,
          eventType: event.eventType,
          workspaceId: event.workspaceId,
        });
        
        // Mark as processed even if no workflows matched
        await this.idempotencyService.store(idempotencyKey, { processed: true });
        return;
      }

      this.metrics.workflow_triggers_matched += workflows.length;

      logger.info('Workflows matched event', {
        eventId: event.eventId,
        eventType: event.eventType,
        workflowCount: workflows.length,
        workflowIds: workflows.map(w => w._id.toString()),
      });

      // Evaluate trigger conditions and enqueue matching workflows
      const enqueuePromises = workflows.map(workflow =>
        this.evaluateAndEnqueue(workflow, event)
      );

      await Promise.allSettled(enqueuePromises);

      // Mark event as processed
      await this.idempotencyService.store(idempotencyKey, { 
        processed: true,
        workflowsMatched: workflows.length,
      });

      // Track dispatch latency
      const latency = Date.now() - startTime;
      this.metrics.workflow_dispatch_latency_sum += latency;
      this.metrics.workflow_dispatch_latency_count++;

      logger.info('Event dispatched successfully', {
        eventId: event.eventId,
        eventType: event.eventType,
        workflowsMatched: workflows.length,
        latencyMs: latency,
      });

    } catch (error: any) {
      this.metrics.workflow_triggers_failed++;
      
      logger.error('Event dispatch failed', {
        eventId: event.eventId,
        eventType: event.eventType,
        workspaceId: event.workspaceId,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Find workflows matching event type and workspace
   * Only returns enabled workflows
   */
  static async matchWorkflows(eventType: string, workspaceId: string): Promise<IWorkflow[]> {
    try {
      // Map event types to workflow trigger types
      const triggerType = this.mapEventTypeToTriggerType(eventType);
      
      if (!triggerType) {
        logger.debug('Event type not mapped to trigger type', { eventType });
        return [];
      }

      // Query enabled workflows with matching trigger type
      const workflows = await Workflow.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        'trigger.type': triggerType,
        enabled: true,
      }).lean();

      return workflows as any;
    } catch (error: any) {
      logger.error('Workflow matching failed', {
        eventType,
        workspaceId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Evaluate trigger conditions and enqueue workflow if conditions met
   */
  static async evaluateAndEnqueue(workflow: IWorkflow, event: SystemEvent): Promise<void> {
    try {
      // Evaluate trigger conditions
      const evaluation = this.evaluateTriggerConditions(workflow, event);

      if (!evaluation.shouldExecute) {
        logger.debug('Workflow trigger conditions not met', {
          workflowId: workflow._id.toString(),
          eventId: event.eventId,
          reason: evaluation.reason,
        });
        return;
      }

      // Enqueue workflow execution
      await this.enqueueWorkflowExecution(workflow, event);

    } catch (error: any) {
      logger.error('Workflow evaluation and enqueue failed', {
        workflowId: workflow._id.toString(),
        eventId: event.eventId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Evaluate trigger conditions (filters, thresholds, etc.)
   */
  static evaluateTriggerConditions(
    workflow: IWorkflow,
    event: SystemEvent
  ): TriggerEvaluationResult {
    const triggerConfig = workflow.trigger.config;

    try {
      switch (workflow.trigger.type) {
        case WorkflowTriggerType.POST_PUBLISHED:
          return this.evaluatePostPublishedTrigger(triggerConfig, event.data);

        case WorkflowTriggerType.ANALYTICS_THRESHOLD:
          return this.evaluateAnalyticsThresholdTrigger(triggerConfig, event.data);

        case WorkflowTriggerType.MENTION_DETECTED:
          return this.evaluateMentionDetectedTrigger(triggerConfig, event.data);

        case WorkflowTriggerType.RSS_ITEM_FETCHED:
          return this.evaluateRSSItemFetchedTrigger(triggerConfig, event.data);

        case WorkflowTriggerType.SCHEDULE:
          // Schedule triggers are handled separately by cron scheduler
          return { shouldExecute: true };

        default:
          logger.warn('Unknown trigger type', {
            triggerType: workflow.trigger.type,
            workflowId: workflow._id.toString(),
          });
          return { shouldExecute: false, reason: 'Unknown trigger type' };
      }
    } catch (error: any) {
      logger.error('Trigger condition evaluation failed', {
        workflowId: workflow._id.toString(),
        triggerType: workflow.trigger.type,
        error: error.message,
      });
      return { shouldExecute: false, reason: `Evaluation error: ${error.message}` };
    }
  }

  /**
   * Evaluate post published trigger conditions
   */
  private static evaluatePostPublishedTrigger(
    config: Record<string, any>,
    eventData: Record<string, any>
  ): TriggerEvaluationResult {
    // Platform filter
    if (config.platform && eventData.platform !== config.platform) {
      return { shouldExecute: false, reason: 'Platform filter not matched' };
    }

    // Social account filter
    if (config.socialAccountId && eventData.socialAccountId !== config.socialAccountId) {
      return { shouldExecute: false, reason: 'Social account filter not matched' };
    }

    // Content pattern filter (simple substring match)
    if (config.contentPattern && eventData.content) {
      const pattern = new RegExp(config.contentPattern, 'i');
      if (!pattern.test(eventData.content)) {
        return { shouldExecute: false, reason: 'Content pattern not matched' };
      }
    }

    return { shouldExecute: true };
  }

  /**
   * Evaluate analytics threshold trigger conditions
   */
  private static evaluateAnalyticsThresholdTrigger(
    config: Record<string, any>,
    eventData: Record<string, any>
  ): TriggerEvaluationResult {
    const metric = config.metric;
    const operator = config.operator;
    const threshold = config.threshold;
    const currentValue = eventData.currentValue;

    if (currentValue === undefined) {
      return { shouldExecute: false, reason: 'Current value not provided' };
    }

    // Evaluate threshold condition
    let conditionMet = false;
    switch (operator) {
      case 'gt':
        conditionMet = currentValue > threshold;
        break;
      case 'gte':
        conditionMet = currentValue >= threshold;
        break;
      case 'lt':
        conditionMet = currentValue < threshold;
        break;
      case 'lte':
        conditionMet = currentValue <= threshold;
        break;
      case 'eq':
        conditionMet = currentValue === threshold;
        break;
      default:
        return { shouldExecute: false, reason: `Unknown operator: ${operator}` };
    }

    if (!conditionMet) {
      return { 
        shouldExecute: false, 
        reason: `Threshold not met: ${currentValue} ${operator} ${threshold}` 
      };
    }

    return { shouldExecute: true };
  }

  /**
   * Evaluate mention detected trigger conditions
   */
  private static evaluateMentionDetectedTrigger(
    config: Record<string, any>,
    eventData: Record<string, any>
  ): TriggerEvaluationResult {
    // Platform filter
    if (config.platform && eventData.platform !== config.platform) {
      return { shouldExecute: false, reason: 'Platform filter not matched' };
    }

    // Sentiment filter
    if (config.sentiment && eventData.sentiment !== config.sentiment) {
      return { shouldExecute: false, reason: 'Sentiment filter not matched' };
    }

    // Keyword filter
    if (config.keywords && Array.isArray(config.keywords) && eventData.content) {
      const hasKeyword = config.keywords.some((keyword: string) =>
        eventData.content.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        return { shouldExecute: false, reason: 'Keyword filter not matched' };
      }
    }

    return { shouldExecute: true };
  }

  /**
   * Evaluate RSS item fetched trigger conditions
   */
  private static evaluateRSSItemFetchedTrigger(
    config: Record<string, any>,
    eventData: Record<string, any>
  ): TriggerEvaluationResult {
    // Feed ID filter
    if (config.feedId && eventData.feedId !== config.feedId) {
      return { shouldExecute: false, reason: 'Feed ID filter not matched' };
    }

    // Category filter
    if (config.categories && Array.isArray(config.categories) && eventData.categories) {
      const hasCategory = config.categories.some((category: string) =>
        eventData.categories.includes(category)
      );
      if (!hasCategory) {
        return { shouldExecute: false, reason: 'Category filter not matched' };
      }
    }

    return { shouldExecute: true };
  }

  /**
   * Enqueue workflow execution job
   */
  static async enqueueWorkflowExecution(
    workflow: IWorkflow,
    event: SystemEvent
  ): Promise<void> {
    try {
      // Create workflow run record
      const workflowRun = new WorkflowRun({
        workspaceId: workflow.workspaceId,
        workflowId: workflow._id,
        triggerType: workflow.trigger.type,
        triggerData: event.data,
        status: WorkflowRunStatus.PENDING,
      });

      await workflowRun.save();

      // Enqueue execution job
      await WorkflowQueue.addWorkflowExecution({
        workflowId: workflow._id.toString(),
        workspaceId: workflow.workspaceId.toString(),
        triggerType: workflow.trigger.type,
        triggerData: event.data,
        runId: workflowRun._id.toString(),
      });

      this.metrics.workflow_triggers_enqueued++;

      logger.info('Workflow execution enqueued', {
        workflowId: workflow._id.toString(),
        runId: workflowRun._id.toString(),
        eventId: event.eventId,
        triggerType: workflow.trigger.type,
      });

    } catch (error: any) {
      logger.error('Workflow execution enqueue failed', {
        workflowId: workflow._id.toString(),
        eventId: event.eventId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Map event type to workflow trigger type
   */
  private static mapEventTypeToTriggerType(eventType: string): WorkflowTriggerType | null {
    const mapping: Record<string, WorkflowTriggerType> = {
      'post.published': WorkflowTriggerType.POST_PUBLISHED,
      'post.analytics.updated': WorkflowTriggerType.ANALYTICS_THRESHOLD,
      'mention.detected': WorkflowTriggerType.MENTION_DETECTED,
      'rss.item.fetched': WorkflowTriggerType.RSS_ITEM_FETCHED,
    };

    return mapping[eventType] || null;
  }

  /**
   * Get metrics for observability
   */
  static getMetrics() {
    const avgLatency = this.metrics.workflow_dispatch_latency_count > 0
      ? this.metrics.workflow_dispatch_latency_sum / this.metrics.workflow_dispatch_latency_count
      : 0;

    return {
      workflow_triggers_total: this.metrics.workflow_triggers_total,
      workflow_triggers_matched: this.metrics.workflow_triggers_matched,
      workflow_triggers_enqueued: this.metrics.workflow_triggers_enqueued,
      workflow_triggers_failed: this.metrics.workflow_triggers_failed,
      workflow_dispatch_latency_avg_ms: Math.round(avgLatency),
    };
  }

  /**
   * Reset metrics (for testing)
   */
  static resetMetrics(): void {
    this.metrics = {
      workflow_triggers_total: 0,
      workflow_triggers_matched: 0,
      workflow_triggers_enqueued: 0,
      workflow_triggers_failed: 0,
      workflow_dispatch_latency_sum: 0,
      workflow_dispatch_latency_count: 0,
    };
  }
}
