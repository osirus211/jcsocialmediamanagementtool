/**
 * Feature Authorization Middleware Tests
 * 
 * Tests feature authorization enforcement for Instagram accounts
 */

import { Request, Response, NextFunction } from 'express';
import { requireFeature } from '../featureAuthorization';
import { Feature } from '../../services/FeatureAuthorizationService';
import { SocialAccount, ProviderType } from '../../models/SocialAccount';
import { Post } from '../../models/Post';

// Mock dependencies
jest.mock('../../models/SocialAccount');
jest.mock('../../models/Post');
jest.mock('../../utils/logger');

describe('Feature Authorization Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      params: {},
      body: {},
      workspace: { workspaceId: 'workspace-123' } as any,
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('Publishing Operations (Feature.PUBLISH)', () => {
    it('should allow publishing for Instagram Business accounts', async () => {
      const mockPost = {
        _id: 'post-123',
        workspaceId: 'workspace-123',
        socialAccountIds: ['account-123'],
      };

      const mockAccount = {
        _id: 'account-123',
        provider: 'instagram',
        providerType: ProviderType.INSTAGRAM_BUSINESS,
      };

      (Post.findOne as jest.Mock).mockResolvedValue(mockPost);
      (SocialAccount.find as jest.Mock).mockResolvedValue([mockAccount]);

      mockRequest.params = { id: 'post-123' };

      const middleware = requireFeature(Feature.PUBLISH);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(Post.findOne).toHaveBeenCalledWith({
        _id: 'post-123',
        workspaceId: 'workspace-123',
      });
      expect(SocialAccount.find).toHaveBeenCalledWith({
        _id: { $in: ['account-123'] },
      });
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should block publishing for Instagram Basic accounts', async () => {
      const mockPost = {
        _id: 'post-123',
        workspaceId: 'workspace-123',
        socialAccountIds: ['account-123'],
      };

      const mockAccount = {
        _id: 'account-123',
        provider: 'instagram',
        providerType: ProviderType.INSTAGRAM_BASIC,
      };

      (Post.findOne as jest.Mock).mockResolvedValue(mockPost);
      (SocialAccount.find as jest.Mock).mockResolvedValue([mockAccount]);

      mockRequest.params = { id: 'post-123' };

      const middleware = requireFeature(Feature.PUBLISH);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'FEATURE_NOT_ALLOWED',
          feature: Feature.PUBLISH,
          providerType: ProviderType.INSTAGRAM_BASIC,
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow publishing for non-Instagram accounts', async () => {
      const mockPost = {
        _id: 'post-123',
        workspaceId: 'workspace-123',
        socialAccountIds: ['account-123'],
      };

      const mockAccount = {
        _id: 'account-123',
        provider: 'twitter',
        providerType: undefined,
      };

      (Post.findOne as jest.Mock).mockResolvedValue(mockPost);
      (SocialAccount.find as jest.Mock).mockResolvedValue([mockAccount]);

      mockRequest.params = { id: 'post-123' };

      const middleware = requireFeature(Feature.PUBLISH);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should not block non-Instagram accounts
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should check all accounts when post has multiple socialAccountIds', async () => {
      const mockPost = {
        _id: 'post-123',
        workspaceId: 'workspace-123',
        socialAccountIds: ['account-1', 'account-2', 'account-3'],
      };

      const mockAccounts = [
        {
          _id: 'account-1',
          provider: 'twitter',
        },
        {
          _id: 'account-2',
          provider: 'instagram',
          providerType: ProviderType.INSTAGRAM_BUSINESS,
        },
        {
          _id: 'account-3',
          provider: 'instagram',
          providerType: ProviderType.INSTAGRAM_BASIC,
        },
      ];

      (Post.findOne as jest.Mock).mockResolvedValue(mockPost);
      (SocialAccount.find as jest.Mock).mockResolvedValue(mockAccounts);

      mockRequest.params = { id: 'post-123' };

      const middleware = requireFeature(Feature.PUBLISH);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should block because one account (INSTAGRAM_BASIC) doesn't allow publishing
      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should return 400 if post not found', async () => {
      (Post.findOne as jest.Mock).mockResolvedValue(null);

      mockRequest.params = { id: 'nonexistent-post' };

      const middleware = requireFeature(Feature.PUBLISH);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Post not found',
        })
      );
    });
  });

  describe('Account-Specific Operations', () => {
    it('should check feature for account in params', async () => {
      const mockAccount = {
        _id: 'account-123',
        provider: 'instagram',
        providerType: ProviderType.INSTAGRAM_BUSINESS,
      };

      (SocialAccount.findById as jest.Mock).mockResolvedValue(mockAccount);

      mockRequest.params = { accountId: 'account-123' };

      const middleware = requireFeature(Feature.INSIGHTS);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(SocialAccount.findById).toHaveBeenCalledWith('account-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should check feature for account in body', async () => {
      const mockAccount = {
        _id: 'account-123',
        provider: 'instagram',
        providerType: ProviderType.INSTAGRAM_BASIC,
      };

      (SocialAccount.findById as jest.Mock).mockResolvedValue(mockAccount);

      mockRequest.body = { accountId: 'account-123' };

      const middleware = requireFeature(Feature.INSIGHTS);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'FEATURE_NOT_ALLOWED',
          feature: Feature.INSIGHTS,
        })
      );
    });

    it('should skip check if no account specified', async () => {
      mockRequest.params = {};
      mockRequest.body = {};

      const middleware = requireFeature(Feature.INSIGHTS);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(SocialAccount.findById).not.toHaveBeenCalled();
      expect(Post.findOne).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should pass non-FeatureLimitationError errors to next', async () => {
      const mockError = new Error('Database error');

      (Post.findOne as jest.Mock).mockRejectedValue(mockError);

      mockRequest.params = { id: 'post-123' };

      const middleware = requireFeature(Feature.PUBLISH);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
      expect(statusMock).not.toHaveBeenCalled();
    });
  });
});
