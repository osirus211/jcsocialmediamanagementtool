/**
 * API Key Controller
 * 
 * Handles API key management operations for workspace owners/admins
 */

import { Request, Response, NextFunction } from 'express';
import { apiKeyService } from '../services/ApiKeyService';
import { BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import { WorkspaceActivityLog, ActivityAction } from '../models/WorkspaceActivityLog';
import mongoose from 'mongoose';

export class ApiKeyController {
  /**
   * POST /api/v1/api-keys
   * Create a new API key
   */
  static async createApiKey(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, scopes, rateLimit, expiresAt, allowedIps } = req.body;
      const workspaceId = req.workspace!.workspaceId.toString();
      const createdBy = req.user!.userId;

      // Validate required fields
      if (!name || !scopes) {
        throw new BadRequestError('Name and scopes are required');
      }

      // Validate scopes
      if (!Array.isArray(scopes) || scopes.length === 0) {
        throw new BadRequestError('At least one scope is required');
      }

      // Validate rate limit if provided
      if (rateLimit) {
        if (!rateLimit.maxRequests || !rateLimit.windowMs) {
          throw new BadRequestError('Rate limit must include maxRequests and windowMs');
        }
        if (rateLimit.maxRequests < 100 || rateLimit.maxRequests > 10000) {
          throw new BadRequestError('Rate limit must be between 100 and 10000 requests');
        }
      }

      // Validate expiration if provided
      if (expiresAt) {
        const expirationDate = new Date(expiresAt);
        if (isNaN(expirationDate.getTime())) {
          throw new BadRequestError('Invalid expiration date');
        }
        if (expirationDate <= new Date()) {
          throw new BadRequestError('Expiration date must be in the future');
        }
      }

      // Create API key
      const { apiKey, plaintext } = await apiKeyService.createApiKey({
        workspaceId,
        createdBy,
        name,
        scopes,
        rateLimit,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        allowedIps,
      });

      logger.info('API key created via controller', {
        keyId: apiKey._id,
        workspaceId,
        createdBy,
      });

      // Audit log
      WorkspaceActivityLog.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(req.user!.userId),
        action: ActivityAction.API_KEY_CREATED,
        metadata: {
          keyId: apiKey._id.toString(),
          name: apiKey.name,
          scopes: apiKey.scopes,
        },
      }).catch(() => {});

      // Return plaintext key ONCE
      res.status(201).json({
        apiKey: {
          id: apiKey._id,
          name: apiKey.name,
          prefix: apiKey.prefix,
          key: plaintext, // ⚠️ ONLY TIME THIS IS RETURNED
          scopes: apiKey.scopes,
          rateLimit: apiKey.rateLimit,
          status: apiKey.status,
          expiresAt: apiKey.expiresAt,
          allowedIps: apiKey.allowedIps,
          createdAt: apiKey.createdAt,
        },
        warning: 'Save this key securely. It will not be shown again.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/api-keys
   * List all API keys for the workspace
   */
  static async listApiKeys(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspace!.workspaceId.toString();

      const apiKeys = await apiKeyService.listApiKeys(workspaceId);

      res.json({
        apiKeys: apiKeys.map(key => ({
          id: key._id,
          name: key.name,
          prefix: key.prefix,
          scopes: key.scopes,
          rateLimit: key.rateLimit,
          status: key.status,
          expiresAt: key.expiresAt,
          allowedIps: key.allowedIps,
          lastUsedAt: key.lastUsedAt,
          lastUsedIp: key.lastUsedIp,
          requestCount: key.requestCount,
          createdAt: key.createdAt,
          updatedAt: key.updatedAt,
          rotatedTo: key.rotatedTo,
          rotationGracePeriodEnds: key.rotationGracePeriodEnds,
        })),
        total: apiKeys.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/api-keys/:id
   * Get a single API key with details
   */
  static async getApiKey(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace!.workspaceId.toString();

      const apiKey = await apiKeyService.getApiKey(id, workspaceId);

      res.json({
        apiKey: {
          id: apiKey._id,
          name: apiKey.name,
          prefix: apiKey.prefix,
          scopes: apiKey.scopes,
          rateLimit: apiKey.rateLimit,
          status: apiKey.status,
          expiresAt: apiKey.expiresAt,
          allowedIps: apiKey.allowedIps,
          lastUsedAt: apiKey.lastUsedAt,
          lastUsedIp: apiKey.lastUsedIp,
          requestCount: apiKey.requestCount,
          createdAt: apiKey.createdAt,
          updatedAt: apiKey.updatedAt,
          createdBy: apiKey.createdBy,
          revokedAt: apiKey.revokedAt,
          revokedBy: apiKey.revokedBy,
          rotatedFrom: apiKey.rotatedFrom,
          rotatedTo: apiKey.rotatedTo,
          rotationGracePeriodEnds: apiKey.rotationGracePeriodEnds,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/api-keys/:id
   * Update an API key
   */
  static async updateApiKey(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { name, scopes, rateLimit, allowedIps } = req.body;
      const workspaceId = req.workspace!.workspaceId.toString();

      // Validate updates
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (scopes !== undefined) {
        if (!Array.isArray(scopes) || scopes.length === 0) {
          throw new BadRequestError('At least one scope is required');
        }
        updates.scopes = scopes;
      }
      if (rateLimit !== undefined) {
        if (!rateLimit.maxRequests || !rateLimit.windowMs) {
          throw new BadRequestError('Rate limit must include maxRequests and windowMs');
        }
        if (rateLimit.maxRequests < 100 || rateLimit.maxRequests > 10000) {
          throw new BadRequestError('Rate limit must be between 100 and 10000 requests');
        }
        updates.rateLimit = rateLimit;
      }
      if (allowedIps !== undefined) updates.allowedIps = allowedIps;

      if (Object.keys(updates).length === 0) {
        throw new BadRequestError('No valid updates provided');
      }

      const apiKey = await apiKeyService.updateApiKey(id, workspaceId, updates);

      logger.info('API key updated via controller', {
        keyId: id,
        workspaceId,
        updates: Object.keys(updates),
      });

      res.json({
        apiKey: {
          id: apiKey._id,
          name: apiKey.name,
          prefix: apiKey.prefix,
          scopes: apiKey.scopes,
          rateLimit: apiKey.rateLimit,
          status: apiKey.status,
          allowedIps: apiKey.allowedIps,
          updatedAt: apiKey.updatedAt,
        },
        message: 'API key updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/api-keys/:id/revoke
   * Revoke an API key
   */
  static async revokeApiKey(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace!.workspaceId.toString();
      const revokedBy = req.user!.userId;

      await apiKeyService.revokeApiKey(id, workspaceId, revokedBy);

      logger.info('API key revoked via controller', {
        keyId: id,
        workspaceId,
        revokedBy,
      });

      // Audit log
      WorkspaceActivityLog.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(req.user!.userId),
        action: ActivityAction.API_KEY_REVOKED,
        metadata: { keyId: id },
      }).catch(() => {});

      res.json({
        message: 'API key revoked successfully',
        keyId: id,
        revokedAt: new Date(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/api-keys/:id
   * Delete an API key permanently
   */
  static async deleteApiKey(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace!.workspaceId.toString();

      await apiKeyService.deleteApiKey(id, workspaceId);

      logger.info('API key deleted via controller', {
        keyId: id,
        workspaceId,
        deletedBy: req.user!.userId,
      });

      // Audit log
      WorkspaceActivityLog.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(req.user!.userId),
        action: ActivityAction.API_KEY_DELETED,
        metadata: { keyId: id },
      }).catch(() => {});

      res.json({
        message: 'API key deleted successfully',
        keyId: id,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/api-keys/:id/rotate
   * Rotate an API key
   */
  static async rotateApiKey(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { gracePeriodDays } = req.body;
      const workspaceId = req.workspace!.workspaceId.toString();

      // Validate grace period
      const gracePeriod = gracePeriodDays || 7;
      if (gracePeriod < 1 || gracePeriod > 30) {
        throw new BadRequestError('Grace period must be between 1 and 30 days');
      }

      const { newKey, plaintext } = await apiKeyService.rotateApiKey(
        id,
        workspaceId,
        gracePeriod
      );

      logger.info('API key rotated via controller', {
        oldKeyId: id,
        newKeyId: newKey._id,
        workspaceId,
        gracePeriodDays: gracePeriod,
      });

      // Audit log
      WorkspaceActivityLog.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(req.user!.userId),
        action: ActivityAction.API_KEY_ROTATED,
        metadata: {
          oldKeyId: id,
          newKeyId: newKey._id.toString(),
          gracePeriodDays: gracePeriod,
        },
      }).catch(() => {});

      // Return new plaintext key ONCE
      res.json({
        newKey: {
          id: newKey._id,
          name: newKey.name,
          prefix: newKey.prefix,
          key: plaintext, // ⚠️ ONLY TIME THIS IS RETURNED
          scopes: newKey.scopes,
          rateLimit: newKey.rateLimit,
          status: newKey.status,
          createdAt: newKey.createdAt,
        },
        oldKeyId: id,
        gracePeriodEnds: newKey.rotatedFrom ? 
          (await apiKeyService.getApiKey(id, workspaceId)).rotationGracePeriodEnds : 
          undefined,
        warning: 'Save this key securely. It will not be shown again. The old key will remain active during the grace period.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/api-keys/:id/usage
   * Get usage statistics for an API key
   */
  static async getUsageStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace!.workspaceId.toString();
      
      // Parse date range from query params
      const startDate = req.query.startDate 
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
      
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date(); // Default: now

      const stats = await apiKeyService.getUsageStats(id, workspaceId, startDate, endDate);

      res.json({
        usage: stats,
        period: {
          startDate,
          endDate,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/api-keys/scopes
   * Get all available API scopes with documentation
   */
  static async getScopesDocumentation(req: Request, res: Response, next: NextFunction) {
    try {
      const { getScopeDocumentation, getCategoryDocumentation } = await import('../config/apiScopes');
      
      const scopes = getScopeDocumentation();
      const categories = getCategoryDocumentation();

      res.json({
        scopes,
        categories,
        total: scopes.length,
      });
    } catch (error) {
      next(error);
    }
  }
}
