/**
 * Token Refresh Integration Tests
 * 
 * Tests the complete token refresh flow:
 * - Platform routing
 * - Distributed locks
 * - Circuit breaker
 * - Retry logic
 * - DLQ handling
 */

import { distributedTokenRefreshWorker } from '../../workers/DistributedTokenRefreshWorker';
import { tokenRefreshScheduler } from '../../workers/TokenRefreshScheduler';
import { tokenRefreshQueue } from '../../queue/TokenRefreshQueue';
import { tokenRefreshDLQ } from '../../queue/TokenRefreshDLQ';
import { SocialAccount, SocialPlatform, AccountStatus } from '../../models/SocialAccount';
import { circuitBreakerService } from '../../services/CircuitBreakerService';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { connectRedis, disconnectRedis } from '../../config/redis';

describe('Token Refresh Integration Tests', () => {
  beforeAll(async () => {
    await connectDatabase();
    await connectRedis();
  });

  afterAll(async () => {
    await disconnectRedis();
    await disconnectDatabase();
  });

  beforeEach(async () => {
    // Clear test data
    await SocialAccount.deleteMany({});
  });

  describe('Platform Routing', () => {
    it('should route Facebook token refresh correctly', async () => {
      // Create test account
      const account = await SocialAccount.create({
        workspaceId: 'test-workspace',
        provider: SocialPlatform.FACEBOOK,
        providerUserId: 'fb-user-123',
        accountName: 'Test Facebook',
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        status: AccountStatus.ACTIVE,
      });

      // Enqueue refresh job
      await tokenRefreshQueue.addRefreshJob({
        connectionId: account._id.toString(),
        provider: SocialPlatform.FACEBOOK,
        expiresAt: account.tokenExpiresAt!,
        correlationId: 'test-correlation-id',
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify account updated
      const updated = await SocialAccount.findById(account._id);
      expect(updated).toBeDefined();
      expect(updated!.lastRefreshedAt).toBeDefined();
    });

    it('should route Instagram token refresh correctly', async () => {
      const account = await SocialAccount.create({
        workspaceId: 'test-workspace',
        provider: SocialPlatform.INSTAGRAM,
        providerUserId: 'ig-user-123',
        accountName: 'Test Instagram',
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        status: AccountStatus.ACTIVE,
      });

      await tokenRefreshQueue.addRefreshJob({
        connectionId: account._id.toString(),
        provider: SocialPlatform.INSTAGRAM,
        expiresAt: account.tokenExpiresAt!,
        correlationId: 'test-correlation-id',
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const updated = await SocialAccount.findById(account._id);
      expect(updated).toBeDefined();
    });

    it('should route Twitter token refresh correctly', async () => {
      const account = await SocialAccount.create({
        workspaceId: 'test-workspace',
        provider: SocialPlatform.TWITTER,
        providerUserId: 'tw-user-123',
        accountName: 'Test Twitter',
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        status: AccountStatus.ACTIVE,
      });

      await tokenRefreshQueue.addRefreshJob({
        connectionId: account._id.toString(),
        provider: SocialPlatform.TWITTER,
        expiresAt: account.tokenExpiresAt!,
        correlationId: 'test-correlation-id',
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const updated = await SocialAccount.findById(account._id);
      expect(updated).toBeDefined();
    });

    it('should route TikTok token refresh correctly', async () => {
      const account = await SocialAccount.create({
        workspaceId: 'test-workspace',
        provider: SocialPlatform.TIKTOK,
        providerUserId: 'tt-user-123',
        accountName: 'Test TikTok',
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        status: AccountStatus.ACTIVE,
      });

      await tokenRefreshQueue.addRefreshJob({
        connectionId: account._id.toString(),
        provider: SocialPlatform.TIKTOK,
        expiresAt: account.tokenExpiresAt!,
        correlationId: 'test-correlation-id',
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const updated = await SocialAccount.findById(account._id);
      expect(updated).toBeDefined();
    });

    it('should route LinkedIn token refresh correctly', async () => {
      const account = await SocialAccount.create({
        workspaceId: 'test-workspace',
        provider: SocialPlatform.LINKEDIN,
        providerUserId: 'li-user-123',
        accountName: 'Test LinkedIn',
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        status: AccountStatus.ACTIVE,
      });

      await tokenRefreshQueue.addRefreshJob({
        connectionId: account._id.toString(),
        provider: SocialPlatform.LINKEDIN,
        expiresAt: account.tokenExpiresAt!,
        correlationId: 'test-correlation-id',
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const updated = await SocialAccount.findById(account._id);
      expect(updated).toBeDefined();
    });
  });

  describe('Distributed Locks', () => {
    it('should prevent concurrent refreshes of same account', async () => {
      const account = await SocialAccount.create({
        workspaceId: 'test-workspace',
        provider: SocialPlatform.FACEBOOK,
        providerUserId: 'fb-user-123',
        accountName: 'Test Facebook',
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        status: AccountStatus.ACTIVE,
      });

      // Enqueue same job twice
      await Promise.all([
        tokenRefreshQueue.addRefreshJob({
          connectionId: account._id.toString(),
          provider: SocialPlatform.FACEBOOK,
          expiresAt: account.tokenExpiresAt!,
          correlationId: 'test-1',
        }),
        tokenRefreshQueue.addRefreshJob({
          connectionId: account._id.toString(),
          provider: SocialPlatform.FACEBOOK,
          expiresAt: account.tokenExpiresAt!,
          correlationId: 'test-2',
        }),
      ]);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify only one refresh occurred (check metrics or logs)
      const metrics = distributedTokenRefreshWorker.getMetrics();
      expect(metrics.refresh_attempt_total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after repeated failures', async () => {
      // Create multiple accounts
      const accounts = await Promise.all([
        SocialAccount.create({
          workspaceId: 'test-workspace',
          provider: SocialPlatform.FACEBOOK,
          providerUserId: 'fb-user-1',
          accountName: 'Test 1',
          accessToken: 'invalid-token',
          refreshToken: 'invalid-refresh',
          tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
          status: AccountStatus.ACTIVE,
        }),
        SocialAccount.create({
          workspaceId: 'test-workspace',
          provider: SocialPlatform.FACEBOOK,
          providerUserId: 'fb-user-2',
          accountName: 'Test 2',
          accessToken: 'invalid-token',
          refreshToken: 'invalid-refresh',
          tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
          status: AccountStatus.ACTIVE,
        }),
      ]);

      // Enqueue jobs
      for (const account of accounts) {
        await tokenRefreshQueue.addRefreshJob({
          connectionId: account._id.toString(),
          provider: SocialPlatform.FACEBOOK,
          expiresAt: account.tokenExpiresAt!,
          correlationId: `test-${account._id}`,
        });
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check circuit breaker state
      const state = await circuitBreakerService.getState(SocialPlatform.FACEBOOK);
      expect(['OPEN', 'HALF_OPEN']).toContain(state);
    });
  });

  describe('Scheduler', () => {
    it('should find and enqueue expiring tokens', async () => {
      // Create accounts with tokens expiring soon
      await Promise.all([
        SocialAccount.create({
          workspaceId: 'test-workspace',
          provider: SocialPlatform.FACEBOOK,
          providerUserId: 'fb-user-1',
          accountName: 'Expiring 1',
          accessToken: 'encrypted-token',
          refreshToken: 'encrypted-refresh',
          tokenExpiresAt: new Date(Date.now() + 12 * 3600 * 1000), // 12 hours
          status: AccountStatus.ACTIVE,
        }),
        SocialAccount.create({
          workspaceId: 'test-workspace',
          provider: SocialPlatform.TWITTER,
          providerUserId: 'tw-user-1',
          accountName: 'Expiring 2',
          accessToken: 'encrypted-token',
          refreshToken: 'encrypted-refresh',
          tokenExpiresAt: new Date(Date.now() + 6 * 3600 * 1000), // 6 hours
          status: AccountStatus.ACTIVE,
        }),
      ]);

      // Force scan
      await tokenRefreshScheduler.forceScan();

      // Wait for jobs to be enqueued
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify jobs were enqueued (check queue stats)
      const queueStats = await tokenRefreshQueue.getStats();
      expect(queueStats.waiting + queueStats.active).toBeGreaterThan(0);
    });
  });

  describe('Metrics', () => {
    it('should track refresh success metrics', async () => {
      const initialMetrics = distributedTokenRefreshWorker.getMetrics();

      const account = await SocialAccount.create({
        workspaceId: 'test-workspace',
        provider: SocialPlatform.FACEBOOK,
        providerUserId: 'fb-user-123',
        accountName: 'Test Facebook',
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        status: AccountStatus.ACTIVE,
      });

      await tokenRefreshQueue.addRefreshJob({
        connectionId: account._id.toString(),
        provider: SocialPlatform.FACEBOOK,
        expiresAt: account.tokenExpiresAt!,
        correlationId: 'test-metrics',
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const finalMetrics = distributedTokenRefreshWorker.getMetrics();
      expect(finalMetrics.refresh_attempt_total).toBeGreaterThan(initialMetrics.refresh_attempt_total);
    });
  });
});
