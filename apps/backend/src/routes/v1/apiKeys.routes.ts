/**
 * API Key Management Routes
 * 
 * Internal endpoints for workspace owners/admins to manage API keys
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace, requireAdmin } from '../../middleware/tenant';
import { ApiKeyController } from '../../controllers/ApiKeyController';

const router = Router();

/**
 * GET /api/v1/api-keys/scopes
 * Get all available API scopes with documentation
 * 
 * Response:
 * {
 *   "scopes": [
 *     {
 *       "scope": "posts:read",
 *       "description": "Read posts and drafts",
 *       "category": "posts",
 *       "endpoints": ["GET /api/public/v1/posts", ...]
 *     },
 *     ...
 *   ],
 *   "categories": [
 *     {
 *       "name": "Posts",
 *       "description": "Manage social media posts and drafts",
 *       "scopes": ["posts:read", "posts:write"]
 *     },
 *     ...
 *   ],
 *   "total": 12
 * }
 */
router.get('/scopes', ApiKeyController.getScopesDocumentation);

// All API key management requires authentication + workspace context + admin role
router.use(requireAuth);
router.use(requireWorkspace);
router.use(requireAdmin); // Only admins/owners can manage API keys

/**
 * POST /api/v1/api-keys
 * Create a new API key
 * 
 * Body:
 * {
 *   "name": "Production Server",
 *   "scopes": ["posts:read", "posts:write"],
 *   "rateLimit": { "maxRequests": 1000, "windowMs": 3600000 },
 *   "expiresAt": "2027-01-01T00:00:00Z",
 *   "allowedIps": ["192.168.1.1"]
 * }
 * 
 * Response:
 * {
 *   "apiKey": {
 *     "id": "...",
 *     "name": "Production Server",
 *     "key": "sk_live_xxx", // ⚠️ ONLY RETURNED ONCE
 *     "prefix": "sk_live_abc",
 *     "scopes": ["posts:read", "posts:write"],
 *     ...
 *   },
 *   "warning": "Save this key securely. It will not be shown again."
 * }
 */
router.post('/', ApiKeyController.createApiKey);

/**
 * GET /api/v1/api-keys
 * List all API keys for the workspace
 * 
 * Response:
 * {
 *   "apiKeys": [
 *     {
 *       "id": "...",
 *       "name": "Production Server",
 *       "prefix": "sk_live_abc",
 *       "scopes": ["posts:read"],
 *       "status": "active",
 *       "lastUsedAt": "2026-03-07T10:30:00Z",
 *       "requestCount": 1234,
 *       ...
 *     }
 *   ],
 *   "total": 5
 * }
 */
router.get('/', ApiKeyController.listApiKeys);

/**
 * GET /api/v1/api-keys/:id
 * Get details for a specific API key
 * 
 * Response:
 * {
 *   "apiKey": {
 *     "id": "...",
 *     "name": "Production Server",
 *     "prefix": "sk_live_abc",
 *     "scopes": ["posts:read"],
 *     "rateLimit": { "maxRequests": 1000, "windowMs": 3600000 },
 *     "status": "active",
 *     "lastUsedAt": "2026-03-07T10:30:00Z",
 *     "requestCount": 1234,
 *     ...
 *   }
 * }
 */
router.get('/:id', ApiKeyController.getApiKey);

/**
 * PATCH /api/v1/api-keys/:id
 * Update an API key
 * 
 * Body:
 * {
 *   "name": "Updated Name",
 *   "scopes": ["posts:read", "analytics:read"],
 *   "rateLimit": { "maxRequests": 2000, "windowMs": 3600000 },
 *   "allowedIps": ["192.168.1.1", "192.168.1.2"]
 * }
 * 
 * Response:
 * {
 *   "apiKey": { ... },
 *   "message": "API key updated successfully"
 * }
 */
router.patch('/:id', ApiKeyController.updateApiKey);

/**
 * POST /api/v1/api-keys/:id/revoke
 * Revoke an API key immediately
 * 
 * Response:
 * {
 *   "message": "API key revoked successfully",
 *   "keyId": "...",
 *   "revokedAt": "2026-03-07T10:30:00Z"
 * }
 */
router.post('/:id/revoke', ApiKeyController.revokeApiKey);

/**
 * DELETE /api/v1/api-keys/:id
 * Delete an API key permanently
 * 
 * Response:
 * {
 *   "message": "API key deleted successfully",
 *   "keyId": "..."
 * }
 */
router.delete('/:id', ApiKeyController.deleteApiKey);

/**
 * POST /api/v1/api-keys/:id/rotate
 * Rotate an API key with grace period
 * 
 * Body:
 * {
 *   "gracePeriodDays": 7
 * }
 * 
 * Response:
 * {
 *   "newKey": {
 *     "id": "...",
 *     "name": "Production Server (rotated)",
 *     "key": "sk_live_yyy", // ⚠️ ONLY RETURNED ONCE
 *     "prefix": "sk_live_def",
 *     ...
 *   },
 *   "oldKeyId": "...",
 *   "gracePeriodEnds": "2026-03-14T10:30:00Z",
 *   "warning": "Save this key securely. The old key will remain active during the grace period."
 * }
 */
router.post('/:id/rotate', ApiKeyController.rotateApiKey);

/**
 * GET /api/v1/api-keys/:id/usage
 * Get usage statistics for an API key
 * 
 * Query params:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * 
 * Response:
 * {
 *   "usage": {
 *     "keyId": "...",
 *     "totalRequests": 1234,
 *     "lastUsedAt": "2026-03-07T10:30:00Z",
 *     ...
 *   },
 *   "period": {
 *     "startDate": "2026-02-05T00:00:00Z",
 *     "endDate": "2026-03-07T10:30:00Z"
 *   }
 * }
 */
router.get('/:id/usage', ApiKeyController.getUsageStats);

export default router;
