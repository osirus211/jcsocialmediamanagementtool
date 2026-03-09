/**
 * Example Public API Routes
 * 
 * Demonstrates how to use API key authentication, scope validation, and rate limiting
 */

import { Router } from 'express';
import { requireApiKey } from '../../../middleware/apiKeyAuth';
import { requireScope } from '../../../middleware/apiKeyScope';
import { apiKeyRateLimit, combinedApiKeyRateLimit } from '../../../middleware/apiKeyRateLimit';

const router = Router();

/**
 * Example: List posts (requires posts:read scope)
 * 
 * Usage:
 * curl -H "x-api-key: sk_live_xxx" https://api.example.com/api/public/v1/posts
 * 
 * Response headers include:
 * X-RateLimit-Limit: 1000
 * X-RateLimit-Remaining: 999
 * X-RateLimit-Reset: 1678901234
 */
router.get('/posts',
  requireApiKey,              // Authenticate API key
  apiKeyRateLimit,            // Enforce rate limits
  requireScope('posts:read'), // Validate scope
  async (req, res) => {
    // req.apiKey is now available
    // req.workspace is now available
    
    res.json({
      message: 'Posts endpoint',
      workspaceId: req.apiKey?.workspaceId,
      scopes: req.apiKey?.scopes,
    });
  }
);

/**
 * Example: Create post (requires posts:write scope)
 * Uses combined rate limiting (per-key + workspace-level)
 */
router.post('/posts',
  requireApiKey,
  combinedApiKeyRateLimit,    // Both per-key and workspace limits
  requireScope('posts:write'),
  async (req, res) => {
    res.json({
      message: 'Create post endpoint',
      workspaceId: req.apiKey?.workspaceId,
    });
  }
);

/**
 * Example: Get analytics (requires analytics:read scope)
 */
router.get('/analytics',
  requireApiKey,
  apiKeyRateLimit,
  requireScope('analytics:read'),
  async (req, res) => {
    res.json({
      message: 'Analytics endpoint',
      workspaceId: req.apiKey?.workspaceId,
    });
  }
);

/**
 * Example: Multiple scopes required
 */
router.post('/posts/:id/publish',
  requireApiKey,
  apiKeyRateLimit,
  requireScope('posts:write', 'accounts:read'), // Requires both scopes
  async (req, res) => {
    res.json({
      message: 'Publish post endpoint',
      postId: req.params.id,
    });
  }
);

export default router;
