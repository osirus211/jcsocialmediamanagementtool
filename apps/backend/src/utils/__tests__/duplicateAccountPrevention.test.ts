/**
 * Duplicate Account Prevention Tests
 * 
 * Tests duplicate account detection and prevention
 */

import {
  assertNoDuplicateAccount,
  isDuplicateAccount,
  getExistingAccount,
  DuplicateAccountError,
} from '../duplicateAccountPrevention';
import { SocialAccount, SocialPlatform, AccountStatus } from '../../models/SocialAccount';
import mongoose from 'mongoose';

// Mock the SocialAccount model
jest.mock('../../models/SocialAccount');

describe('Duplicate Account Prevention', () => {
  const mockWorkspaceId = new mongoose.Types.ObjectId();
  const mockAccountId = new mongoose.Types.ObjectId();
  const provider = SocialPlatform.INSTAGRAM;
  const providerUserId = 'instagram123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('assertNoDuplicateAccount', () => {
    it('should not throw when no duplicate exists', async () => {
      (SocialAccount.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        assertNoDuplicateAccount(mockWorkspaceId, provider, providerUserId)
      ).resolves.not.toThrow();

      expect(SocialAccount.findOne).toHaveBeenCalledWith({
        workspaceId: mockWorkspaceId,
        provider,
        providerUserId,
      });
    });

    it('should throw DuplicateAccountError when duplicate exists', async () => {
      const existingAccount = {
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        provider,
        providerUserId,
        accountName: 'existinguser',
        status: AccountStatus.ACTIVE,
      };

      (SocialAccount.findOne as jest.Mock).mockResolvedValue(existingAccount);

      await expect(
        assertNoDuplicateAccount(mockWorkspaceId, provider, providerUserId)
      ).rejects.toThrow(DuplicateAccountError);
    });

    it('should include provider and providerUserId in error', async () => {
      const existingAccount = {
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        provider,
        providerUserId,
        accountName: 'existinguser',
      };

      (SocialAccount.findOne as jest.Mock).mockResolvedValue(existingAccount);

      try {
        await assertNoDuplicateAccount(mockWorkspaceId, provider, providerUserId);
        fail('Should have thrown DuplicateAccountError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(DuplicateAccountError);
        expect(error.provider).toBe(provider);
        expect(error.providerUserId).toBe(providerUserId);
        expect(error.existingAccountId).toBe(mockAccountId.toString());
      }
    });

    it('should have 409 status code', async () => {
      const existingAccount = {
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        provider,
        providerUserId,
        accountName: 'existinguser',
      };

      (SocialAccount.findOne as jest.Mock).mockResolvedValue(existingAccount);

      try {
        await assertNoDuplicateAccount(mockWorkspaceId, provider, providerUserId);
        fail('Should have thrown DuplicateAccountError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(DuplicateAccountError);
        expect(error.statusCode).toBe(409);
      }
    });

    it('should include helpful error message', async () => {
      const existingAccount = {
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        provider,
        providerUserId,
        accountName: 'existinguser',
      };

      (SocialAccount.findOne as jest.Mock).mockResolvedValue(existingAccount);

      try {
        await assertNoDuplicateAccount(mockWorkspaceId, provider, providerUserId);
        fail('Should have thrown DuplicateAccountError');
      } catch (error: any) {
        expect(error.message).toContain('already connected');
        expect(error.message).toContain('workspace');
        expect(error.message).toContain('disconnect');
      }
    });
  });

  describe('isDuplicateAccount', () => {
    it('should return false when no duplicate exists', async () => {
      (SocialAccount.findOne as jest.Mock).mockResolvedValue(null);

      const result = await isDuplicateAccount(mockWorkspaceId, provider, providerUserId);

      expect(result).toBe(false);
    });

    it('should return true when duplicate exists', async () => {
      const existingAccount = {
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        provider,
        providerUserId,
        accountName: 'existinguser',
      };

      (SocialAccount.findOne as jest.Mock).mockResolvedValue(existingAccount);

      const result = await isDuplicateAccount(mockWorkspaceId, provider, providerUserId);

      expect(result).toBe(true);
    });
  });

  describe('getExistingAccount', () => {
    it('should return null when no account exists', async () => {
      (SocialAccount.findOne as jest.Mock).mockResolvedValue(null);

      const result = await getExistingAccount(mockWorkspaceId, provider, providerUserId);

      expect(result).toBeNull();
    });

    it('should return account when it exists', async () => {
      const existingAccount = {
        _id: mockAccountId,
        workspaceId: mockWorkspaceId,
        provider,
        providerUserId,
        accountName: 'existinguser',
      };

      (SocialAccount.findOne as jest.Mock).mockResolvedValue(existingAccount);

      const result = await getExistingAccount(mockWorkspaceId, provider, providerUserId);

      expect(result).toEqual(existingAccount);
    });
  });

  describe('Query Parameters', () => {
    it('should query with correct parameters', async () => {
      (SocialAccount.findOne as jest.Mock).mockResolvedValue(null);

      await assertNoDuplicateAccount(mockWorkspaceId, provider, providerUserId);

      expect(SocialAccount.findOne).toHaveBeenCalledWith({
        workspaceId: mockWorkspaceId,
        provider,
        providerUserId,
      });
    });

    it('should handle string workspaceId', async () => {
      (SocialAccount.findOne as jest.Mock).mockResolvedValue(null);

      const workspaceIdString = mockWorkspaceId.toString();
      await assertNoDuplicateAccount(workspaceIdString, provider, providerUserId);

      expect(SocialAccount.findOne).toHaveBeenCalledWith({
        workspaceId: workspaceIdString,
        provider,
        providerUserId,
      });
    });
  });
});
