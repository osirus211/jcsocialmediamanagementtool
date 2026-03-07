/**
 * OAuth Framework Integration Tests
 * 
 * Tests the OAuth framework components:
 * - OAuth state management
 * - Session expiry handling
 * - PKCE support
 * - Idempotency protection
 * - State cleanup
 */

import { oauthStateService } from '../../services/OAuthStateService';
import { OAuthIdempotencyService } from '../../services/OAuthIdempotencyService';
import { getRedisClientSafe } from '../../config/redis';
import crypto from 'crypto';
import mongoose from 'mongoose';

describe('OAuth Framework Integration Tests', () => {
  const testWorkspaceId = new mongoose.Types.ObjectId().toString();
  const testUserId = new mongoose.Types.ObjectId().toString();

  afterEach(async () => {
    // Cleanup any test states
    const redis = getRedisClientSafe();
    if (redis) {
      const keys = await redis.keys('oauth:state:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      const idempotencyKeys = await redis.keys('oauth:idempotency:*');
      if (idempotencyKeys.length > 0) {
        await redis.del(...idempotencyKeys);
      }
    }
  });

  describe('OAuth State Management', () => {
    it('should create OAuth state with 10-minute TTL', async () => {
      const state = await oauthStateService.createState(
        testWorkspaceId,
        testUserId,
        'twitter'
      );

      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);

      // Verify state is stored in Redis
      const stateData = await oauthStateService.validateState(state);
      expect(stateData).not.toBeNull();
      expect(stateData?.platform).toBe('twitter');
      expect(stateData?.workspaceId).toBe(testWorkspaceId);
      expect(stateData?.userId).toBe(testUserId);

      // Verify TTL is approximately 10 minutes
      const expiresAt = new Date(stateData!.expiresAt);
      const createdAt = new Date(stateData!.createdAt);
      const ttlMinutes = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60);
      expect(ttlMinutes).toBeCloseTo(10, 0);
    });

    it('should store PKCE code verifier for Twitter', async () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      
      const state = await oauthStateService.createState(
        testWorkspaceId,
        testUserId,
        'twitter',
        { codeVerifier }
      );

      const stateData = await oauthStateService.validateState(state);
      expect(stateData?.codeVerifier).toBe(codeVerifier);
    });

    it('should store IP hash for IP binding', async () => {
      const ipHash = crypto.createHash('sha256').update('192.168.1.1').digest('hex');
      
      const state = await oauthStateService.createState(
        testWorkspaceId,
        testUserId,
        'facebook',
        { ipHash }
      );

      const stateData = await oauthStateService.validateState(state);
      expect(stateData?.ipHash).toBe(ipHash);
    });

    it('should validate state successfully', async () => {
      const state = await oauthStateService.createState(
        testWorkspaceId,
        testUserId,
        'instagram'
      );

      const stateData = await oauthStateService.validateState(state);
      expect(stateData).not.toBeNull();
      expect(stateData?.state).toBe(state);
      expect(stateData?.platform).toBe('instagram');
    });

    it('should return null for invalid state', async () => {
      const fakeState = crypto.randomBytes(32).toString('base64url');
      const stateData = await oauthStateService.validateState(fakeState);
      expect(stateData).toBeNull();
    });

    it('should return null for expired state', async () => {
      const state = await oauthStateService.createState(
        testWorkspaceId,
        testUserId,
        'twitter'
      );

      // Manually expire the state
      const redis = getRedisClientSafe();
      const key = `oauth:state:${state}`;
      const data = await redis?.get(key);
      if (data) {
        const stateData = JSON.parse(data);
        stateData.expiresAt = new Date(Date.now() - 1000); // 1 second ago
        await redis?.setex(key, 60, JSON.stringify(stateData));
      }

      const validatedState = await oauthStateService.validateState(state);
      expect(validatedState).toBeNull();
    });
  });

  describe('OAuth State Consumption (Atomic)', () => {
    it('should consume state atomically using GETDEL', async () => {
      const state = await oauthStateService.createState(
        testWorkspaceId,
        testUserId,
        'twitter'
      );

      // First consumption should succeed
      const stateData = await oauthStateService.consumeState(state);
      expect(stateData).not.toBeNull();
      expect(stateData?.state).toBe(state);

      // Second consumption should fail (state already deleted)
      const secondAttempt = await oauthStateService.consumeState(state);
      expect(secondAttempt).toBeNull();
    });

    it('should prevent race conditions with concurrent consumption', async () => {
      const state = await oauthStateService.createState(
        testWorkspaceId,
        testUserId,
        'facebook'
      );

      // Simulate concurrent consumption attempts
      const results = await Promise.all([
        oauthStateService.consumeState(state),
        oauthStateService.consumeState(state),
        oauthStateService.consumeState(state),
      ]);

      // Only one should succeed
      const successfulResults = results.filter((r) => r !== null);
      expect(successfulResults.length).toBe(1);
      expect(successfulResults[0]?.state).toBe(state);
    });
  });

  describe('OAuth Callback Idempotency', () => {
    it('should prevent duplicate callback processing', async () => {
      const idempotencyService = new OAuthIdempotencyService();
      const state = crypto.randomBytes(32).toString('base64url');

      // First attempt should succeed
      const firstAttempt = await idempotencyService.checkAndSet(state);
      expect(firstAttempt).toBe(true);

      // Second attempt should fail (duplicate)
      const secondAttempt = await idempotencyService.checkAndSet(state);
      expect(secondAttempt).toBe(false);

      // Third attempt should also fail
      const thirdAttempt = await idempotencyService.checkAndSet(state);
      expect(thirdAttempt).toBe(false);
    });

    it('should handle concurrent idempotency checks', async () => {
      const idempotencyService = new OAuthIdempotencyService();
      const state = crypto.randomBytes(32).toString('base64url');

      // Simulate concurrent callback attempts
      const results = await Promise.all([
        idempotencyService.checkAndSet(state),
        idempotencyService.checkAndSet(state),
        idempotencyService.checkAndSet(state),
      ]);

      // Only one should succeed
      const successfulResults = results.filter((r) => r === true);
      expect(successfulResults.length).toBe(1);
    });
  });

  describe('Expired State Cleanup', () => {
    it('should clean up expired states', async () => {
      // Create multiple states
      const states = await Promise.all([
        oauthStateService.createState(testWorkspaceId, testUserId, 'twitter'),
        oauthStateService.createState(testWorkspaceId, testUserId, 'facebook'),
        oauthStateService.createState(testWorkspaceId, testUserId, 'instagram'),
      ]);

      // Manually expire them
      const redis = getRedisClientSafe();
      for (const state of states) {
        const key = `oauth:state:${state}`;
        const data = await redis?.get(key);
        if (data) {
          const stateData = JSON.parse(data);
          stateData.expiresAt = new Date(Date.now() - 1000);
          await redis?.setex(key, 60, JSON.stringify(stateData));
        }
      }

      // Run cleanup
      const cleanedCount = await oauthStateService.cleanupExpiredStates();
      expect(cleanedCount).toBe(3);

      // Verify they're gone
      for (const state of states) {
        const validatedState = await oauthStateService.validateState(state);
        expect(validatedState).toBeNull();
      }
    });

    it('should not clean up valid states', async () => {
      // Create valid states
      const states = await Promise.all([
        oauthStateService.createState(testWorkspaceId, testUserId, 'twitter'),
        oauthStateService.createState(testWorkspaceId, testUserId, 'facebook'),
      ]);

      // Run cleanup
      const cleanedCount = await oauthStateService.cleanupExpiredStates();
      expect(cleanedCount).toBe(0);

      // Verify they still exist
      for (const state of states) {
        const validatedState = await oauthStateService.validateState(state);
        expect(validatedState).not.toBeNull();
      }
    });
  });

  describe('PKCE Support', () => {
    it('should generate valid PKCE code verifier', () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      expect(codeVerifier).toHaveLength(43); // Base64url encoded 32 bytes
      expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/); // Base64url characters only
    });

    it('should generate valid PKCE code challenge', () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      expect(codeChallenge).toHaveLength(43); // Base64url encoded SHA-256
      expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should store and retrieve PKCE verifier', async () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      
      const state = await oauthStateService.createState(
        testWorkspaceId,
        testUserId,
        'twitter',
        { codeVerifier }
      );

      const stateData = await oauthStateService.consumeState(state);
      expect(stateData?.codeVerifier).toBe(codeVerifier);
    });
  });

  describe('State Statistics', () => {
    it('should return accurate statistics', async () => {
      // Create some states
      await Promise.all([
        oauthStateService.createState(testWorkspaceId, testUserId, 'twitter'),
        oauthStateService.createState(testWorkspaceId, testUserId, 'facebook'),
        oauthStateService.createState(testWorkspaceId, testUserId, 'instagram'),
      ]);

      const stats = await oauthStateService.getStats();
      expect(stats.activeStates).toBeGreaterThanOrEqual(3);
      expect(stats.redisAvailable).toBe(true);
    });

    it('should list active states', async () => {
      const states = await Promise.all([
        oauthStateService.createState(testWorkspaceId, testUserId, 'twitter'),
        oauthStateService.createState(testWorkspaceId, testUserId, 'facebook'),
      ]);

      const activeStates = await oauthStateService.getActiveStates();
      expect(activeStates.length).toBeGreaterThanOrEqual(2);
      
      const stateIds = activeStates.map((s) => s.state);
      expect(stateIds).toContain(states[0]);
      expect(stateIds).toContain(states[1]);
    });
  });
});
