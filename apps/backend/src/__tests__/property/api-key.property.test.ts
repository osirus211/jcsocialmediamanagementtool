import * as fc from 'fast-check';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import crypto from 'crypto';

// Mock dependencies
jest.mock('../../services/ApiKeyService');
jest.mock('../../models/ApiKey');

import { ApiKeyService } from '../../services/ApiKeyService';
import { ApiKey } from '../../models/ApiKey';

describe('API Key Properties', () => {
  let apiKeyService: ApiKeyService;

  beforeEach(() => {
    jest.clearAllMocks();
    apiKeyService = new ApiKeyService();
  });

  describe('API Key Generation Properties', () => {
    it('generated API keys always start with sk_ prefix', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (workspaceId, name) => {
            const mockKey = 'sk_' + crypto.randomBytes(32).toString('hex');
            
            (ApiKey.create as jest.Mock).mockResolvedValue({
              id: fc.sample(fc.uuid(), 1)[0],
              key: mockKey,
              name,
              workspaceId
            });

            const result = await apiKeyService.generateApiKey(workspaceId, name);
            
            expect(result.key).toMatch(/^sk_/);
          }
        )
      );
    });

    it('API keys always have length between 40-60 chars', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (workspaceId, name) => {
            const mockKey = 'sk_' + crypto.randomBytes(32).toString('hex');
            
            (ApiKey.create as jest.Mock).mockResolvedValue({
              id: fc.sample(fc.uuid(), 1)[0],
              key: mockKey,
              name,
              workspaceId
            });

            const result = await apiKeyService.generateApiKey(workspaceId, name);
            
            expect(result.key.length).toBeGreaterThanOrEqual(40);
            expect(result.key.length).toBeLessThanOrEqual(60);
          }
        )
      );
    });

    // Concrete example for sanity check
    it('concrete example: generated key should have correct format', async () => {
      const mockKey = 'sk_' + crypto.randomBytes(32).toString('hex');
      
      (ApiKey.create as jest.Mock).mockResolvedValue({
        id: 'key-123',
        key: mockKey,
        name: 'Test Key',
        workspaceId: 'workspace-123'
      });

      const result = await apiKeyService.generateApiKey('workspace-123', 'Test Key');
      
      expect(result.key).toMatch(/^sk_[a-f0-9]{64}$/);
      expect(result.key.length).toBe(67); // 'sk_' + 64 hex chars
    });
  });

  describe('API Key Uniqueness Properties', () => {
    it('two generated keys are never identical (uniqueness)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          fc.uuid(),
          async (n, workspaceId) => {
            const generatedKeys = new Set<string>();
            
            // Mock different keys for each generation
            (ApiKey.create as jest.Mock).mockImplementation(() => {
              const key = 'sk_' + crypto.randomBytes(32).toString('hex');
              return Promise.resolve({
                id: fc.sample(fc.uuid(), 1)[0],
                key,
                workspaceId
              });
            });

            for (let i = 0; i < n; i++) {
              const result = await apiKeyService.generateApiKey(workspaceId, `Key ${i}`);
              generatedKeys.add(result.key);
            }
            
            // All keys should be unique
            expect(generatedKeys.size).toBe(n);
          }
        )
      );
    });
  });

  describe('Key Hashing Properties', () => {
    it('key hashing is deterministic — same key always produces same hash', async () => {
      await fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          (key) => {
            const hash1 = apiKeyService.hashKey(key);
            const hash2 = apiKeyService.hashKey(key);
            
            expect(hash1).toBe(hash2);
            expect(hash1).toBeDefined();
            expect(hash1.length).toBeGreaterThan(0);
          }
        )
      );
    });

    // Concrete example for sanity check
    it('concrete example: same key produces same hash', () => {
      const testKey = 'sk_test123456789';
      const hash1 = apiKeyService.hashKey(testKey);
      const hash2 = apiKeyService.hashKey(testKey);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('Key Expiration Properties', () => {
    it('expired keys always fail auth regardless of other fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.date({ max: new Date(Date.now() - 1000) }), // Past date
          fc.array(fc.constantFrom('posts:read', 'posts:write', 'analytics:read')),
          async (key, expiredDate, scopes) => {
            (ApiKey.findOne as jest.Mock).mockResolvedValue({
              key: apiKeyService.hashKey(key),
              expiresAt: expiredDate,
              scopes,
              isActive: true
            });

            const isValid = await apiKeyService.validateApiKey(key);
            
            expect(isValid).toBe(false);
          }
        )
      );
    });
  });

  describe('Scope Validation Properties', () => {
    it('scopes always subset of valid scopes — never contain unknown permissions', async () => {
      const validScopes = ['posts:read', 'posts:write', 'analytics:read', 'analytics:write', 'users:read', 'users:write'];
      
      await fc.assert(
        fc.asyncProperty(
          fc.subarray(validScopes),
          fc.uuid(),
          async (scopes, workspaceId) => {
            const mockKey = 'sk_' + crypto.randomBytes(32).toString('hex');
            
            (ApiKey.create as jest.Mock).mockResolvedValue({
              id: fc.sample(fc.uuid(), 1)[0],
              key: mockKey,
              scopes,
              workspaceId
            });

            const result = await apiKeyService.generateApiKey(workspaceId, 'Test Key', { scopes });
            
            // All scopes should be valid
            expect(result.scopes.every(scope => validScopes.includes(scope))).toBe(true);
          }
        )
      );
    });

    it('invalid scopes should be rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 })),
          fc.uuid(),
          async (invalidScopes, workspaceId) => {
            const validScopes = ['posts:read', 'posts:write', 'analytics:read'];
            const hasInvalidScope = invalidScopes.some(scope => !validScopes.includes(scope));
            
            if (hasInvalidScope && invalidScopes.length > 0) {
              await expect(
                apiKeyService.generateApiKey(workspaceId, 'Test Key', { scopes: invalidScopes })
              ).rejects.toThrow(/invalid scope/i);
            }
          }
        )
      );
    });
  });

  describe('Rate Limit Properties', () => {
    it('rate limit counters never go negative', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          async (key, currentUsage, requestCount) => {
            (ApiKey.findOne as jest.Mock).mockResolvedValue({
              key: apiKeyService.hashKey(key),
              rateLimit: { requests: 1000, window: 3600 },
              currentUsage,
              isActive: true,
              expiresAt: new Date(Date.now() + 86400000)
            });

            // Mock rate limit update
            (ApiKey.findOneAndUpdate as jest.Mock).mockImplementation((filter, update) => {
              const newUsage = Math.max(0, (update.$inc?.currentUsage || 0) + currentUsage);
              return Promise.resolve({
                currentUsage: newUsage
              });
            });

            for (let i = 0; i < requestCount; i++) {
              await apiKeyService.checkRateLimit(key);
            }

            // Verify counter never went negative
            const updateCalls = (ApiKey.findOneAndUpdate as jest.Mock).mock.calls;
            updateCalls.forEach(call => {
              const update = call[1];
              if (update.$inc?.currentUsage !== undefined) {
                expect(update.$inc.currentUsage).toBeGreaterThanOrEqual(0);
              }
            });
          }
        )
      );
    });
  });

  describe('IP Allowlist Properties', () => {
    it('IP allowlist with empty array always allows all IPs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.ipV4(),
          async (key, clientIp) => {
            (ApiKey.findOne as jest.Mock).mockResolvedValue({
              key: apiKeyService.hashKey(key),
              ipAllowlist: [], // Empty allowlist
              isActive: true,
              expiresAt: new Date(Date.now() + 86400000)
            });

            const isAllowed = await apiKeyService.checkIpAllowlist(key, clientIp);
            
            expect(isAllowed).toBe(true);
          }
        )
      );
    });

    // Concrete example for sanity check
    it('concrete example: empty allowlist allows any IP', async () => {
      const testKey = 'sk_test123456789';
      const testIp = '192.168.1.1';
      
      (ApiKey.findOne as jest.Mock).mockResolvedValue({
        key: apiKeyService.hashKey(testKey),
        ipAllowlist: [],
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000)
      });

      const isAllowed = await apiKeyService.checkIpAllowlist(testKey, testIp);
      expect(isAllowed).toBe(true);
    });
  });
});