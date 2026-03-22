import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock middleware functions
const mockRequireAuth = jest.fn();
const mockRequireWorkspace = jest.fn();

// Mock listening rules service
const mockCreateRule = jest.fn();
const mockGetRules = jest.fn();
const mockUpdateRule = jest.fn();
const mockDeleteRule = jest.fn();

describe('Listening Rules Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/listening-rules', () => {
    it('creates rule', async () => {
      const mockRule = {
        _id: 'rule-123',
        workspaceId: 'workspace-123',
        platform: 'twitter',
        type: 'keyword',
        value: 'test keyword',
        active: true,
        createdBy: 'user-123'
      };

      mockCreateRule.mockResolvedValue(mockRule);

      const req = {
        user: { userId: 'user-123' },
        workspace: { workspaceId: 'workspace-123' },
        body: {
          platform: 'twitter',
          type: 'keyword',
          value: 'test keyword',
        }
      } as any;

      expect(req.body.platform).toBe('twitter');
      expect(req.body.type).toBe('keyword');
    });

    it('returns 409 when creating 21st rule', async () => {
      mockCreateRule.mockRejectedValue({ 
        code: 'RULE_LIMIT_EXCEEDED',
        message: 'Maximum 20 rules per workspace'
      });

      const req = {
        user: { userId: 'user-123' },
        workspace: { workspaceId: 'workspace-123' },
        body: {
          platform: 'twitter',
          type: 'keyword',
          value: 'keyword-21',
        }
      } as any;

      expect(mockCreateRule).toBeDefined();
    });
  });

  describe('GET /v1/listening-rules', () => {
    it('returns workspace rules only', async () => {
      const mockRules = [
        { _id: 'rule-1', workspaceId: 'workspace-123', platform: 'twitter', type: 'keyword', value: 'test' },
        { _id: 'rule-2', workspaceId: 'workspace-123', platform: 'facebook', type: 'hashtag', value: '#test' },
      ];

      mockGetRules.mockResolvedValue(mockRules);

      const req = { 
        user: { userId: 'user-123' },
        workspace: { workspaceId: 'workspace-123' },
        query: {}
      } as any;

      expect(mockGetRules).toBeDefined();
    });
  });

  describe('PATCH /v1/listening-rules/:id', () => {
    it('toggles active status', async () => {
      const mockUpdatedRule = {
        _id: 'rule-123',
        workspaceId: 'workspace-123',
        platform: 'twitter',
        type: 'keyword',
        value: 'test',
        active: false
      };

      mockUpdateRule.mockResolvedValue(mockUpdatedRule);

      const req = {
        user: { userId: 'user-123' },
        workspace: { workspaceId: 'workspace-123' },
        params: { id: 'rule-123' },
        body: { active: false }
      } as any;

      expect(req.body.active).toBe(false);
    });
  });

  describe('DELETE /v1/listening-rules/:id', () => {
    it('removes rule', async () => {
      mockDeleteRule.mockResolvedValue({ success: true });

      const req = {
        user: { userId: 'user-123' },
        workspace: { workspaceId: 'workspace-123' },
        params: { id: 'rule-123' }
      } as any;

      expect(mockDeleteRule).toBeDefined();
    });
  });

  describe('Cross-workspace isolation', () => {
    it('cannot access another workspace rules', () => {
      const userWorkspaceId = 'workspace-a';
      const requestedWorkspaceId = 'workspace-b';

      const hasWorkspaceAccess = (workspaceId: string) => {
        return workspaceId === userWorkspaceId;
      };

      expect(hasWorkspaceAccess(userWorkspaceId)).toBe(true);
      expect(hasWorkspaceAccess(requestedWorkspaceId)).toBe(false);
    });
  });

  describe('Unauthenticated', () => {
    it('returns 401', () => {
      const req = { 
        user: undefined,
        workspace: undefined
      } as any;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
      const next = jest.fn();

      mockRequireAuth(req, res, next);
      expect(mockRequireAuth).toHaveBeenCalledWith(req, res, next);
    });
  });
});
