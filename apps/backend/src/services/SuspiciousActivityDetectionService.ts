/**
 * Suspicious Activity Detection Service
 * 
 * Detects and alerts on suspicious OAuth behavior:
 * - Multiple failures from same IP
 * - Replay attack patterns
 * - Brute force attempts
 */

import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { OAuthFailureLog, OAuthErrorType } from '../models/OAuthFailureLog';

const FAILURE_THRESHOLD = 5; // failures
const FAILURE_WINDOW_MINUTES = 10; // minutes
const FAILURE_TTL_SECONDS = 600; // 10 minutes

export class SuspiciousActivityDetectionService {
  private readonly keyPrefix = 'oauth:failures';

  constructor(private redis: Redis) {}

  /**
   * Track OAuth failure and check for suspicious activity
   * 
   * @param ip - Client IP address
   * @param provider - OAuth provider
   * @param errorType - Type of OAuth error
   * @param userAgent - Client User-Agent
   * @param workspaceId - Optional workspace ID
   * @param state - Optional OAuth state
   * @param metadata - Optional additional metadata
   * @returns true if suspicious activity detected
   */
  async trackFailure(
    ip: string,
    provider: string,
    errorType: OAuthErrorType,
    userAgent: string,
    workspaceId?: string,
    state?: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      // Log failure to MongoDB
      await OAuthFailureLog.logFailure({
        provider,
        ip,
        userAgent,
        errorType,
        workspaceId,
        state,
        metadata,
      });

      // Track failure count in Redis
      const key = this.getKey(ip);
      const count = await this.redis.incr(key);

      // Set TTL on first failure
      if (count === 1) {
        await this.redis.expire(key, FAILURE_TTL_SECONDS);
      }

      // Check if threshold exceeded
      if (count >= FAILURE_THRESHOLD) {
        logger.error('Suspicious OAuth activity detected', {
          ip,
          provider,
          errorType,
          failureCount: count,
          threshold: FAILURE_THRESHOLD,
          windowMinutes: FAILURE_WINDOW_MINUTES,
          alert: 'SUSPICIOUS_OAUTH_ACTIVITY',
          severity: 'HIGH',
        });

        // Get recent failures for context
        const recentFailures = await OAuthFailureLog.getRecentFailures(
          ip,
          FAILURE_WINDOW_MINUTES
        );

        logger.error('Recent OAuth failures from IP', {
          ip,
          failureCount: recentFailures.length,
          failures: recentFailures.map((f) => ({
            provider: f.provider,
            errorType: f.errorType,
            timestamp: f.timestamp,
          })),
        });

        return true; // Suspicious activity detected
      }

      logger.debug('OAuth failure tracked', {
        ip,
        provider,
        errorType,
        failureCount: count,
        threshold: FAILURE_THRESHOLD,
      });

      return false; // No suspicious activity
    } catch (error: any) {
      logger.error('Failed to track OAuth failure', {
        ip,
        provider,
        errorType,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get failure count for IP
   * 
   * @param ip - Client IP address
   * @returns Failure count in current window
   */
  async getFailureCount(ip: string): Promise<number> {
    try {
      const key = this.getKey(ip);
      const count = await this.redis.get(key);
      return count ? parseInt(count) : 0;
    } catch (error: any) {
      logger.error('Failed to get failure count', {
        ip,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Check if IP is currently flagged as suspicious
   * 
   * @param ip - Client IP address
   * @returns true if IP has exceeded failure threshold
   */
  async isSuspicious(ip: string): Promise<boolean> {
    const count = await this.getFailureCount(ip);
    return count >= FAILURE_THRESHOLD;
  }

  /**
   * Clear failure count for IP (for testing or manual reset)
   * 
   * @param ip - Client IP address
   */
  async clearFailures(ip: string): Promise<void> {
    try {
      const key = this.getKey(ip);
      await this.redis.del(key);

      logger.info('OAuth failure count cleared', { ip });
    } catch (error: any) {
      logger.error('Failed to clear failure count', {
        ip,
        error: error.message,
      });
    }
  }

  /**
   * Get Redis key for failure tracking
   */
  private getKey(ip: string): string {
    return `${this.keyPrefix}:${ip}`;
  }

  /**
   * Get suspicious activity summary for monitoring
   */
  async getSuspiciousActivitySummary(): Promise<{
    suspiciousIPs: string[];
    totalSuspiciousIPs: number;
  }> {
    try {
      const pattern = `${this.keyPrefix}:*`;
      const keys = await this.redis.keys(pattern);

      const suspiciousIPs: string[] = [];

      for (const key of keys) {
        const count = await this.redis.get(key);
        if (count && parseInt(count) >= FAILURE_THRESHOLD) {
          const ip = key.replace(`${this.keyPrefix}:`, '');
          suspiciousIPs.push(ip);
        }
      }

      return {
        suspiciousIPs,
        totalSuspiciousIPs: suspiciousIPs.length,
      };
    } catch (error: any) {
      logger.error('Failed to get suspicious activity summary', {
        error: error.message,
      });
      return {
        suspiciousIPs: [],
        totalSuspiciousIPs: 0,
      };
    }
  }
}
