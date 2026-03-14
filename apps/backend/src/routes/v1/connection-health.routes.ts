/**
 * Connection Health Routes
 * 
 * API endpoints for connection health monitoring and metrics
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { ConnectionHealthService } from '../../services/ConnectionHealthService';
import { SocialAccount } from '../../models/SocialAccount';
import { getRedisClient } from '../../config/redis';
import { logger } from '../../utils/logger';
import { BadRequestError } from '../../utils/errors';
import mongoose from 'mongoose';

const router = Router();
const redis = getRedisClient();
const healthService = new ConnectionHealthService(redis);

/**
 * GET /api/v1/connection-health/scores
 * Get health scores for all accounts in workspace
 */
router.get('/scores', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const workspaceId = req.workspace!.workspaceId.toString();

    // Get all accounts for workspace
    const accounts = await SocialAccount.find({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      status: { $ne: 'deleted' }
    }).select('provider accountName providerUserId');

    // Get health scores for each account
    const healthScores = await Promise.all(
      accounts.map(async (account) => {
        const score = await healthService.getHealthScore(
          account.provider,
          account.providerUserId
        );

        return {
          accountId: account._id.toString(),
          provider: account.provider,
          accountName: account.accountName,
          healthScore: score?.score || 0,
          healthGrade: score?.grade || 'unknown',
          metrics: score?.metrics || null,
          lastCalculated: score?.timestamp || null
        };
      })
    );

    res.json({
      success: true,
      data: {
        workspaceId,
        accounts: healthScores,
        summary: {
          total: healthScores.length,
          excellent: healthScores.filter(s => s.healthGrade === 'excellent').length,
          good: healthScores.filter(s => s.healthGrade === 'good').length,
          fair: healthScores.filter(s => s.healthGrade === 'fair').length,
          poor: healthScores.filter(s => s.healthGrade === 'poor').length,
          critical: healthScores.filter(s => s.healthGrade === 'critical').length,
          averageScore: healthScores.reduce((sum, s) => sum + s.healthScore, 0) / healthScores.length || 0
        }
      }
    });

    logger.debug('Connection health scores retrieved', {
      workspaceId,
      accountCount: accounts.length
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/connection-health/account/:accountId
 * Get detailed health metrics for specific account
 */
router.get('/account/:accountId', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const workspaceId = req.workspace!.workspaceId.toString();

    // Verify account belongs to workspace
    const account = await SocialAccount.findOne({
      _id: new mongoose.Types.ObjectId(accountId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId)
    });

    if (!account) {
      throw new BadRequestError('Account not found');
    }

    // Get current health score
    const healthScore = await healthService.getHealthScore(
      account.provider,
      account.providerUserId
    );

    // Recalculate to get fresh metrics
    const freshScore = await healthService.calculateHealthScore(
      account.provider,
      account.providerUserId
    );

    res.json({
      success: true,
      data: {
        accountId,
        provider: account.provider,
        accountName: account.accountName,
        current: healthScore,
        fresh: freshScore,
        recommendations: generateHealthRecommendations(freshScore)
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/connection-health/recalculate/:accountId
 * Force recalculation of health score for account
 */
router.post('/recalculate/:accountId', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const workspaceId = req.workspace!.workspaceId.toString();

    // Verify account belongs to workspace
    const account = await SocialAccount.findOne({
      _id: new mongoose.Types.ObjectId(accountId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId)
    });

    if (!account) {
      throw new BadRequestError('Account not found');
    }

    // Recalculate health score
    const healthScore = await healthService.calculateHealthScore(
      account.provider,
      account.providerUserId
    );

    res.json({
      success: true,
      message: 'Health score recalculated',
      data: healthScore
    });

    logger.info('Health score recalculated', {
      accountId,
      provider: account.provider,
      score: healthScore.score,
      grade: healthScore.grade
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/connection-health/trends/:accountId
 * Get health score trends for account (last 30 days)
 */
router.get('/trends/:accountId', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const workspaceId = req.workspace!.workspaceId.toString();
    const { days = '7' } = req.query;

    // Verify account belongs to workspace
    const account = await SocialAccount.findOne({
      _id: new mongoose.Types.ObjectId(accountId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId)
    });

    if (!account) {
      throw new BadRequestError('Account not found');
    }

    // Get historical health scores (simplified - in production would store daily snapshots)
    const currentScore = await healthService.getHealthScore(
      account.provider,
      account.providerUserId
    );

    // Mock trend data for now - in production, store daily health snapshots
    const trendData = generateMockTrendData(currentScore, parseInt(days as string));

    res.json({
      success: true,
      data: {
        accountId,
        provider: account.provider,
        accountName: account.accountName,
        period: `${days} days`,
        trends: trendData
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * Generate health recommendations based on score
 */
function generateHealthRecommendations(healthScore: any): string[] {
  const recommendations: string[] = [];

  if (!healthScore) return ['Unable to generate recommendations - no health data available'];

  const { score, metrics } = healthScore;

  if (score < 50) {
    recommendations.push('🚨 Critical: Immediate attention required');
  }

  if (metrics.tokenRefreshSuccessRate < 80) {
    recommendations.push('🔑 Token refresh issues detected - check OAuth configuration');
  }

  if (metrics.webhookActivityScore < 50) {
    recommendations.push('📡 Low webhook activity - verify platform integration');
  }

  if (metrics.errorFrequencyScore < 70) {
    recommendations.push('⚠️ High error rate - review API usage and rate limits');
  }

  if (metrics.lastInteractionScore < 30) {
    recommendations.push('⏰ Account inactive - consider refreshing connection');
  }

  if (score >= 90) {
    recommendations.push('✅ Excellent health - no action needed');
  } else if (score >= 70) {
    recommendations.push('👍 Good health - monitor for changes');
  }

  return recommendations;
}

/**
 * Generate mock trend data (in production, store daily snapshots)
 */
function generateMockTrendData(currentScore: any, days: number) {
  if (!currentScore) return [];

  const trends = [];
  const baseScore = currentScore.score;
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Add some realistic variance
    const variance = (Math.random() - 0.5) * 10;
    const score = Math.max(0, Math.min(100, baseScore + variance));
    
    trends.push({
      date: date.toISOString().split('T')[0],
      score: Math.round(score),
      grade: getHealthGrade(score)
    });
  }
  
  return trends;
}

function getHealthGrade(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'critical';
}

export default router;