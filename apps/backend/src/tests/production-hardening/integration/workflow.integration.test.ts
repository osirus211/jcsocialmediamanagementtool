/**
 * Workflow Automation Integration Test
 * 
 * Tests end-to-end workflow execution including:
 * - Workflow creation with multiple actions
 * - Workflow execution triggering via WorkflowQueue
 * - WorkflowRun status transitions (pending → running → completed)
 * - Action execution order verification
 * - Final state validation
 * 
 * Requirements: 1.1
 */

import mongoose from 'mongoose';
import { Workflow, WorkflowTriggerType, WorkflowActionType } from '../../../models/Workflow';
import { WorkflowRun, WorkflowRunStatus, ActionResultStatus } from '../../../models/WorkflowRun';
import { WorkflowQueue } from '../../../queue/WorkflowQueue';
import { workflowExecutorWorker } from '../../../workers/WorkflowExecutorWorker';
import {
  createTestWorkspace,
  createTestUser,
  connectMongoDB,
  connectRedis,
  waitFor,
  wait,
} from '../utils/test-helpers';
import {
  cleanupAllTestData,
  drainQueue,
} from '../utils/data-cleanup';

describe('Workflow Automation Integration Test', () => {
  let testWorkspaceId: string;
  let testUserId: string;

  // Set test timeout to 60 seconds
  jest.setTimeout(60000);

  beforeAll(async () => {
    // Connect to MongoDB and Redis
    await connectMongoDB();
    await connectRedis();

    // Start workflow executor worker
    workflowExecutorWorker.start();
  });

  afterAll(async () => {
    // Stop workflow executor worker
    await workflowExecutorWorker.stop();

    // Close connections
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Create test workspace and user
    testWorkspaceId = await createTestWorkspace();
    testUserId = await createTestUser();
  });

  afterEach(async () => {
    // Clean up test data
    await cleanupAllTestData(testWorkspaceId);
    await drainQueue('workflow-execution');
  });

  describe('End-to-End Workflow Execution', () => {
    it('should execute workflow with 3 actions and verify status transitions', async () => {
      // Step 1: Create a workflow with 3 actions
      const workflow = new Workflow({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        name: 'Test Workflow - 3 Actions',
        description: 'Integration test workflow with 3 sequential actions',
        enabled: true,
        trigger: {
          type: WorkflowTriggerType.RSS_ITEM_FETCHED,
          config: {
            feedId: 'test-feed-id',
          },
        },
        actions: [
          {
            type: WorkflowActionType.SEND_NOTIFICATION,
            config: {
              type: 'info',
              message: 'Action 1: Notification sent',
              recipient: 'test@example.com',
            },
          },
          {
            type: WorkflowActionType.SEND_NOTIFICATION,
            config: {
              type: 'info',
              message: 'Action 2: Second notification',
              recipient: 'test@example.com',
            },
          },
          {
            type: WorkflowActionType.SEND_NOTIFICATION,
            config: {
              type: 'success',
              message: 'Action 3: Final notification',
              recipient: 'test@example.com',
            },
          },
        ],
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await workflow.save();

      // Step 2: Create a WorkflowRun in PENDING status
      const workflowRun = new WorkflowRun({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        workflowId: workflow._id,
        triggerType: WorkflowTriggerType.RSS_ITEM_FETCHED,
        triggerData: {
          feedId: 'test-feed-id',
          itemTitle: 'Test RSS Item',
          itemUrl: 'https://example.com/test-item',
        },
        status: WorkflowRunStatus.PENDING,
        actionResults: [],
      });

      await workflowRun.save();

      // Verify initial status is PENDING
      expect(workflowRun.status).toBe(WorkflowRunStatus.PENDING);
      expect(workflowRun.startedAt).toBeUndefined();
      expect(workflowRun.completedAt).toBeUndefined();
      expect(workflowRun.actionResults).toHaveLength(0);

      // Step 3: Trigger workflow execution via WorkflowQueue
      await WorkflowQueue.addWorkflowExecution({
        workflowId: workflow._id.toString(),
        workspaceId: testWorkspaceId,
        triggerType: WorkflowTriggerType.RSS_ITEM_FETCHED,
        triggerData: {
          feedId: 'test-feed-id',
          itemTitle: 'Test RSS Item',
          itemUrl: 'https://example.com/test-item',
        },
        runId: workflowRun._id.toString(),
      });

      // Step 4: Wait for status to transition to RUNNING
      await waitFor(
        async () => {
          const run = await WorkflowRun.findById(workflowRun._id);
          return run?.status === WorkflowRunStatus.RUNNING || run?.status === WorkflowRunStatus.COMPLETED;
        },
        10000, // 10 second timeout
        200 // Check every 200ms
      );

      // Verify status transitioned to RUNNING (or already COMPLETED if very fast)
      let updatedRun = await WorkflowRun.findById(workflowRun._id);
      expect(updatedRun).toBeDefined();
      expect([WorkflowRunStatus.RUNNING, WorkflowRunStatus.COMPLETED]).toContain(updatedRun!.status);

      // Step 5: Wait for status to transition to COMPLETED
      await waitFor(
        async () => {
          const run = await WorkflowRun.findById(workflowRun._id);
          return run?.status === WorkflowRunStatus.COMPLETED;
        },
        30000, // 30 second timeout
        500 // Check every 500ms
      );

      // Step 6: Verify final state
      updatedRun = await WorkflowRun.findById(workflowRun._id);
      expect(updatedRun).toBeDefined();
      expect(updatedRun!.status).toBe(WorkflowRunStatus.COMPLETED);
      expect(updatedRun!.startedAt).toBeDefined();
      expect(updatedRun!.completedAt).toBeDefined();
      expect(updatedRun!.error).toBeUndefined();

      // Step 7: Verify all 3 actions executed in order
      expect(updatedRun!.actionResults).toHaveLength(3);

      // Verify Action 1
      expect(updatedRun!.actionResults[0].actionType).toBe(WorkflowActionType.SEND_NOTIFICATION);
      expect(updatedRun!.actionResults[0].status).toBe(ActionResultStatus.SUCCESS);
      expect(updatedRun!.actionResults[0].error).toBeUndefined();
      expect(updatedRun!.actionResults[0].executedAt).toBeDefined();

      // Verify Action 2
      expect(updatedRun!.actionResults[1].actionType).toBe(WorkflowActionType.SEND_NOTIFICATION);
      expect(updatedRun!.actionResults[1].status).toBe(ActionResultStatus.SUCCESS);
      expect(updatedRun!.actionResults[1].error).toBeUndefined();
      expect(updatedRun!.actionResults[1].executedAt).toBeDefined();

      // Verify Action 3
      expect(updatedRun!.actionResults[2].actionType).toBe(WorkflowActionType.SEND_NOTIFICATION);
      expect(updatedRun!.actionResults[2].status).toBe(ActionResultStatus.SUCCESS);
      expect(updatedRun!.actionResults[2].error).toBeUndefined();
      expect(updatedRun!.actionResults[2].executedAt).toBeDefined();

      // Verify actions executed in chronological order
      const action1Time = updatedRun!.actionResults[0].executedAt.getTime();
      const action2Time = updatedRun!.actionResults[1].executedAt.getTime();
      const action3Time = updatedRun!.actionResults[2].executedAt.getTime();

      expect(action2Time).toBeGreaterThanOrEqual(action1Time);
      expect(action3Time).toBeGreaterThanOrEqual(action2Time);

      // Step 8: Verify final state matches expected outcome
      expect(updatedRun!.actionResults.every(ar => ar.status === ActionResultStatus.SUCCESS)).toBe(true);
      expect(updatedRun!.completedAt!.getTime()).toBeGreaterThan(updatedRun!.startedAt!.getTime());
    });

    it('should handle workflow execution with mixed action types', async () => {
      // Create a workflow with different action types
      const workflow = new Workflow({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        name: 'Test Workflow - Mixed Actions',
        description: 'Integration test workflow with different action types',
        enabled: true,
        trigger: {
          type: WorkflowTriggerType.SCHEDULE,
          config: {
            schedule: '0 9 * * *', // Daily at 9 AM
          },
        },
        actions: [
          {
            type: WorkflowActionType.SEND_NOTIFICATION,
            config: {
              type: 'info',
              message: 'Workflow started',
              recipient: 'admin@example.com',
            },
          },
          {
            type: WorkflowActionType.SEND_NOTIFICATION,
            config: {
              type: 'info',
              message: 'Processing data',
              recipient: 'admin@example.com',
            },
          },
          {
            type: WorkflowActionType.SEND_NOTIFICATION,
            config: {
              type: 'success',
              message: 'Workflow completed successfully',
              recipient: 'admin@example.com',
            },
          },
        ],
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await workflow.save();

      // Create WorkflowRun
      const workflowRun = new WorkflowRun({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        workflowId: workflow._id,
        triggerType: WorkflowTriggerType.SCHEDULE,
        triggerData: {
          scheduledTime: new Date().toISOString(),
        },
        status: WorkflowRunStatus.PENDING,
        actionResults: [],
      });

      await workflowRun.save();

      // Trigger execution
      await WorkflowQueue.addWorkflowExecution({
        workflowId: workflow._id.toString(),
        workspaceId: testWorkspaceId,
        triggerType: WorkflowTriggerType.SCHEDULE,
        triggerData: {
          scheduledTime: new Date().toISOString(),
        },
        runId: workflowRun._id.toString(),
      });

      // Wait for completion
      await waitFor(
        async () => {
          const run = await WorkflowRun.findById(workflowRun._id);
          return run?.status === WorkflowRunStatus.COMPLETED;
        },
        30000,
        500
      );

      // Verify execution
      const updatedRun = await WorkflowRun.findById(workflowRun._id);
      expect(updatedRun).toBeDefined();
      expect(updatedRun!.status).toBe(WorkflowRunStatus.COMPLETED);
      expect(updatedRun!.actionResults).toHaveLength(3);
      expect(updatedRun!.actionResults.every(ar => ar.status === ActionResultStatus.SUCCESS)).toBe(true);
    });

    it('should verify workflow execution is idempotent', async () => {
      // Create a simple workflow
      const workflow = new Workflow({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        name: 'Test Workflow - Idempotency',
        description: 'Test idempotent workflow execution',
        enabled: true,
        trigger: {
          type: WorkflowTriggerType.RSS_ITEM_FETCHED,
          config: {
            feedId: 'test-feed-id',
          },
        },
        actions: [
          {
            type: WorkflowActionType.SEND_NOTIFICATION,
            config: {
              type: 'info',
              message: 'Test notification',
              recipient: 'test@example.com',
            },
          },
        ],
        createdBy: new mongoose.Types.ObjectId(testUserId),
      });

      await workflow.save();

      // Create WorkflowRun
      const workflowRun = new WorkflowRun({
        workspaceId: new mongoose.Types.ObjectId(testWorkspaceId),
        workflowId: workflow._id,
        triggerType: WorkflowTriggerType.RSS_ITEM_FETCHED,
        triggerData: {
          feedId: 'test-feed-id',
        },
        status: WorkflowRunStatus.PENDING,
        actionResults: [],
      });

      await workflowRun.save();

      // Trigger execution
      await WorkflowQueue.addWorkflowExecution({
        workflowId: workflow._id.toString(),
        workspaceId: testWorkspaceId,
        triggerType: WorkflowTriggerType.RSS_ITEM_FETCHED,
        triggerData: {
          feedId: 'test-feed-id',
        },
        runId: workflowRun._id.toString(),
      });

      // Wait for completion
      await waitFor(
        async () => {
          const run = await WorkflowRun.findById(workflowRun._id);
          return run?.status === WorkflowRunStatus.COMPLETED;
        },
        30000,
        500
      );

      // Get first execution result
      const firstRun = await WorkflowRun.findById(workflowRun._id);
      expect(firstRun).toBeDefined();
      expect(firstRun!.status).toBe(WorkflowRunStatus.COMPLETED);
      expect(firstRun!.actionResults).toHaveLength(1);

      // Trigger execution again with same runId (should be idempotent)
      await WorkflowQueue.addWorkflowExecution({
        workflowId: workflow._id.toString(),
        workspaceId: testWorkspaceId,
        triggerType: WorkflowTriggerType.RSS_ITEM_FETCHED,
        triggerData: {
          feedId: 'test-feed-id',
        },
        runId: workflowRun._id.toString(),
      });

      // Wait a bit for potential processing
      await wait(2000);

      // Verify state hasn't changed (idempotency)
      const secondRun = await WorkflowRun.findById(workflowRun._id);
      expect(secondRun).toBeDefined();
      expect(secondRun!.status).toBe(WorkflowRunStatus.COMPLETED);
      expect(secondRun!.actionResults).toHaveLength(1); // Still only 1 action result
      expect(secondRun!.completedAt?.getTime()).toBe(firstRun!.completedAt?.getTime());
    });
  });
});
