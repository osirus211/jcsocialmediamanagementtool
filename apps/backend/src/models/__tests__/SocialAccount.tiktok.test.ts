import mongoose from 'mongoose';
import { SocialAccount, SocialPlatform, AccountStatus } from '../SocialAccount';
import { encrypt } from '../../utils/encryption';

/**
 * Test suite for SocialAccount model with TikTok provider
 * 
 * Validates:
 * - TikTok enum value exists in SocialPlatform
 * - SocialAccount can store TikTok accounts with proper metadata
 * - Token encryption works for TikTok accounts
 * - Metadata structure supports TikTok-specific fields
 */

describe('SocialAccount - TikTok Integration', () => {
  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
  });

  afterAll(async () => {
    // Clean up and close connection
    await SocialAccount.deleteMany({ provider: SocialPlatform.TIKTOK });
    await mongoose.connection.close();
  });

  afterEach(async () => {
    // Clean up after each test
    await SocialAccount.deleteMany({ provider: SocialPlatform.TIKTOK });
  });

  describe('TikTok Platform Support', () => {
    it('should have TIKTOK in SocialPlatform enum', () => {
      expect(SocialPlatform.TIKTOK).toBe('tiktok');
      expect(Object.values(SocialPlatform)).toContain('tiktok');
    });

    it('should create a TikTok social account with required fields', async () => {
      const workspaceId = new mongoose.Types.ObjectId();
      const tiktokAccount = new SocialAccount({
        workspaceId,
        provider: SocialPlatform.TIKTOK,
        providerUserId: '1234567890',
        accountName: 'testuser',
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token',
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        scopes: ['user.info.basic', 'video.upload', 'video.publish'],
        status: AccountStatus.ACTIVE,
        connectionVersion: 'v2',
        metadata: {
          username: 'testuser',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
          profileUrl: 'https://tiktok.com/@testuser',
        },
      });

      const savedAccount = await tiktokAccount.save();

      expect(savedAccount.provider).toBe(SocialPlatform.TIKTOK);
      expect(savedAccount.providerUserId).toBe('1234567890');
      expect(savedAccount.accountName).toBe('testuser');
      expect(savedAccount.scopes).toEqual(['user.info.basic', 'video.upload', 'video.publish']);
      expect(savedAccount.status).toBe(AccountStatus.ACTIVE);
      expect(savedAccount.connectionVersion).toBe('v2');
    });

    it('should store TikTok metadata with correct structure', async () => {
      const workspaceId = new mongoose.Types.ObjectId();
      const metadata = {
        username: 'tiktokuser',
        displayName: 'TikTok User',
        avatarUrl: 'https://example.com/avatar.jpg',
        profileUrl: 'https://tiktok.com/@tiktokuser',
      };

      const tiktokAccount = new SocialAccount({
        workspaceId,
        provider: SocialPlatform.TIKTOK,
        providerUserId: '9876543210',
        accountName: 'tiktokuser',
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token',
        scopes: ['user.info.basic', 'video.upload', 'video.publish'],
        metadata,
      });

      const savedAccount = await tiktokAccount.save();

      expect(savedAccount.metadata).toBeDefined();
      expect(savedAccount.metadata.username).toBe('tiktokuser');
      expect(savedAccount.metadata.displayName).toBe('TikTok User');
      expect(savedAccount.metadata.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(savedAccount.metadata.profileUrl).toBe('https://tiktok.com/@tiktokuser');
    });

    it('should encrypt access token and refresh token for TikTok accounts', async () => {
      const workspaceId = new mongoose.Types.ObjectId();
      const plainAccessToken = 'plain_access_token_123';
      const plainRefreshToken = 'plain_refresh_token_456';

      const tiktokAccount = new SocialAccount({
        workspaceId,
        provider: SocialPlatform.TIKTOK,
        providerUserId: '1111111111',
        accountName: 'encrypteduser',
        accessToken: plainAccessToken,
        refreshToken: plainRefreshToken,
        scopes: ['user.info.basic', 'video.upload', 'video.publish'],
        metadata: {
          username: 'encrypteduser',
          displayName: 'Encrypted User',
        },
      });

      const savedAccount = await tiktokAccount.save();

      // Fetch with tokens selected
      const fetchedAccount = await SocialAccount.findById(savedAccount._id).select('+accessToken +refreshToken');

      expect(fetchedAccount).toBeDefined();
      expect(fetchedAccount!.accessToken).not.toBe(plainAccessToken);
      expect(fetchedAccount!.refreshToken).not.toBe(plainRefreshToken);

      // Verify decryption works
      expect(fetchedAccount!.getDecryptedAccessToken()).toBe(plainAccessToken);
      expect(fetchedAccount!.getDecryptedRefreshToken()).toBe(plainRefreshToken);
    });

    it('should not expose tokens in toJSON output', async () => {
      const workspaceId = new mongoose.Types.ObjectId();
      const tiktokAccount = new SocialAccount({
        workspaceId,
        provider: SocialPlatform.TIKTOK,
        providerUserId: '2222222222',
        accountName: 'jsonuser',
        accessToken: 'secret_access_token',
        refreshToken: 'secret_refresh_token',
        scopes: ['user.info.basic', 'video.upload', 'video.publish'],
        metadata: {
          username: 'jsonuser',
          displayName: 'JSON User',
        },
      });

      const savedAccount = await tiktokAccount.save();
      const jsonOutput = savedAccount.toJSON();

      expect(jsonOutput.accessToken).toBeUndefined();
      expect(jsonOutput.refreshToken).toBeUndefined();
      expect(jsonOutput.provider).toBe(SocialPlatform.TIKTOK);
      expect(jsonOutput.accountName).toBe('jsonuser');
    });

    it('should enforce unique constraint for TikTok accounts per workspace', async () => {
      const workspaceId = new mongoose.Types.ObjectId();
      const providerUserId = '3333333333';

      const account1 = new SocialAccount({
        workspaceId,
        provider: SocialPlatform.TIKTOK,
        providerUserId,
        accountName: 'uniqueuser',
        accessToken: 'token1',
        scopes: ['user.info.basic', 'video.upload', 'video.publish'],
        metadata: { username: 'uniqueuser' },
      });

      await account1.save();

      // Try to create duplicate account
      const account2 = new SocialAccount({
        workspaceId,
        provider: SocialPlatform.TIKTOK,
        providerUserId,
        accountName: 'uniqueuser',
        accessToken: 'token2',
        scopes: ['user.info.basic', 'video.upload', 'video.publish'],
        metadata: { username: 'uniqueuser' },
      });

      await expect(account2.save()).rejects.toThrow();
    });

    it('should allow same TikTok user in different workspaces', async () => {
      const workspace1Id = new mongoose.Types.ObjectId();
      const workspace2Id = new mongoose.Types.ObjectId();
      const providerUserId = '4444444444';

      const account1 = new SocialAccount({
        workspaceId: workspace1Id,
        provider: SocialPlatform.TIKTOK,
        providerUserId,
        accountName: 'multiworkspaceuser',
        accessToken: 'token1',
        scopes: ['user.info.basic', 'video.upload', 'video.publish'],
        metadata: { username: 'multiworkspaceuser' },
      });

      const account2 = new SocialAccount({
        workspaceId: workspace2Id,
        provider: SocialPlatform.TIKTOK,
        providerUserId,
        accountName: 'multiworkspaceuser',
        accessToken: 'token2',
        scopes: ['user.info.basic', 'video.upload', 'video.publish'],
        metadata: { username: 'multiworkspaceuser' },
      });

      await account1.save();
      await account2.save();

      expect(account1._id).not.toEqual(account2._id);
      expect(account1.workspaceId).not.toEqual(account2.workspaceId);
    });

    it('should support TikTok-specific scopes', async () => {
      const workspaceId = new mongoose.Types.ObjectId();
      const tiktokScopes = ['user.info.basic', 'video.upload', 'video.publish'];

      const tiktokAccount = new SocialAccount({
        workspaceId,
        provider: SocialPlatform.TIKTOK,
        providerUserId: '5555555555',
        accountName: 'scopeuser',
        accessToken: 'token',
        scopes: tiktokScopes,
        metadata: { username: 'scopeuser' },
      });

      const savedAccount = await tiktokAccount.save();

      expect(savedAccount.scopes).toEqual(tiktokScopes);
      expect(savedAccount.scopes).toContain('user.info.basic');
      expect(savedAccount.scopes).toContain('video.upload');
      expect(savedAccount.scopes).toContain('video.publish');
    });
  });
});
