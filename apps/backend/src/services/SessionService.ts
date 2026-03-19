/**
 * Session Service
 * 
 * Handles session invalidation and management
 */

import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

export class SessionService {
  /**
   * Invalidate all workspace sessions for a user
   */
  static async invalidateWorkspaceSessions(
    userId: string,
    workspaceId: string
  ): Promise<void> {
    try {
      const redisClient = getRedisClient();
      
      // Pattern to match workspace-specific session keys
      const pattern = `session:${userId}:workspace:${workspaceId}:*`;
      
      // Get all matching keys
      const keys = await redisClient.keys(pattern);
      
      if (keys.length > 0) {
        // Delete all matching session keys
        await redisClient.del(...keys);
        logger.info(`Invalidated ${keys.length} workspace sessions for user ${userId} in workspace ${workspaceId}`);
      }

      // Also invalidate general user sessions that might have workspace context
      const userSessionPattern = `session:${userId}:*`;
      const userKeys = await redisClient.keys(userSessionPattern);
      
      for (const key of userKeys) {
        const sessionData = await redisClient.get(key);
        if (sessionData) {
          try {
            const parsed = JSON.parse(sessionData);
            if (parsed.workspaceId === workspaceId) {
              await redisClient.del(key);
              logger.info(`Invalidated user session ${key} with workspace context`);
            }
          } catch (error) {
            // Skip if not JSON
          }
        }
      }
    } catch (error) {
      logger.error('Failed to invalidate workspace sessions:', error);
      // Don't throw - session invalidation failure shouldn't block member removal
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  static async invalidateAllUserSessions(userId: string): Promise<void> {
    try {
      const redisClient = getRedisClient();
      const pattern = `session:${userId}:*`;
      const keys = await redisClient.keys(pattern);
      
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.info(`Invalidated ${keys.length} sessions for user ${userId}`);
      }
    } catch (error) {
      logger.error('Failed to invalidate user sessions:', error);
    }
  }
}
