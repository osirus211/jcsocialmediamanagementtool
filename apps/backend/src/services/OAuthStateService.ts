import { getRedisClientSafe, recordCircuitBreakerSuccess, recordCircuitBreakerError } from '../config/redis';
import { logger } from '../utils/logger';
import crypto from 'crypto';

/**
 * OAuth State Service
 * 
 * Manages OAuth state parameters with Redis storage and TTL
 * Provides CSRF protection for OAuth flows
 */

export interface OAuthStateData {
  state: string;
  workspaceId: string;
  userId: string;
  platform: string;
  providerType?: string; // Provider type for multi-provider platforms (e.g., INSTAGRAM_BUSINESS, INSTAGRAM_BASIC)
  redirectUri?: string;
  codeVerifier?: string; // For PKCE
  ipHash?: string; // Hashed IP address for binding
  createdAt: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export class OAuthStateService {
  private static instance: OAuthStateService;
  private readonly STATE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds
  private readonly STATE_PREFIX = 'oauth:state:';
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  static getInstance(): OAuthStateService {
    if (!OAuthStateService.instance) {
      OAuthStateService.instance = new OAuthStateService();
    }
    return OAuthStateService.instance;
  }

  constructor() {
    // Start cleanup job for expired states
    this.startCleanupJob();
  }

  /**
   * Generate and store OAuth state
   */
  async createState(
    workspaceId: string,
    userId: string,
    platform: string,
    options: {
      providerType?: string;
      redirectUri?: string;
      codeVerifier?: string;
      ipHash?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    // Generate cryptographically secure state
    const state = crypto.randomBytes(32).toString('base64url');
    
    const stateData: OAuthStateData = {
      state,
      workspaceId,
      userId,
      platform,
      providerType: options.providerType,
      redirectUri: options.redirectUri,
      codeVerifier: options.codeVerifier,
      ipHash: options.ipHash,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.STATE_TTL),
      metadata: options.metadata,
    };

    const redis = getRedisClientSafe();
    
    if (redis) {
      try {
        const key = `${this.STATE_PREFIX}${state}`;
        const ttlSeconds = Math.ceil(this.STATE_TTL / 1000);
        
        await redis.setex(key, ttlSeconds, JSON.stringify(stateData));
        recordCircuitBreakerSuccess();

        logger.debug('OAuth state stored in Redis', {
          state: state.substring(0, 10) + '...',
          workspaceId,
          userId,
          platform,
          providerType: options.providerType,
          ipBound: !!options.ipHash,
          ttl: ttlSeconds,
        });

      } catch (error: any) {
        recordCircuitBreakerError();
        logger.error('Error storing OAuth state in Redis - FAILING HARD', {
          state: state.substring(0, 10) + '...',
          workspaceId,
          userId,
          platform,
          error: error.message,
        });

        // PRODUCTION: Fail hard if Redis unavailable
        throw new Error('OAuth state storage failed: Redis unavailable');
      }
    } else {
      logger.error('Redis unavailable for OAuth state storage - FAILING HARD', {
        state: state.substring(0, 10) + '...',
        workspaceId,
        userId,
        platform,
      });
      
      // PRODUCTION: Fail hard if Redis unavailable
      throw new Error('OAuth state storage failed: Redis unavailable');
    }

    return state;
  }

  /**
   * Validate and retrieve OAuth state
   */
  async validateState(state: string): Promise<OAuthStateData | null> {
    if (!state || typeof state !== 'string') {
      logger.warn('Invalid OAuth state format', { state });
      return null;
    }

    const redis = getRedisClientSafe();
    if (!redis) {
      logger.error('Redis unavailable for OAuth state validation');
      throw new Error('OAuth state service unavailable');
    }

    try {
      const key = `${this.STATE_PREFIX}${state}`;
      const data = await redis.get(key);
      recordCircuitBreakerSuccess();

      if (!data) {
        logger.warn('OAuth state not found or expired', {
          state: state.substring(0, 10) + '...',
        });
        return null;
      }

      const stateData: OAuthStateData = JSON.parse(data);
      
      // Verify expiration (double-check)
      if (new Date() > new Date(stateData.expiresAt)) {
        logger.warn('OAuth state expired', {
          state: state.substring(0, 10) + '...',
          expiresAt: stateData.expiresAt,
        });
        
        // Clean up expired state
        await redis.del(key);
        return null;
      }

      logger.debug('OAuth state validated successfully', {
        state: state.substring(0, 10) + '...',
        workspaceId: stateData.workspaceId,
        userId: stateData.userId,
        platform: stateData.platform,
      });

      return stateData;

    } catch (error: any) {
      recordCircuitBreakerError();
      logger.error('Error validating OAuth state in Redis', {
        state: state.substring(0, 10) + '...',
        error: error.message,
      });
      throw new Error('OAuth state service unavailable');
    }
  }
  /**
   * Validate OAuth state with workspaceId check
   */
  async validateStateForWorkspace(state: string, expectedWorkspaceId: string): Promise<OAuthStateData | null> {
    const stateData = await this.validateState(state);
    if (!stateData) {
      return null;
    }

    // Validate workspaceId matches
    if (stateData.workspaceId !== expectedWorkspaceId) {
      logger.warn('OAuth state workspaceId mismatch', {
        state: state.substring(0, 10) + '...',
        expectedWorkspaceId,
        actualWorkspaceId: stateData.workspaceId,
        platform: stateData.platform,
      });
      return null;
    }

    logger.info('OAuth state validated with workspaceId check', {
      state: state.substring(0, 10) + '...',
      workspaceId: stateData.workspaceId,
      userId: stateData.userId,
      platform: stateData.platform,
    });

    return stateData;
  }

  /**
   * Validate OAuth state with providerType check
   * 
   * SECURITY: Ensures the provider type in the callback matches the one stored in state
   * This prevents attacks where an attacker could substitute a different provider's callback
   * 
   * @throws Error if providerType mismatch detected
   */
  async validateStateWithProviderType(
    state: string,
    expectedProviderType: string
  ): Promise<OAuthStateData | null> {
    const stateData = await this.validateState(state);
    if (!stateData) {
      return null;
    }

    // Validate providerType matches if it was stored
    if (stateData.providerType && stateData.providerType !== expectedProviderType) {
      logger.error('OAuth state providerType mismatch - SECURITY VIOLATION', {
        state: state.substring(0, 10) + '...',
        expectedProviderType,
        actualProviderType: stateData.providerType,
        platform: stateData.platform,
        workspaceId: stateData.workspaceId,
      });

      // Delete the state to prevent reuse
      await this.deleteState(state);

      throw new Error(
        `OAuth security violation: Provider type mismatch. ` +
        `Expected ${expectedProviderType}, got ${stateData.providerType}`
      );
    }

    logger.debug('OAuth state validated with providerType check', {
      state: state.substring(0, 10) + '...',
      providerType: stateData.providerType,
      platform: stateData.platform,
    });

    return stateData;
  }

  /**
   * Consume OAuth state (validate and delete) - ATOMIC
   * 
   * Uses Redis GETDEL for atomic get-and-delete operation
   * This prevents race conditions where two concurrent requests
   * could both validate the same state before either deletes it.
   * 
   * CRITICAL: This must be atomic to prevent replay attacks under concurrency
   */
  async consumeState(state: string): Promise<OAuthStateData | null> {
    if (!state || typeof state !== 'string') {
      logger.warn('Invalid OAuth state format', { state });
      return null;
    }

    const redis = getRedisClientSafe();
    
    if (!redis) {
      logger.error('Redis unavailable for OAuth state consumption', {
        state: state.substring(0, 10) + '...',
      });
      
      throw new Error('OAuth state service unavailable');
    }

    try {
      const key = `${this.STATE_PREFIX}${state}`;
      
      // ATOMIC: Get and delete in single operation using GETDEL
      let data: string | null = null;
      
      // Try GETDEL first (Redis >= 6.2.0)
      try {
        data = await redis.getdel(key);
        recordCircuitBreakerSuccess();
      } catch (error: any) {
        // Fallback to Lua script for Redis < 6.2.0
        if (error.message?.includes('unknown command') || error.message?.includes('getdel')) {
          const luaScript = `
            local val = redis.call('GET', KEYS[1])
            if val then
              redis.call('DEL', KEYS[1])
            end
            return val
          `;
          data = await redis.eval(luaScript, 1, key) as string | null;
          recordCircuitBreakerSuccess();
        } else {
          throw error;
        }
      }

      if (!data) {
        logger.warn('OAuth state not found or already consumed', {
          state: state.substring(0, 10) + '...',
        });
        return null;
      }

      const stateData: OAuthStateData = JSON.parse(data);
      
      // Verify expiration (double-check)
      const now = new Date();
      const expiresAt = new Date(stateData.expiresAt);
      
      if (now > expiresAt) {
        logger.warn('OAuth state expired', {
          state: state.substring(0, 10) + '...',
          expiresAt: stateData.expiresAt,
        });
        return null;
      }

      logger.debug('OAuth state consumed atomically', {
        state: state.substring(0, 10) + '...',
        workspaceId: stateData.workspaceId,
        userId: stateData.userId,
        platform: stateData.platform,
      });

      return stateData;

    } catch (error: any) {
      recordCircuitBreakerError();
      logger.error('Error consuming OAuth state from Redis', {
        state: state.substring(0, 10) + '...',
        error: error.message,
      });

      throw new Error('OAuth state service unavailable');
    }
  }

  /**
   * Consume OAuth state with workspaceId validation
   */
  async consumeStateForWorkspace(state: string, expectedWorkspaceId: string): Promise<OAuthStateData | null> {
    const stateData = await this.validateStateForWorkspace(state, expectedWorkspaceId);
    if (!stateData) {
      return null;
    }

    // Delete the state to prevent reuse
    await this.deleteState(state);

    logger.info('OAuth state consumed with workspaceId validation', {
      state: state.substring(0, 10) + '...',
      workspaceId: stateData.workspaceId,
      userId: stateData.userId,
      platform: stateData.platform,
    });

    return stateData;
  }

  /**
   * Delete OAuth state
   */
  async deleteState(state: string): Promise<void> {
    const redis = getRedisClientSafe();
    if (!redis) {
      logger.error('Redis unavailable for OAuth state deletion');
      throw new Error('OAuth state service unavailable');
    }

    try {
      const key = `${this.STATE_PREFIX}${state}`;
      await redis.del(key);
      recordCircuitBreakerSuccess();

      logger.debug('OAuth state deleted', {
        state: state.substring(0, 10) + '...',
      });

    } catch (error: any) {
      recordCircuitBreakerError();
      logger.error('Error deleting OAuth state from Redis', {
        state: state.substring(0, 10) + '...',
        error: error.message,
      });
      throw new Error('OAuth state service unavailable');
    }
  }

  /**
   * Get all active OAuth states (for monitoring)
   */
  async getActiveStates(): Promise<OAuthStateData[]> {
    const redis = getRedisClientSafe();
    if (!redis) {
      return [];
    }

    try {
      const keys = await redis.keys(`${this.STATE_PREFIX}*`);
      recordCircuitBreakerSuccess();

      const states: OAuthStateData[] = [];

      for (const key of keys) {
        try {
          const data = await redis.get(key);
          if (data) {
            const stateData: OAuthStateData = JSON.parse(data);
            states.push(stateData);
          }
        } catch (parseError: any) {
          logger.error('Error parsing OAuth state data', {
            key,
            error: parseError.message,
          });
        }
      }

      return states.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    } catch (error: any) {
      recordCircuitBreakerError();
      logger.error('Error getting active OAuth states', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Clean up expired states manually
   */
  async cleanupExpiredStates(): Promise<number> {
    const redis = getRedisClientSafe();
    if (!redis) {
      return 0;
    }

    try {
      const keys = await redis.keys(`${this.STATE_PREFIX}*`);
      recordCircuitBreakerSuccess();

      let cleanedCount = 0;
      const now = new Date();

      for (const key of keys) {
        try {
          const data = await redis.get(key);
          if (data) {
            const stateData: OAuthStateData = JSON.parse(data);
            
            if (now > new Date(stateData.expiresAt)) {
              await redis.del(key);
              cleanedCount++;
              
              logger.debug('Cleaned up expired OAuth state', {
                state: stateData.state.substring(0, 10) + '...',
                expiresAt: stateData.expiresAt,
              });
            }
          }
        } catch (parseError: any) {
          // If we can't parse it, delete it
          await redis.del(key);
          cleanedCount++;
          
          logger.warn('Deleted unparseable OAuth state', {
            key,
            error: parseError.message,
          });
        }
      }

      if (cleanedCount > 0) {
        logger.info('OAuth state cleanup completed', {
          cleanedCount,
          totalKeys: keys.length,
        });
      }

      return cleanedCount;

    } catch (error: any) {
      recordCircuitBreakerError();
      logger.error('Error during OAuth state cleanup', {
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Start periodic cleanup job
   */
  private startCleanupJob(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupExpiredStates();
      } catch (error: any) {
        logger.error('Error in OAuth state cleanup job', {
          error: error.message,
        });
      }
    }, this.CLEANUP_INTERVAL);

    logger.info('OAuth state cleanup job started', {
      interval: this.CLEANUP_INTERVAL,
    });
  }

  /**
   * Stop cleanup job
   */
  stopCleanupJob(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('OAuth state cleanup job stopped');
    }
  }

  /**
   * Get statistics for monitoring
   */
  async getStats(): Promise<{
    activeStates: number;
    redisAvailable: boolean;
  }> {
    const activeStates = await this.getActiveStates();
    
    return {
      activeStates: activeStates.length,
      redisAvailable: getRedisClientSafe() !== null,
    };
  }

  /**
   * Shutdown - stop cleanup job
   */
  shutdown(): void {
    this.stopCleanupJob();
    logger.info('OAuthStateService shutdown complete');
  }
}

export const oauthStateService = OAuthStateService.getInstance();