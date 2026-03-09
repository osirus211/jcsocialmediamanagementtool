/**
 * Data Cleanup Utilities
 * 
 * Provides functions to clean up test data from MongoDB collections
 * and Redis queues after test execution.
 */

import mongoose from 'mongoose';
import { QueueManager } from '../../../queue/QueueManager';
import { WorkflowRun } from '../../../models/WorkflowRun';
import { RSSFeedItem } from '../../../models/RSSFeedItem';
import { RSSFeed } from '../../../models/RSSFeed';
import { Post } from '../../../models/Post';
import { Workflow } from '../../../models/Workflow';
import { EvergreenRule } from '../../../models/EvergreenRule';
import { Mention } from '../../../models/Mention';
import { Workspace } from '../../../models/Workspace';
import { User } from '../../../models/User';

/**
 * Clean up WorkflowRun documents for a workspace
 */
export async function cleanupWorkflowRuns(workspaceId: string): Promise<number> {
  try {
    const result = await WorkflowRun.deleteMany({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    return result.deletedCount || 0;
  } catch (error) {
    console.error('Error cleaning up WorkflowRuns:', error);
    return 0;
  }
}

/**
 * Clean up RSSFeedItem documents for a workspace
 */
export async function cleanupRSSFeedItems(workspaceId: string): Promise<number> {
  try {
    const result = await RSSFeedItem.deleteMany({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    return result.deletedCount || 0;
  } catch (error) {
    console.error('Error cleaning up RSSFeedItems:', error);
    return 0;
  }
}

/**
 * Clean up RSSFeed documents for a workspace
 */
export async function cleanupRSSFeeds(workspaceId: string): Promise<number> {
  try {
    const result = await RSSFeed.deleteMany({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    return result.deletedCount || 0;
  } catch (error) {
    console.error('Error cleaning up RSSFeeds:', error);
    return 0;
  }
}

/**
 * Clean up Post documents for a workspace
 */
export async function cleanupPosts(workspaceId: string): Promise<number> {
  try {
    const result = await Post.deleteMany({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    return result.deletedCount || 0;
  } catch (error) {
    console.error('Error cleaning up Posts:', error);
    return 0;
  }
}

/**
 * Clean up Workflow documents for a workspace
 */
export async function cleanupWorkflows(workspaceId: string): Promise<number> {
  try {
    const result = await Workflow.deleteMany({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    return result.deletedCount || 0;
  } catch (error) {
    console.error('Error cleaning up Workflows:', error);
    return 0;
  }
}

/**
 * Clean up EvergreenRule documents for a workspace
 */
export async function cleanupEvergreenRules(workspaceId: string): Promise<number> {
  try {
    const result = await EvergreenRule.deleteMany({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    return result.deletedCount || 0;
  } catch (error) {
    console.error('Error cleaning up EvergreenRules:', error);
    return 0;
  }
}

/**
 * Clean up Mention documents for a workspace
 */
export async function cleanupMentions(workspaceId: string): Promise<number> {
  try {
    const result = await Mention.deleteMany({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });
    return result.deletedCount || 0;
  } catch (error) {
    console.error('Error cleaning up Mentions:', error);
    return 0;
  }
}

/**
 * Clean up test workspace
 */
export async function cleanupWorkspace(workspaceId: string): Promise<void> {
  try {
    await Workspace.deleteOne({ _id: new mongoose.Types.ObjectId(workspaceId) });
  } catch (error) {
    console.error('Error cleaning up Workspace:', error);
  }
}

/**
 * Clean up test user
 */
export async function cleanupUser(userId: string): Promise<void> {
  try {
    await User.deleteOne({ _id: new mongoose.Types.ObjectId(userId) });
  } catch (error) {
    console.error('Error cleaning up User:', error);
  }
}

/**
 * Drain a BullMQ queue (remove all jobs)
 */
export async function drainQueue(queueName: string): Promise<number> {
  try {
    const queueManager = QueueManager.getInstance();
    
    if (!queueManager.hasQueue(queueName)) {
      return 0;
    }

    const queue = queueManager.getQueue(queueName);
    
    // Get all job counts
    const [waiting, active, delayed, failed, completed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
      queue.getFailedCount(),
      queue.getCompletedCount(),
    ]);

    const totalJobs = waiting + active + delayed + failed + completed;

    // Clean all job types
    await Promise.all([
      queue.drain(),
      queue.clean(0, 1000, 'completed'),
      queue.clean(0, 1000, 'failed'),
    ]);

    return totalJobs;
  } catch (error) {
    console.error(`Error draining queue ${queueName}:`, error);
    return 0;
  }
}

/**
 * Drain all test queues
 */
export async function drainAllQueues(): Promise<void> {
  const queues = [
    'workflow-queue',
    'rss-queue',
    'evergreen-queue',
    'ai-processing-queue',
    'social-listening-queue',
    'posting-queue',
  ];

  await Promise.all(queues.map(queueName => drainQueue(queueName)));
}

/**
 * Clean up all test data for a workspace
 */
export async function cleanupAllTestData(workspaceId: string): Promise<void> {
  try {
    await Promise.all([
      cleanupWorkflowRuns(workspaceId),
      cleanupRSSFeedItems(workspaceId),
      cleanupRSSFeeds(workspaceId),
      cleanupPosts(workspaceId),
      cleanupWorkflows(workspaceId),
      cleanupEvergreenRules(workspaceId),
      cleanupMentions(workspaceId),
    ]);

    await cleanupWorkspace(workspaceId);
  } catch (error) {
    console.error('Error cleaning up all test data:', error);
  }
}

/**
 * Clean up all test data and queues
 */
export async function cleanupEverything(workspaceId: string): Promise<void> {
  await Promise.all([
    cleanupAllTestData(workspaceId),
    drainAllQueues(),
  ]);
}

/**
 * Get cleanup statistics
 */
export interface CleanupStats {
  workflowRuns: number;
  rssFeedItems: number;
  rssFeeds: number;
  posts: number;
  workflows: number;
  evergreenRules: number;
  mentions: number;
  totalDocuments: number;
}

/**
 * Clean up with statistics
 */
export async function cleanupWithStats(workspaceId: string): Promise<CleanupStats> {
  const [
    workflowRuns,
    rssFeedItems,
    rssFeeds,
    posts,
    workflows,
    evergreenRules,
    mentions,
  ] = await Promise.all([
    cleanupWorkflowRuns(workspaceId),
    cleanupRSSFeedItems(workspaceId),
    cleanupRSSFeeds(workspaceId),
    cleanupPosts(workspaceId),
    cleanupWorkflows(workspaceId),
    cleanupEvergreenRules(workspaceId),
    cleanupMentions(workspaceId),
  ]);

  await cleanupWorkspace(workspaceId);

  const totalDocuments = workflowRuns + rssFeedItems + rssFeeds + posts + workflows + evergreenRules + mentions;

  return {
    workflowRuns,
    rssFeedItems,
    rssFeeds,
    posts,
    workflows,
    evergreenRules,
    mentions,
    totalDocuments,
  };
}
