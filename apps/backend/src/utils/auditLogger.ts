/**
 * Audit Logger Utility
 * 
 * Lightweight, fail-safe audit logging utility
 * 
 * Features:
 * - Non-blocking (fire-and-forget)
 * - Fail-safe (never throws errors)
 * - Minimal overhead
 * - Automatic IP and user agent extraction
 * - Type-safe
 * 
 * Usage:
 * ```typescript
 * import { logAudit } from '@/utils/auditLogger';
 * 
 * // Basic usage
 * logAudit({
 *   userId: req.user.id,
 *   workspaceId: req.workspace.id,
 *   action: 'post.deleted',
 *   entityType: 'post',
 *   entityId: postId,
 * });
 * 
 * // With request context
 * logAudit({
 *   userId: req.user.id,
 *   workspaceId: req.workspace.id,
 *   action: 'post.deleted',
 *   entityType: 'post',
 *   entityId: postId,
 *   metadata: { postTitle: post.title },
 *   req, // Automatically extracts IP and user agent
 * });
 * ```
 */

import { Request } from 'express';
import mongoose from 'mongoose';
import { logger } from './logger';

/**
 * Audit log data interface
 */
export interface AuditLogData {
  userId: string | mongoose.Types.ObjectId;
  workspaceId: string | mongoose.Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, any>;
  req?: Request;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Extract IP address from Express request
 * 
 * Handles proxies and load balancers
 */
function extractIpAddress(req: Request): string | undefined {
  try {
    // Check X-Forwarded-For header (for proxies/load balancers)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }

    // Check X-Real-IP header (nginx)
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fallback to req.ip
    return req.ip;
  } catch (error) {
    // Fail silently
    return undefined;
  }
}

/**
 * Extract user agent from Express request
 */
function extractUserAgent(req: Request): string | undefined {
  try {
    const userAgent = req.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent[0] : userAgent;
  } catch (error) {
    // Fail silently
    return undefined;
  }
}

/**
 * Log audit entry
 * 
 * Non-blocking, fail-safe audit logging
 * 
 * @param data - Audit log data
 * 
 * Features:
 * - Fire-and-forget (doesn't block execution)
 * - Never throws errors (fail-safe)
 * - Automatically extracts IP and user agent from request
 * - Minimal overhead
 * 
 * @example
 * ```typescript
 * logAudit({
 *   userId: req.user.id,
 *   workspaceId: req.workspace.id,
 *   action: 'post.deleted',
 *   entityType: 'post',
 *   entityId: postId,
 *   metadata: { postTitle: post.title },
 *   req,
 * });
 * ```
 */
export function logAudit(data: AuditLogData): void {
  // Fire-and-forget: Don't await, don't block
  setImmediate(async () => {
    try {
      // Lazy-load AuditLog model to avoid circular dependencies
      const AuditLogModule = await import('../models/AuditLog');
      const AuditLog: any = AuditLogModule.AuditLog;

      // Extract IP and user agent from request if provided
      let ipAddress = data.ipAddress;
      let userAgent = data.userAgent;

      if (data.req) {
        ipAddress = ipAddress || extractIpAddress(data.req);
        userAgent = userAgent || extractUserAgent(data.req);
      }

      // Create audit log entry
      await AuditLog.log({
        userId: data.userId,
        workspaceId: data.workspaceId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata,
        ipAddress,
        userAgent,
      });

      // Debug log (only in development)
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Audit log created', {
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
        });
      }
    } catch (error: any) {
      // FAIL-SAFE: Never throw, just log the error
      logger.error('Failed to create audit log (non-critical)', {
        error: error.message,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
      });
    }
  });
}

/**
 * Batch log audit entries
 * 
 * Non-blocking, fail-safe batch audit logging
 * 
 * @param entries - Array of audit log data
 * 
 * @example
 * ```typescript
 * logAuditBatch([
 *   {
 *     userId: req.user.id,
 *     workspaceId: req.workspace.id,
 *     action: 'post.deleted',
 *     entityType: 'post',
 *     entityId: post1.id,
 *   },
 *   {
 *     userId: req.user.id,
 *     workspaceId: req.workspace.id,
 *     action: 'post.deleted',
 *     entityType: 'post',
 *     entityId: post2.id,
 *   },
 * ]);
 * ```
 */
export function logAuditBatch(entries: AuditLogData[]): void {
  // Fire-and-forget: Don't await, don't block
  setImmediate(async () => {
    try {
      // Lazy-load AuditLog model to avoid circular dependencies
      const AuditLogModule = await import('../models/AuditLog');
      const AuditLog: any = AuditLogModule.AuditLog;

      // Process entries
      const logs = entries.map((entry) => {
        let ipAddress = entry.ipAddress;
        let userAgent = entry.userAgent;

        if (entry.req) {
          ipAddress = ipAddress || extractIpAddress(entry.req);
          userAgent = userAgent || extractUserAgent(entry.req);
        }

        return {
          userId: entry.userId,
          workspaceId: entry.workspaceId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: entry.metadata,
          ipAddress,
          userAgent,
        };
      });

      // Batch insert
      await AuditLog.logBatch(logs);

      // Debug log (only in development)
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Batch audit logs created', {
          count: entries.length,
        });
      }
    } catch (error: any) {
      // FAIL-SAFE: Never throw, just log the error
      logger.error('Failed to create batch audit logs (non-critical)', {
        error: error.message,
        count: entries.length,
      });
    }
  });
}

/**
 * Create audit logger with pre-filled context
 * 
 * Useful for creating a scoped logger with common fields
 * 
 * @param context - Common context to include in all logs
 * 
 * @example
 * ```typescript
 * const auditLogger = createAuditLogger({
 *   userId: req.user.id,
 *   workspaceId: req.workspace.id,
 *   req,
 * });
 * 
 * // Later in the same request
 * auditLogger.log({
 *   action: 'post.deleted',
 *   entityType: 'post',
 *   entityId: postId,
 * });
 * ```
 */
export function createAuditLogger(context: {
  userId: string | mongoose.Types.ObjectId;
  workspaceId: string | mongoose.Types.ObjectId;
  req?: Request;
}) {
  return {
    log: (data: {
      action: string;
      entityType: string;
      entityId?: string;
      metadata?: Record<string, any>;
    }) => {
      logAudit({
        userId: context.userId,
        workspaceId: context.workspaceId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata,
        req: context.req,
      });
    },
  };
}

/**
 * Export action and entity type constants for convenience
 */
export { AuditActions, EntityTypes } from '../models/AuditLog';
