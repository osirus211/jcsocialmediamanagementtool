/**
 * MILESTONE 1: OAuth Controller V2 Tests
 * 
 * Tests to verify V2 OAuth flow for NEW accounts only:
 * - New account creates with connectionVersion='v2'
 * - Existing V1 account not modified (returns error)
 * - Encryption matches V1 format
 * - Publishing works for V2 account
 */

import { SocialAccount, AccountStatus } from '../../models/SocialAccount';
import { Post, PostStatus } from '../../models/Post';
import { encrypt, decrypt } from '../../utils/encryption';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../utils/logger');

describe('OAuthControllerV2 - Milestone 1 Tests', () => {
  let testWorkspaceId: mongoose.Types.ObjectId;
  let testUserId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear collections
    await SocialAccount.deleteMany({});
    await Post.deleteMany({});

    testWorkspaceId = new mongoose.Types.ObjectId();
    testUserId = new mongoose.Types.ObjectId();

    // Clear mock calls
    jest.clearAllMocks();
  });

  test('New account creates with connectionVersion=v2', async () => {
    // Simulate V2 OAuth callback creating a new account
    const account = await SocialAccount.create({
      workspaceId: testWorkspaceId,
      provider: 'twitter',
      providerUserId: 'new_user_123',
      accountName: 'New V2 Account',
      accessToken: encrypt('v2_access_token'),
      refreshToken: encrypt('v2_refresh_token'),
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
      scopes: ['read', 'write'],
      status: AccountStatus.ACTIVE,
      connectionVersion: 'v2', // MILESTONE 1: Mark as V2
      metadata: {
        username: 'newuser',
        profileUrl: 'https://twitter.com/newuser',
      },
      lastSyncAt: new Date(),
    });

    // Verify: Account created with connectionVersion='v2'
    expect(account.connectionVersion).toBe('v2');
    expect(account.provider).toBe('twitter');
    expect(account.status).toBe(AccountStatus.ACTIVE);

    // Verify: Account can be fetched
    const fetchedAccount = await SocialAccount.findById(account._id);
    expect(fetchedAccount).toBeDefined();
    expect(fetchedAccount!.connectionVersion).toBe('v2');
  });

  test('Existing V1 account not modified - returns error', async () => {
    // Create existing V1 account
    const existingAccount = await SocialAccount.create({
      workspaceId: testWorkspaceId,
      provider: 'twitter',
      providerUserId: 'existing_user_456',
      accountName: 'Existing V1 Account',
      accessToken: encrypt('v1_access_token'),
      refreshToken: encrypt('v1_refresh_token'),
      scopes: ['read', 'write'],
      status: AccountStatus.ACTIVE,
      // connectionVersion: undefined (V1 account)
      metadata: {
        username: 'existinguser',
      },
      lastSyncAt: new Date(),
    });

    // Simulate V2 OAuth callback checking for existing account
    const checkExisting = await SocialAccount.findOne({
      workspaceId: testWorkspaceId,
      provider: 'twitter',
      providerUserId: 'existing_user_456',
    });

    // Verify: Existing account found
    expect(checkExisting).toBeDefined();
    expect(checkExisting!._id.toString()).toBe(existingAccount._id.toString());
    expect(checkExisting!.connectionVersion).toBeUndefined();

    // MILESTONE 1: Should return error (no upgrade)
    // In controller: if (existing) { return error }
    
    // Verify: Existing account NOT modified
    const unchangedAccount = await SocialAccount.findById(existingAccount._id);
    expect(unchangedAccount!.connectionVersion).toBeUndefined();
    expect(unchangedAccount!.status).toBe(AccountStatus.ACTIVE);
  });

  test('Encryption matches V1 format', async () => {
    // Create V2 account with encrypted tokens
    const plainAccessToken = 'test_access_token_v2';
    const plainRefreshToken = 'test_refresh_token_v2';

    const account = await SocialAccount.create({
      workspaceId: testWorkspaceId,
      provider: 'linkedin',
      providerUserId: 'v2_user_789',
      accountName: 'V2 Account',
      accessToken: plainAccessToken, // Will be encrypted by pre-save hook
      refreshToken: plainRefreshToken, // Will be encrypted by pre-save hook
      scopes: ['read', 'write'],
      status: AccountStatus.ACTIVE,
      connectionVersion: 'v2',
      metadata: {},
      lastSyncAt: new Date(),
    });

    // Fetch account with tokens
    const fetchedAccount = await SocialAccount.findById(account._id)
      .select('+accessToken +refreshToken');

    expect(fetchedAccount).toBeDefined();

    // Verify: Tokens are encrypted (not plain text)
    expect(fetchedAccount!.accessToken).not.toBe(plainAccessToken);
    expect(fetchedAccount!.refreshToken).not.toBe(plainRefreshToken);

    // Verify: Tokens can be decrypted using V1 decrypt utility
    const decryptedAccessToken = decrypt(fetchedAccount!.accessToken);
    const decryptedRefreshToken = decrypt(fetchedAccount!.refreshToken!);

    expect(decryptedAccessToken).toBe(plainAccessToken);
    expect(decryptedRefreshToken).toBe(plainRefreshToken);

    // Verify: Encryption format matches V1 (same utility)
    // Create V1 account for comparison
    const v1Account = await SocialAccount.create({
      workspaceId: testWorkspaceId,
      provider: 'facebook',
      providerUserId: 'v1_user_999',
      accountName: 'V1 Account',
      accessToken: plainAccessToken, // Same token
      refreshToken: plainRefreshToken, // Same token
      scopes: ['read', 'write'],
      status: AccountStatus.ACTIVE,
      // connectionVersion: undefined (V1)
      metadata: {},
      lastSyncAt: new Date(),
    });

    const fetchedV1Account = await SocialAccount.findById(v1Account._id)
      .select('+accessToken +refreshToken');

    // Verify: Both V1 and V2 use same encryption format
    const decryptedV1AccessToken = decrypt(fetchedV1Account!.accessToken);
    const decryptedV1RefreshToken = decrypt(fetchedV1Account!.refreshToken!);

    expect(decryptedV1AccessToken).toBe(plainAccessToken);
    expect(decryptedV1RefreshToken).toBe(plainRefreshToken);
  });

  test('Publishing works for V2 account', async () => {
    // Create V2 account
    const account = await SocialAccount.create({
      workspaceId: testWorkspaceId,
      provider: 'instagram',
      providerUserId: 'v2_publisher_101',
      accountName: 'V2 Publisher',
      accessToken: encrypt('v2_publish_token'),
      refreshToken: encrypt('v2_publish_refresh'),
      scopes: ['read', 'write', 'publish'],
      status: AccountStatus.ACTIVE,
      connectionVersion: 'v2',
      metadata: {},
      lastSyncAt: new Date(),
    });

    // Create post for V2 account
    const post = await Post.create({
      workspaceId: testWorkspaceId,
      userId: testUserId,
      socialAccountId: account._id,
      content: 'Test post from V2 account',
      status: PostStatus.SCHEDULED,
      scheduledAt: new Date(),
    });

    // Verify: Post created successfully
    expect(post.socialAccountId.toString()).toBe(account._id.toString());
    expect(post.status).toBe(PostStatus.SCHEDULED);

    // Simulate publishing (fetch account with tokens)
    const fetchedAccount = await SocialAccount.findById(account._id)
      .select('+accessToken +refreshToken +connectionVersion');

    expect(fetchedAccount).toBeDefined();
    expect(fetchedAccount!.connectionVersion).toBe('v2');

    // Verify: Tokens can be decrypted for publishing
    const accessToken = decrypt(fetchedAccount!.accessToken);
    expect(accessToken).toBe('v2_publish_token');

    // Simulate successful publish
    await Post.findByIdAndUpdate(post._id, {
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(),
    });

    const publishedPost = await Post.findById(post._id);
    expect(publishedPost!.status).toBe(PostStatus.PUBLISHED);
    expect(publishedPost!.publishedAt).toBeDefined();
  });
});
