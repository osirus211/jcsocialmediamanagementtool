/**
 * API Key Service
 * 
 * Handles API key generation, validation, and management
 */

import crypto from 'crypto';
import { ApiKey, IApiKey, ApiKeyStatus } from '../models/ApiKey';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import { getRedisClient } from '../config/redis';
import { VALID_SCOPES, validateScopes as validateScopeStrings } from '../config/apiScopes';
import { securityAuditService } from './SecurityAuditService';
import { SecurityEventType } from '../models/SecurityEvent';

interface GeneratedKey {
  plaintext: string;
  hash: string;
  prefix: string;
}

interface CreateApiKeyParams {
  workspaceId: string;
  createdBy: string;
  name: string;
  scopes: string[];
  rateLimit?: { maxRequests: number; windowMs: number };
  expiresAt?: Date;
  allowedIps?: string[];
}

interface UpdateApiKeyParams {
  name?: string;
  scopes?: string[];
  rateLimit?: { maxRequests: number; windowMs: number };
  allowedIps?: string[];
}

export class ApiKeyService {
  /**
   * Generate a new API key with secure random bytes
   * Format: sk_live_<32_random_bytes_base64url>
   */
  generateApiKey(environment: 'live' | 'test' = 'live'): GeneratedKey {
    // Generate 32 random bytes (256 bits of entropy)
    const randomBytes = crypto.randomBytes(32);
    
    // Encode as base64url (URL-safe)
    const keySecret = randomBytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    // Construct full key
    const plaintext = `sk_${environment}_${keySecret}`;
    
    // Hash for storage (SHA-256)
    const hash = crypto
      .createHash('sha256')
      .update(plaintext)
      .digest('hex');
    
    // Extract prefix for display (first 15 characters)
    const prefix = plaintext.substring(0, 15);
    
    return { plaintext, hash, prefix };
  }

  /**
   * Hash an API key for lookup
   */
  hashApiKey(plaintext: string): string {
    return crypto
      .createHash('sha256')
      .update(plaintext)
      .digest('hex');
  }

  /**
   * Validate scopes array
   */
  validateScopes(scopes: string[]): string[] {
    if (!scopes || scopes.length === 0) {
      throw new BadRequestError('At least one scope is required');
    }

    const invalid = validateScopeStrings(scopes);
    if (invalid.length > 0) {
      throw new BadRequestError(`Invalid scopes: ${invalid.join(', ')}`);
    }

    // Remove duplicates
    return [...new Set(scopes)];
  }


  /**
   * Check if workspace has reached API key limit
   */
  async checkWorkspaceKeyLimit(workspaceId: string): Promise<boolean> {
    const count = await ApiKey.countDocuments({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      status: ApiKeyStatus.ACTIVE,
    });

    const MAX_KEYS_PER_WORKSPACE = config.apiKey.maxPerWorkspace;
    return count < MAX_KEYS_PER_WORKSPACE;
  }

  /**
   * Create a new API key
   */
  async createApiKey(params: CreateApiKeyParams): Promise<{ apiKey: IApiKey; plaintext: string }> {
    // Validate scopes
    const validatedScopes = this.validateScopes(params.scopes);

    // Check workspace key limit
    const canCreate = await this.checkWorkspaceKeyLimit(params.workspaceId);
    if (!canCreate) {
      throw new BadRequestError('Workspace has reached maximum API key limit');
    }

    // Generate API key
    const { plaintext, hash, prefix } = this.generateApiKey('live');

    // Create database record
    const apiKey = await ApiKey.create({
      workspaceId: new mongoose.Types.ObjectId(params.workspaceId),
      createdBy: new mongoose.Types.ObjectId(params.createdBy),
      name: params.name,
      prefix,
      keyHash: hash,
      scopes: validatedScopes,
      rateLimit: params.rateLimit || {
        maxRequests: config.apiKey.defaultRateLimit,
        windowMs: config.apiKey.defaultWindowMs,
      },
      status: ApiKeyStatus.ACTIVE,
      expiresAt: params.expiresAt,
      allowedIps: params.allowedIps || [],
      requestCount: 0,
    });

    logger.info('API key created', {
      keyId: apiKey._id,
      workspaceId: params.workspaceId,
      createdBy: params.createdBy,
      scopes: validatedScopes,
    });

    // Security audit log
    await securityAuditService.logEvent({
      type: SecurityEventType.API_KEY_CREATED,
      userId: new mongoose.Types.ObjectId(params.createdBy),
      workspaceId: new mongoose.Types.ObjectId(params.workspaceId),
      ipAddress: 'internal', // Will be set by controller if available
      success: true,
      resource: apiKey._id.toString(),
      metadata: {
        keyName: params.name,
        scopes: validatedScopes,
        prefix,
      },
    });

    return { apiKey, plaintext };
  }

  /**
   * Validate an API key (used by authentication middleware)
   * Uses Redis caching to reduce database load
   */
  async validateApiKey(plaintext: string): Promise<IApiKey | null> {
    // Hash the provided key
    const hash = this.hashApiKey(plaintext);
    
    // Try cache first
    try {
      const redis = getRedisClient();
      const cacheKey = `apikey:cache:${hash}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        const apiKeyData = JSON.parse(cached);
        
        // Check if cached key is still valid
        if (apiKeyData.status === ApiKeyStatus.ACTIVE) {
          // Check expiration
          if (!apiKeyData.expiresAt || new Date(apiKeyData.expiresAt) > new Date()) {
            logger.debug('API key cache hit', { keyId: apiKeyData._id });
            
            // Convert back to Mongoose document-like object
            return {
              ...apiKeyData,
              _id: new mongoose.Types.ObjectId(apiKeyData._id),
              workspaceId: new mongoose.Types.ObjectId(apiKeyData.workspaceId),
              createdBy: new mongoose.Types.ObjectId(apiKeyData.createdBy),
            } as any;
          }
        }
        
        // Cached key is invalid, delete from cache
        await redis.del(cacheKey);
      }
    } catch (error: any) {
      logger.error('API key cache read error', { error: error.message });
      // Continue to database lookup on cache error
    }

    // Cache miss: query database
    const apiKey = await ApiKey.findOne({ keyHash: hash });

    if (!apiKey) {
      return null;
    }

    // Check if key is active
    if (apiKey.status !== ApiKeyStatus.ACTIVE) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }
    
    // Cache the valid key for 5 minutes
    try {
      const redis = getRedisClient();
      const cacheKey = `apikey:cache:${hash}`;
      const cacheTTL = config.apiKey.cacheTtlSeconds;
      
      await redis.setex(
        cacheKey,
        cacheTTL,
        JSON.stringify({
          _id: apiKey._id.toString(),
          workspaceId: apiKey.workspaceId.toString(),
          createdBy: apiKey.createdBy.toString(),
          name: apiKey.name,
          scopes: apiKey.scopes,
          rateLimit: apiKey.rateLimit,
          status: apiKey.status,
          expiresAt: apiKey.expiresAt,
          allowedIps: apiKey.allowedIps,
        })
      );
      
      logger.debug('API key cached', { keyId: apiKey._id, ttl: cacheTTL });
    } catch (error: any) {
      logger.error('API key cache write error', { error: error.message });
      // Continue even if caching fails
    }

    return apiKey;
  }
  
  /**
   * Invalidate API key cache
   * Call this when key is revoked, updated, or deleted
   */
  async invalidateCache(keyHash: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const cacheKey = `apikey:cache:${keyHash}`;
      await redis.del(cacheKey);
      logger.debug('API key cache invalidated', { keyHash: keyHash.substring(0, 8) });
    } catch (error: any) {
      logger.error('API key cache invalidation error', { error: error.message });
    }
  }

  /**
   * List API keys for a workspace
   */
  async listApiKeys(workspaceId: string): Promise<IApiKey[]> {
    return ApiKey.find({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    })
      .select('-keyHash') // Exclude key hash from response
      .sort({ createdAt: -1 });
  }

  /**
   * Get a single API key by ID
   */
  async getApiKey(keyId: string, workspaceId: string): Promise<IApiKey> {
    const apiKey = await ApiKey.findOne({
      _id: new mongoose.Types.ObjectId(keyId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    }).select('-keyHash');

    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    return apiKey;
  }

  /**
   * Update an API key
   */
  async updateApiKey(
    keyId: string,
    workspaceId: string,
    updates: UpdateApiKeyParams
  ): Promise<IApiKey> {
    const apiKey = await ApiKey.findOne({
      _id: new mongoose.Types.ObjectId(keyId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    // Validate scopes if provided
    if (updates.scopes) {
      updates.scopes = this.validateScopes(updates.scopes);
    }

    // Apply updates
    if (updates.name) apiKey.name = updates.name;
    if (updates.scopes) apiKey.scopes = updates.scopes;
    if (updates.rateLimit) apiKey.rateLimit = updates.rateLimit;
    if (updates.allowedIps !== undefined) apiKey.allowedIps = updates.allowedIps;

    await apiKey.save();
    
    // Invalidate cache
    await this.invalidateCache(apiKey.keyHash);

    logger.info('API key updated', {
      keyId: apiKey._id,
      workspaceId,
      updates: Object.keys(updates),
    });

    // Security audit log
    await securityAuditService.logEvent({
      type: SecurityEventType.API_KEY_UPDATED,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      ipAddress: 'internal',
      success: true,
      resource: keyId,
      metadata: {
        keyName: apiKey.name,
        updatedFields: Object.keys(updates),
      },
    });

    return apiKey;
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string, workspaceId: string, revokedBy: string): Promise<void> {
    const apiKey = await ApiKey.findOne({
      _id: new mongoose.Types.ObjectId(keyId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    if (apiKey.status === ApiKeyStatus.REVOKED) {
      throw new BadRequestError('API key is already revoked');
    }

    apiKey.status = ApiKeyStatus.REVOKED;
    apiKey.revokedAt = new Date();
    apiKey.revokedBy = new mongoose.Types.ObjectId(revokedBy);

    await apiKey.save();
    
    // Invalidate cache
    await this.invalidateCache(apiKey.keyHash);

    logger.info('API key revoked', {
      keyId: apiKey._id,
      workspaceId,
      revokedBy,
    });

    // Security audit log
    await securityAuditService.logEvent({
      type: SecurityEventType.API_KEY_REVOKED,
      userId: new mongoose.Types.ObjectId(revokedBy),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      ipAddress: 'internal',
      success: true,
      resource: keyId,
      metadata: {
        keyName: apiKey.name,
        prefix: apiKey.prefix,
      },
    });
  }

  /**
   * Delete an API key permanently
   */
  async deleteApiKey(keyId: string, workspaceId: string): Promise<void> {
    // Get key details before deletion for audit log
    const apiKey = await ApiKey.findOne({
      _id: new mongoose.Types.ObjectId(keyId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    const result = await ApiKey.deleteOne({
      _id: new mongoose.Types.ObjectId(keyId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundError('API key not found');
    }

    logger.info('API key deleted', {
      keyId,
      workspaceId,
    });

    // Security audit log
    await securityAuditService.logEvent({
      type: SecurityEventType.API_KEY_DELETED,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      ipAddress: 'internal',
      success: true,
      resource: keyId,
      metadata: {
        keyName: apiKey.name,
        prefix: apiKey.prefix,
      },
    });
  }

  /**
   * Rotate an API key
   */
  async rotateApiKey(
    keyId: string,
    workspaceId: string,
    gracePeriodDays: number = 7
  ): Promise<{ newKey: IApiKey; plaintext: string }> {
    // Validate grace period
    if (gracePeriodDays < 1 || gracePeriodDays > 30) {
      throw new BadRequestError('Grace period must be between 1 and 30 days');
    }

    // Find old key
    const oldKey = await ApiKey.findOne({
      _id: new mongoose.Types.ObjectId(keyId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!oldKey) {
      throw new NotFoundError('API key not found');
    }

    if (oldKey.status !== ApiKeyStatus.ACTIVE) {
      throw new BadRequestError('Can only rotate active API keys');
    }

    if (oldKey.rotatedTo) {
      throw new BadRequestError('API key has already been rotated');
    }

    // Generate new key
    const { plaintext, hash, prefix } = this.generateApiKey('live');

    // Create new key with same permissions
    const newKey = await ApiKey.create({
      workspaceId: oldKey.workspaceId,
      createdBy: oldKey.createdBy,
      name: `${oldKey.name} (rotated)`,
      prefix,
      keyHash: hash,
      scopes: oldKey.scopes,
      rateLimit: oldKey.rateLimit,
      status: ApiKeyStatus.ACTIVE,
      expiresAt: oldKey.expiresAt,
      allowedIps: oldKey.allowedIps,
      rotatedFrom: oldKey._id,
      requestCount: 0,
    });

    // Update old key with rotation info
    const gracePeriodEnds = new Date();
    gracePeriodEnds.setDate(gracePeriodEnds.getDate() + gracePeriodDays);

    oldKey.rotatedTo = newKey._id;
    oldKey.rotationGracePeriodEnds = gracePeriodEnds;
    await oldKey.save();

    logger.info('API key rotated', {
      oldKeyId: oldKey._id,
      newKeyId: newKey._id,
      workspaceId,
      gracePeriodDays,
    });

    // Security audit log
    await securityAuditService.logEvent({
      type: SecurityEventType.API_KEY_ROTATED,
      workspaceId: oldKey.workspaceId,
      ipAddress: 'internal',
      success: true,
      resource: keyId,
      metadata: {
        oldKeyId: oldKey._id.toString(),
        newKeyId: newKey._id.toString(),
        oldPrefix: oldKey.prefix,
        newPrefix: newKey.prefix,
        gracePeriodDays,
        gracePeriodEnds,
      },
    });

    return { newKey, plaintext };
  }

  /**
   * Get usage statistics for an API key
   */
  async getUsageStats(
    keyId: string,
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const apiKey = await this.getApiKey(keyId, workspaceId);

    // Basic stats from the key itself
    return {
      keyId: apiKey._id,
      name: apiKey.name,
      totalRequests: apiKey.requestCount,
      lastUsedAt: apiKey.lastUsedAt,
      lastUsedIp: apiKey.lastUsedIp,
      rateLimit: apiKey.rateLimit,
      // TODO: Add detailed analytics from analytics collection
    };
  }
}

export const apiKeyService = new ApiKeyService();
