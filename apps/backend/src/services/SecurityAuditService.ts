import { SecurityEvent, SecurityEventType, SecurityEventSeverity, ISecurityEvent } from '../models/SecurityEvent';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import mongoose from 'mongoose';

/**
 * Security Audit Service
 * 
 * FOUNDATION LAYER for security event logging
 * 
 * Provides:
 * - Centralized security event logging
 * - IP address hashing for privacy
 * - Automatic severity classification
 * - Query interface for security analysis
 * - Retention policy enforcement
 * 
 * Features:
 * - All security events logged to MongoDB
 * - IP addresses hashed with SHA-256
 * - Automatic TTL-based cleanup (365 days)
 * - Efficient querying with compound indexes
 */

export interface SecurityEventInput {
  type: SecurityEventType;
  userId?: mongoose.Types.ObjectId | string;
  workspaceId?: mongoose.Types.ObjectId | string;
  ipAddress: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface SecurityEventQuery {
  userId?: mongoose.Types.ObjectId | string;
  workspaceId?: mongoose.Types.ObjectId | string;
  type?: SecurityEventType;
  severity?: SecurityEventSeverity;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export class SecurityAuditService {
  private readonly RETENTION_DAYS = 365;

  /**
   * Hash IP address for privacy
   * 
   * Uses SHA-256 to hash IP addresses before storage
   * Allows correlation without storing plaintext IPs
   */
  private hashIpAddress(ipAddress: string): string {
    return crypto
      .createHash('sha256')
      .update(ipAddress)
      .digest('hex');
  }

  /**
   * Determine severity based on event type
   */
  private determineSeverity(type: SecurityEventType, success: boolean): SecurityEventSeverity {
    // Critical events
    if ([
      SecurityEventType.TOKEN_CORRUPTION_DETECTED,
      SecurityEventType.IP_BLOCKED,
      SecurityEventType.USER_SUSPENDED,
      SecurityEventType.WORKSPACE_DELETED,
      SecurityEventType.API_KEY_SUSPICIOUS_ACTIVITY,
    ].includes(type)) {
      return SecurityEventSeverity.CRITICAL;
    }

    // Error events
    if (!success && [
      SecurityEventType.LOGIN_FAILURE,
      SecurityEventType.TOKEN_REFRESH_FAILURE,
      SecurityEventType.OAUTH_CONNECT_FAILURE,
      SecurityEventType.PERMISSION_DENIED,
      SecurityEventType.API_KEY_AUTH_FAILURE,
      SecurityEventType.API_KEY_SCOPE_DENIED,
    ].includes(type)) {
      return SecurityEventSeverity.ERROR;
    }

    // Warning events
    if ([
      SecurityEventType.RATE_LIMIT_WARNING,
      SecurityEventType.RATE_LIMIT_EXCEEDED,
      SecurityEventType.IP_THROTTLED,
      SecurityEventType.CONCURRENT_REFRESH_BLOCKED,
      SecurityEventType.OAUTH_TOKEN_EXPIRED,
      SecurityEventType.API_KEY_NEW_IP_DETECTED,
    ].includes(type)) {
      return SecurityEventSeverity.WARNING;
    }

    // Info events (default)
    return SecurityEventSeverity.INFO;
  }

  /**
   * Log security event
   * 
   * Creates a security event record with automatic severity classification
   * and IP address hashing
   */
  async logEvent(input: SecurityEventInput): Promise<ISecurityEvent | null> {
    try {
      const severity = this.determineSeverity(input.type, input.success);
      const hashedIp = this.hashIpAddress(input.ipAddress);

      const event = await SecurityEvent.create({
        type: input.type,
        severity,
        userId: input.userId,
        workspaceId: input.workspaceId,
        ipAddress: hashedIp,
        userAgent: input.userAgent,
        resource: input.resource,
        action: input.action,
        success: input.success,
        errorMessage: input.errorMessage,
        metadata: input.metadata,
        timestamp: new Date(),
      });

      logger.debug('Security event logged', {
        eventId: event._id,
        type: input.type,
        severity,
        success: input.success,
      });

      return event;
    } catch (error: any) {
      logger.error('Failed to log security event', {
        type: input.type,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Query security events
   * 
   * Provides flexible querying for security analysis
   */
  async queryEvents(query: SecurityEventQuery): Promise<ISecurityEvent[]> {
    try {
      const filter: any = {};

      if (query.userId) {
        filter.userId = query.userId;
      }

      if (query.workspaceId) {
        filter.workspaceId = query.workspaceId;
      }

      if (query.type) {
        filter.type = query.type;
      }

      if (query.severity) {
        filter.severity = query.severity;
      }

      if (query.success !== undefined) {
        filter.success = query.success;
      }

      if (query.startDate || query.endDate) {
        filter.timestamp = {};
        if (query.startDate) {
          filter.timestamp.$gte = query.startDate;
        }
        if (query.endDate) {
          filter.timestamp.$lte = query.endDate;
        }
      }

      const limit = query.limit || 100;

      const events = await SecurityEvent
        .find(filter)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return events as ISecurityEvent[];
    } catch (error: any) {
      logger.error('Failed to query security events', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get failed login attempts for user
   * 
   * Used for account lockout detection
   */
  async getFailedLoginAttempts(
    userId: mongoose.Types.ObjectId | string,
    since: Date
  ): Promise<number> {
    try {
      const count = await SecurityEvent.countDocuments({
        userId,
        type: SecurityEventType.LOGIN_FAILURE,
        success: false,
        timestamp: { $gte: since },
      });

      return count;
    } catch (error: any) {
      logger.error('Failed to get failed login attempts', {
        userId,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Get failed login attempts for IP
   * 
   * Used for IP-based throttling
   */
  async getFailedLoginAttemptsForIp(
    ipAddress: string,
    since: Date
  ): Promise<number> {
    try {
      const hashedIp = this.hashIpAddress(ipAddress);

      const count = await SecurityEvent.countDocuments({
        ipAddress: hashedIp,
        type: SecurityEventType.LOGIN_FAILURE,
        success: false,
        timestamp: { $gte: since },
      });

      return count;
    } catch (error: any) {
      logger.error('Failed to get failed login attempts for IP', {
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Get security event statistics
   * 
   * Provides aggregated metrics for monitoring
   */
  async getStatistics(
    workspaceId?: mongoose.Types.ObjectId | string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalEvents: number;
    eventsBySeverity: Record<SecurityEventSeverity, number>;
    eventsByType: Record<string, number>;
    successRate: number;
  }> {
    try {
      const filter: any = {};

      if (workspaceId) {
        filter.workspaceId = workspaceId;
      }

      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) {
          filter.timestamp.$gte = startDate;
        }
        if (endDate) {
          filter.timestamp.$lte = endDate;
        }
      }

      const [totalEvents, successCount, severityStats, typeStats] = await Promise.all([
        SecurityEvent.countDocuments(filter),
        SecurityEvent.countDocuments({ ...filter, success: true }),
        SecurityEvent.aggregate([
          { $match: filter },
          { $group: { _id: '$severity', count: { $sum: 1 } } },
        ]),
        SecurityEvent.aggregate([
          { $match: filter },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ]),
      ]);

      const eventsBySeverity: Record<SecurityEventSeverity, number> = {
        [SecurityEventSeverity.INFO]: 0,
        [SecurityEventSeverity.WARNING]: 0,
        [SecurityEventSeverity.ERROR]: 0,
        [SecurityEventSeverity.CRITICAL]: 0,
      };

      severityStats.forEach((stat: any) => {
        eventsBySeverity[stat._id as SecurityEventSeverity] = stat.count;
      });

      const eventsByType: Record<string, number> = {};
      typeStats.forEach((stat: any) => {
        eventsByType[stat._id] = stat.count;
      });

      const successRate = totalEvents > 0 ? (successCount / totalEvents) * 100 : 0;

      return {
        totalEvents,
        eventsBySeverity,
        eventsByType,
        successRate,
      };
    } catch (error: any) {
      logger.error('Failed to get security statistics', {
        error: error.message,
      });
      return {
        totalEvents: 0,
        eventsBySeverity: {
          [SecurityEventSeverity.INFO]: 0,
          [SecurityEventSeverity.WARNING]: 0,
          [SecurityEventSeverity.ERROR]: 0,
          [SecurityEventSeverity.CRITICAL]: 0,
        },
        eventsByType: {},
        successRate: 0,
      };
    }
  }

  /**
   * Clean up old events (manual trigger)
   * 
   * Note: Automatic cleanup is handled by MongoDB TTL index
   * This method is for manual cleanup if needed
   */
  async cleanupOldEvents(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

      const result = await SecurityEvent.deleteMany({
        timestamp: { $lt: cutoffDate },
      });

      logger.info('Old security events cleaned up', {
        deletedCount: result.deletedCount,
        cutoffDate,
      });

      return result.deletedCount || 0;
    } catch (error: any) {
      logger.error('Failed to cleanup old security events', {
        error: error.message,
      });
      return 0;
    }
  }
}

export const securityAuditService = new SecurityAuditService();
