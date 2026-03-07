/**
 * Rollback Script Tests - Milestone 2
 * 
 * Tests:
 * 1. Rollback single account
 * 2. Rollback multiple accounts
 * 3. Rollback idempotency
 * 4. Rollback blocked under active publish
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SocialAccount, SocialPlatform, AccountStatus } from '../../src/models/SocialAccount';
import { rollbackV2ToV1, rollbackAccount, isQueueDrained } from '../rollback-v2-to-v1';
import { Queue } from 'bullmq';

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock config
jest.mock('../../src/config', () => ({
  config: {
    database: {
      uri: 'mongodb://localhost:27017/test',
    },
    redis: {
      host: 'localhost',
      port: 6379,
      password: undefined,
    },
  },
}));

describe('Rollback V2→V1 Script - Milestone 2', () => {
  let mongoServer: MongoMemoryServer;
  let testWorkspaceId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await SocialAccount.deleteMany({});
    testWorkspaceId = new mongoose.Types.ObjectId();
  });

  /**
   * TEST 1: Rollback single account
   */
  describe('Test 1: Rollback single account', () => {
    it('should rollback a single V2 account to V1', async () => {
      // Create V2 account
      const account = await SocialAccount.create({
        workspaceId: testWorkspaceId,
        provider: SocialPlatform.TWITTER,
        providerUserId: 'test-user-1',
        accountName: 'Test User',
        accessToken: 'encrypted-token',
        refreshToken: 'encrypted-refresh',
        status: AccountStatus.ACTIVE,
        connectionVersion: 'v2',
      });

      // Rollback
      const result = await rollbackAccount(account._id, false);

      // Verify
      expect(result).toBe('rolled_back');

      const updated = await SocialAccount.findById(account._id);
      expect(updated?.connectionVersion).toBe('v1');
      expect(updated?.accessToken).toBe('encrypted-token'); // Preserved
      expect(updated?.refreshToken).toBe('encrypted-refresh'); // Preserved
    });

    it('should preserve all account data during rollback', async () => {
      // Create V2 account with full data
      const account = await SocialAccount.create({
        workspaceId: testWorkspaceId,
        provider: SocialPlatform.LINKEDIN,
        providerUserId: 'linkedin-user',
        accountName: 'LinkedIn User',
        accessToken: 'encrypted-access',
        refreshToken: 'encrypted-refresh',
        tokenExpiresAt: new Date(Date.now() + 3600000),
        scopes: ['read', 'write'],
        status: AccountStatus.ACTIVE,
        connectionVersion: 'v2',
        metadata: {
          username: 'linkedinuser',
          email: 'user@example.com',
          followerCount: 500,
        },
      });

      // Rollback
      await rollbackAccount(account._id, false);

      // Verify all data preserved
      const updated = await SocialAccount.findById(account._id);
      expect(updated?.connectionVersion).toBe('v1');
      expect(updated?.provider).toBe(SocialPlatform.LINKEDIN);
      expect(updated?.accessToken).toBe('encrypted-access');
      expect(updated?.refreshToken).toBe('encrypted-refresh');
      expect(updated?.scopes).toEqual(['read', 'write']);
      expect(updated?.metadata?.username).toBe('linkedinuser');
      expect(updated?.metadata?.followerCount).toBe(500);
    });
  });

  /**
   * TEST 2: Rollback multiple accounts
   */
  describe('Test 2: Rollback multiple accounts', () => {
    it('should rollback multiple V2 accounts', async () => {
      // Create 3 V2 accounts
      await SocialAccount.create([
        {
          workspaceId: testWorkspaceId,
          provider: SocialPlatform.TWITTER,
          providerUserId: 'user-1',
          accountName: 'User 1',
          accessToken: 'token-1',
          status: AccountStatus.ACTIVE,
          connectionVersion: 'v2',
        },
        {
          workspaceId: testWorkspaceId,
          provider: SocialPlatform.FACEBOOK,
          providerUserId: 'user-2',
          accountName: 'User 2',
          accessToken: 'token-2',
          status: AccountStatus.ACTIVE,
          connectionVersion: 'v2',
        },
        {
          workspaceId: testWorkspaceId,
          provider: SocialPlatform.LINKEDIN,
          providerUserId: 'user-3',
          accountName: 'User 3',
          accessToken: 'token-3',
          status: AccountStatus.ACTIVE,
          connectionVersion: 'v2',
        },
      ]);

      // Rollback all (dry run first)
      const dryRunStats = await rollbackV2ToV1(true);
      expect(dryRunStats.totalV2Accounts).toBe(3);
      expect(dryRunStats.rolledBack).toBe(3);

      // Verify still V2 after dry run
      const stillV2 = await SocialAccount.countDocuments({ connectionVersion: 'v2' });
      expect(stillV2).toBe(3);

      // Execute rollback
      const stats = await rollbackV2ToV1(false);
      expect(stats.totalV2Accounts).toBe(3);
      expect(stats.rolledBack).toBe(3);
      expect(stats.errors).toBe(0);

      // Verify all rolled back
      const v2Count = await SocialAccount.countDocuments({ connectionVersion: 'v2' });
      const v1Count = await SocialAccount.countDocuments({ connectionVersion: 'v1' });
      expect(v2Count).toBe(0);
      expect(v1Count).toBe(3);
    });

    it('should handle mixed V1 and V2 accounts', async () => {
      // Create 2 V1 and 2 V2 accounts
      await SocialAccount.create([
        {
          workspaceId: testWorkspaceId,
          provider: SocialPlatform.TWITTER,
          providerUserId: 'v1-user-1',
          accountName: 'V1 User 1',
          accessToken: 'token-1',
          status: AccountStatus.ACTIVE,
          connectionVersion: 'v1',
        },
        {
          workspaceId: testWorkspaceId,
          provider: SocialPlatform.FACEBOOK,
          providerUserId: 'v2-user-1',
          accountName: 'V2 User 1',
          accessToken: 'token-2',
          status: AccountStatus.ACTIVE,
          connectionVersion: 'v2',
        },
        {
          workspaceId: testWorkspaceId,
          provider: SocialPlatform.LINKEDIN,
          providerUserId: 'v1-user-2',
          accountName: 'V1 User 2',
          accessToken: 'token-3',
          status: AccountStatus.ACTIVE,
          connectionVersion: 'v1',
        },
        {
          workspaceId: testWorkspaceId,
          provider: SocialPlatform.INSTAGRAM,
          providerUserId: 'v2-user-2',
          accountName: 'V2 User 2',
          accessToken: 'token-4',
          status: AccountStatus.ACTIVE,
          connectionVersion: 'v2',
        },
      ]);

      // Rollback
      const stats = await rollbackV2ToV1(false);
      expect(stats.totalV2Accounts).toBe(2);
      expect(stats.rolledBack).toBe(2);

      // Verify final state
      const v2Count = await SocialAccount.countDocuments({ connectionVersion: 'v2' });
      const v1Count = await SocialAccount.countDocuments({ connectionVersion: 'v1' });
      expect(v2Count).toBe(0);
      expect(v1Count).toBe(4);
    });
  });

  /**
   * TEST 3: Rollback idempotency
   */
  describe('Test 3: Rollback idempotency', () => {
    it('should be safe to run rollback twice', async () => {
      // Create V2 account
      const account = await SocialAccount.create({
        workspaceId: testWorkspaceId,
        provider: SocialPlatform.TWITTER,
        providerUserId: 'test-user',
        accountName: 'Test User',
        accessToken: 'encrypted-token',
        status: AccountStatus.ACTIVE,
        connectionVersion: 'v2',
      });

      // First rollback
      const result1 = await rollbackAccount(account._id, false);
      expect(result1).toBe('rolled_back');

      const after1 = await SocialAccount.findById(account._id);
      expect(after1?.connectionVersion).toBe('v1');

      // Second rollback (idempotent)
      const result2 = await rollbackAccount(account._id, false);
      expect(result2).toBe('already_v1');

      const after2 = await SocialAccount.findById(account._id);
      expect(after2?.connectionVersion).toBe('v1');
      expect(after2?.accessToken).toBe('encrypted-token'); // Still preserved
    });

    it('should handle undefined connectionVersion as V1', async () => {
      // Create account without connectionVersion (legacy V1)
      const account = await SocialAccount.create({
        workspaceId: testWorkspaceId,
        provider: SocialPlatform.TWITTER,
        providerUserId: 'legacy-user',
        accountName: 'Legacy User',
        accessToken: 'encrypted-token',
        status: AccountStatus.ACTIVE,
        // connectionVersion: undefined (not set)
      });

      // Rollback should recognize as already V1
      const result = await rollbackAccount(account._id, false);
      expect(result).toBe('already_v1');

      const updated = await SocialAccount.findById(account._id);
      expect(updated?.connectionVersion).toBeUndefined();
    });

    it('should handle full rollback script idempotency', async () => {
      // Create 2 V2 accounts
      await SocialAccount.create([
        {
          workspaceId: testWorkspaceId,
          provider: SocialPlatform.TWITTER,
          providerUserId: 'user-1',
          accountName: 'User 1',
          accessToken: 'token-1',
          status: AccountStatus.ACTIVE,
          connectionVersion: 'v2',
        },
        {
          workspaceId: testWorkspaceId,
          provider: SocialPlatform.FACEBOOK,
          providerUserId: 'user-2',
          accountName: 'User 2',
          accessToken: 'token-2',
          status: AccountStatus.ACTIVE,
          connectionVersion: 'v2',
        },
      ]);

      // First run
      const stats1 = await rollbackV2ToV1(false);
      expect(stats1.totalV2Accounts).toBe(2);
      expect(stats1.rolledBack).toBe(2);
      expect(stats1.alreadyV1).toBe(0);

      // Second run (idempotent)
      const stats2 = await rollbackV2ToV1(false);
      expect(stats2.totalV2Accounts).toBe(0); // No V2 accounts found
      expect(stats2.rolledBack).toBe(0);
    });
  });

  /**
   * TEST 4: Rollback blocked under active publish
   */
  describe('Test 4: Rollback blocked under active publish', () => {
    it('should detect queue is drained when Redis unavailable', async () => {
      // Mock Queue to simulate Redis unavailable
      jest.spyOn(Queue.prototype, 'getWaitingCount').mockRejectedValue(new Error('Redis unavailable'));

      const { safe, status } = await isQueueDrained();

      // Should assume safe when Redis unavailable (no queue = no jobs)
      expect(safe).toBe(true);
      expect(status.waiting).toBe(0);
      expect(status.active).toBe(0);
    });

    it('should block rollback when queue has active jobs', async () => {
      // Mock Queue to simulate active jobs
      jest.spyOn(Queue.prototype, 'getWaitingCount').mockResolvedValue(0);
      jest.spyOn(Queue.prototype, 'getActiveCount').mockResolvedValue(5); // Active jobs
      jest.spyOn(Queue.prototype, 'getDelayedCount').mockResolvedValue(0);
      jest.spyOn(Queue.prototype, 'getFailedCount').mockResolvedValue(0);
      jest.spyOn(Queue.prototype, 'close').mockResolvedValue();

      const { safe, status } = await isQueueDrained();

      expect(safe).toBe(false);
      expect(status.active).toBe(5);
    });

    it('should block rollback when queue has waiting jobs', async () => {
      // Mock Queue to simulate waiting jobs
      jest.spyOn(Queue.prototype, 'getWaitingCount').mockResolvedValue(10); // Waiting jobs
      jest.spyOn(Queue.prototype, 'getActiveCount').mockResolvedValue(0);
      jest.spyOn(Queue.prototype, 'getDelayedCount').mockResolvedValue(0);
      jest.spyOn(Queue.prototype, 'getFailedCount').mockResolvedValue(0);
      jest.spyOn(Queue.prototype, 'close').mockResolvedValue();

      const { safe, status } = await isQueueDrained();

      expect(safe).toBe(false);
      expect(status.waiting).toBe(10);
    });

    it('should allow rollback when queue is fully drained', async () => {
      // Mock Queue to simulate drained queue
      jest.spyOn(Queue.prototype, 'getWaitingCount').mockResolvedValue(0);
      jest.spyOn(Queue.prototype, 'getActiveCount').mockResolvedValue(0);
      jest.spyOn(Queue.prototype, 'getDelayedCount').mockResolvedValue(0);
      jest.spyOn(Queue.prototype, 'getFailedCount').mockResolvedValue(2); // Failed jobs OK
      jest.spyOn(Queue.prototype, 'close').mockResolvedValue();

      const { safe, status } = await isQueueDrained();

      expect(safe).toBe(true);
      expect(status.waiting).toBe(0);
      expect(status.active).toBe(0);
      expect(status.failed).toBe(2); // Failed jobs don't block
    });
  });
});
