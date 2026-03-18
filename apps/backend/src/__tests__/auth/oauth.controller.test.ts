import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { OAuthController } from '../../controllers/OAuthController';
import { UserRole } from '../../models/User';
import { MemberRole } from '../../models/WorkspaceMember';
import { Types } from 'mongoose';

// Mock all external dependencies
jest.mock('../../models/User');
jest.mock('../../models/SocialAccount');
jest.mock('../../services/OAuthStateService');
jest.mock('../../services/SecurityAuditService');
jest.mock('axios');

describe('OAuthController', () => {
  let oauthController: OAuthController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    oauthController = new OAuthController();
    
    mockRequest = {
      params: { platform: 'twitter' },
      user: { userId: new Types.ObjectId().toString(), email: 'test@example.com', role: UserRole.MEMBER },
      workspace: { 
        workspaceId: new Types.ObjectId(), 
        role: MemberRole.MEMBER,
        memberId: new Types.ObjectId()
      },
      headers: { 'user-agent': 'test-agent' }
    };

    mockResponse = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis()
    } as any;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getPlatforms', () => {
    it('should return available OAuth platforms', async () => {
      await oauthController.getPlatforms(mockRequest as Request, mockResponse as Response, jest.fn());

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        platforms: expect.arrayContaining(['twitter', 'facebook', 'instagram']),
        features: expect.objectContaining({
          oauth2: true,
          pkce: true,
          refreshTokens: true
        })
      });
    });

    it('should return platforms based on configuration', async () => {
      await oauthController.getPlatforms(mockRequest as Request, mockResponse as Response, jest.fn());

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          platforms: expect.any(Array),
          features: expect.any(Object)
        })
      );
    });
  });

  describe('authorize', () => {
    it('should throw error for missing authentication', async () => {
      mockRequest.user = undefined;
      mockRequest.workspace = undefined;

      const nextFn = jest.fn();
      await oauthController.authorize(mockRequest as Request, mockResponse as Response, nextFn);

      expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should throw error for unsupported platform', async () => {
      mockRequest.params = { platform: 'unsupported' };

      const nextFn = jest.fn();
      await oauthController.authorize(mockRequest as Request, mockResponse as Response, nextFn);

      expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('callback', () => {
    beforeEach(() => {
      mockRequest.query = {
        code: 'test-code',
        state: 'test-state'
      };
    });

    it('should handle missing code parameter', async () => {
      mockRequest.query = { state: 'test-state' };

      const nextFn = jest.fn();
      await oauthController.callback(mockRequest as Request, mockResponse as Response, nextFn);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=oauth_failed')
      );
    });

    it('should handle missing state parameter', async () => {
      mockRequest.query = { code: 'test-code' };

      const nextFn = jest.fn();
      await oauthController.callback(mockRequest as Request, mockResponse as Response, nextFn);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=oauth_failed')
      );
    });

    it('should handle OAuth provider errors', async () => {
      mockRequest.query = {
        error: 'access_denied',
        error_description: 'User denied access'
      };

      await oauthController.callback(mockRequest as Request, mockResponse as Response, jest.fn());

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('error=access_denied')
      );
    });
  });
});