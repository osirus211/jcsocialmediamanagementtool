import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { tokenLifecycleService } from '../../services/TokenLifecycleService';
import { SocialAccount } from '../../models/SocialAccount';
import { logger } from '../../utils/logger';
import { rateLimitMiddleware } from '../../middleware/RateLimitMiddleware';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * GET /api/v1/tokens/health
 * Get health status of all tokens for the workspace
 */
router.get('/health', async (req, res) => {
  try {
    const workspaceId = req.workspace!.workspaceId;

    // Get all accounts for the workspace
    const accounts = await SocialAccount.find({ 
      workspaceId,
      status: { $ne: 'deleted' }
    });

    const healthData = await Promise.all(
      accounts.map(async (account) => {
        const health = await tokenLifecycleService.checkTokenHealth(account._id);
        return {
          accountId: account._id,
          provider: account.provider,
          accountName: account.accountName,
          ...health,
        };
      })
    );

    // Group by health state
    const summary = {
      total: healthData.length,
      healthy: healthData.filter(h => h.state === 'active').length,
      expiringSoon: healthData.filter(h => h.state === 'expiring_soon').length,
      expired: healthData.filter(h => h.state === 'expired').length,
      revoked: healthData.filter(h => h.state === 'revoked').length,
    };

    res.json({
      success: true,
      data: {
        summary,
        accounts: healthData,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get token health', {
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get token health',
    });
  }
});

/**
 * GET /api/v1/tokens/expiring
 * Get accounts with expiring tokens
 */
router.get('/expiring', async (req, res) => {
  try {
    const workspaceId = req.workspace!.workspaceId.toString();
    const expiringAccounts = await tokenLifecycleService.getExpiringAccounts(workspaceId);

    const accountsWithHealth = await Promise.all(
      expiringAccounts.map(async (account) => {
        const health = await tokenLifecycleService.checkTokenHealth(account._id);
        return {
          accountId: account._id,
          provider: account.provider,
          accountName: account.accountName,
          expiresAt: account.tokenExpiresAt,
          daysUntilExpiry: health?.daysUntilExpiry,
          state: health?.state,
        };
      })
    );

    res.json({
      success: true,
      data: {
        count: accountsWithHealth.length,
        accounts: accountsWithHealth,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get expiring tokens', {
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get expiring tokens',
    });
  }
});

/**
 * POST /api/v1/tokens/refresh/:accountId
 * Manually refresh token for a specific account
 */
router.post('/refresh/:accountId',
  rateLimitMiddleware({ 
    ip: { windowMs: 60000, maxRequests: 5, keyPrefix: 'ratelimit:ip:token-refresh:' }
  }), // 5 requests per minute
  async (req, res) => {
    try {
      const { accountId } = req.params;
      const workspaceId = req.workspace!.workspaceId;

      // Verify account belongs to workspace
      const account = await SocialAccount.findOne({
        _id: accountId,
        workspaceId,
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found',
        });
      }

      logger.info('Manual token refresh requested', {
        accountId,
        provider: account.provider,
        workspaceId,
        userId: req.user!.userId,
      });

      const result = await tokenLifecycleService.refreshToken(account);

      if (result.success) {
        return res.json({
          success: true,
          data: {
            accountId: result.accountId,
            provider: result.provider,
            newExpiresAt: result.newExpiresAt,
            message: 'Token refreshed successfully',
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
          requiresReconnect: result.requiresReconnect,
        });
      }
    } catch (error: any) {
      logger.error('Manual token refresh failed', {
        accountId: req.params.accountId,
        workspaceId: req.workspace?.workspaceId,
        error: error.message,
      });
      return res.status(500).json({
        success: false,
        error: 'Token refresh failed',
      });
    }
  }
);

/**
 * POST /api/v1/tokens/refresh-all
 * Refresh all expiring tokens for the workspace
 */
router.post('/refresh-all',
  rateLimitMiddleware({ 
    ip: { windowMs: 300000, maxRequests: 2, keyPrefix: 'ratelimit:ip:bulk-refresh:' }
  }), // 2 requests per 5 minutes
  async (req, res) => {
    try {
      const workspaceId = req.workspace!.workspaceId.toString();

      logger.info('Bulk token refresh requested', {
        workspaceId,
        userId: req.user!.userId,
      });

      const results = await tokenLifecycleService.refreshAllExpiring(workspaceId);

      const summary = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      };

      return res.json({
        success: true,
        data: {
          summary,
          results,
          message: `Refreshed ${summary.successful}/${summary.total} tokens`,
        },
      });
    } catch (error: any) {
      logger.error('Bulk token refresh failed', {
        workspaceId: req.workspace?.workspaceId,
        error: error.message,
      });
      return res.status(500).json({
        success: false,
        error: 'Bulk token refresh failed',
      });
    }
  }
);

/**
 * GET /api/v1/tokens/health/:accountId
 * Get detailed health info for a specific account
 */
router.get('/health/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const workspaceId = req.workspace!.workspaceId;

    // Verify account belongs to workspace
    const account = await SocialAccount.findOne({
      _id: accountId,
      workspaceId,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    const health = await tokenLifecycleService.checkTokenHealth(accountId);

    if (!health) {
      return res.status(404).json({
        success: false,
        error: 'Health data not available',
      });
    }

    return res.json({
      success: true,
      data: {
        accountId: account._id,
        provider: account.provider,
        accountName: account.accountName,
        ...health,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get account health', {
      accountId: req.params.accountId,
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to get account health',
    });
  }
});

export default router;