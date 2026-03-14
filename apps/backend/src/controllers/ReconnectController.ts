import { Request, Response, NextFunction } from 'express';
import { SocialAccount, AccountStatus } from '../models/SocialAccount';
import { reconnectService } from '../services/ReconnectService';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

/**
 * Reconnect Controller
 * 
 * Handles account reconnection flows and OAuth management
 */
export class ReconnectController {
  /**
   * Get all disconnected accounts for workspace
   * GET /api/v1/accounts/disconnected
   */
  async getDisconnectedAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace!.workspaceId.toString();

      const disconnectedAccounts = await SocialAccount.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        status: { 
          $in: [
            AccountStatus.EXPIRED,
            AccountStatus.REVOKED,
            AccountStatus.DISCONNECTED,
            AccountStatus.REAUTH_REQUIRED,
            AccountStatus.REFRESH_FAILED
          ]
        }
      }).select('provider accountName status metadata disconnectedAt tokenExpiresAt');

      const accounts = disconnectedAccounts.map(account => ({
        id: account._id.toString(),
        platform: account.provider,
        accountName: account.accountName,
        reason: reconnectService.getDisconnectionReason(account.status, account.metadata),
        severity: reconnectService.getDisconnectionSeverity(account.status),
        disconnectedAt: account.metadata?.disconnectedAt || account.updatedAt,
        lastSuccessfulConnection: account.metadata?.lastSuccessfulConnection,
        tokenExpiresAt: account.tokenExpiresAt
      }));

      res.json({
        success: true,
        accounts,
        count: accounts.length
      });

      logger.debug('Disconnected accounts retrieved', {
        workspaceId,
        count: accounts.length
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Initiate reconnect OAuth flow
   * POST /api/v1/accounts/:id/reconnect
   */
  async initiateReconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const workspaceId = req.workspace!.workspaceId.toString();

      // Verify account exists and belongs to workspace
      const account = await SocialAccount.findOne({
        _id: new mongoose.Types.ObjectId(id),
        workspaceId: new mongoose.Types.ObjectId(workspaceId)
      });

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      // Generate OAuth URL for reconnection
      const oauthUrl = await reconnectService.generateReconnectOAuthUrl(
        account.provider,
        account._id.toString(),
        workspaceId
      );

      // Log reconnect attempt
      await reconnectService.logReconnectAttempt(account._id.toString(), 'initiated');

      res.json({
        success: true,
        oauthUrl,
        message: 'Reconnect OAuth flow initiated'
      });

      logger.info('Reconnect OAuth initiated', {
        accountId: id,
        platform: account.provider,
        workspaceId
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Snooze reconnect reminder
   * POST /api/v1/accounts/:id/snooze
   */
  async snoozeReconnectReminder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { duration = 24 } = req.body; // hours
      const workspaceId = req.workspace!.workspaceId.toString();

      // Verify account exists and belongs to workspace
      const account = await SocialAccount.findOne({
        _id: new mongoose.Types.ObjectId(id),
        workspaceId: new mongoose.Types.ObjectId(workspaceId)
      });

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      // Set snooze until timestamp
      const snoozeUntil = new Date();
      snoozeUntil.setHours(snoozeUntil.getHours() + duration);

      await SocialAccount.updateOne(
        { _id: account._id },
        {
          $set: {
            'metadata.reconnectSnoozeUntil': snoozeUntil,
            'metadata.lastSnoozeAt': new Date()
          }
        }
      );

      res.json({
        success: true,
        message: `Reconnect reminder snoozed for ${duration} hours`,
        snoozeUntil
      });

      logger.info('Reconnect reminder snoozed', {
        accountId: id,
        duration,
        snoozeUntil,
        workspaceId
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get reconnect status for all accounts
   * GET /api/v1/accounts/reconnect-status
   */
  async getReconnectStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workspaceId = req.workspace!.workspaceId.toString();

      const accounts = await SocialAccount.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId)
      }).select('provider accountName status metadata tokenExpiresAt');

      const statusSummary = {
        total: accounts.length,
        connected: 0,
        needsReconnection: 0,
        expiringSoon: 0,
        snoozed: 0
      };

      const accountStatuses = accounts.map(account => {
        const needsReconnection = [
          AccountStatus.EXPIRED,
          AccountStatus.REVOKED,
          AccountStatus.DISCONNECTED,
          AccountStatus.REAUTH_REQUIRED,
          AccountStatus.REFRESH_FAILED
        ].includes(account.status);

        const isExpiringSoon = account.status === AccountStatus.TOKEN_EXPIRING;
        const isSnoozed = account.metadata?.reconnectSnoozeUntil && 
          new Date(account.metadata.reconnectSnoozeUntil) > new Date();

        // Update counters
        if (account.status === AccountStatus.ACTIVE) statusSummary.connected++;
        if (needsReconnection && !isSnoozed) statusSummary.needsReconnection++;
        if (isExpiringSoon) statusSummary.expiringSoon++;
        if (isSnoozed) statusSummary.snoozed++;

        return {
          id: account._id.toString(),
          platform: account.provider,
          accountName: account.accountName,
          status: account.status,
          needsReconnection,
          isExpiringSoon,
          isSnoozed,
          snoozeUntil: account.metadata?.reconnectSnoozeUntil
        };
      });

      res.json({
        success: true,
        summary: statusSummary,
        accounts: accountStatuses
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle OAuth callback for reconnection
   * GET /api/v1/accounts/reconnect-callback/:platform
   */
  async handleReconnectCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { platform } = req.params;
    
    try {
      const { code, state, error } = req.query;

      if (error) {
        logger.warn('OAuth reconnect callback error', { platform, error });
        return res.redirect(`${process.env.FRONTEND_URL}/accounts?reconnect=error&message=${encodeURIComponent(error as string)}`);
      }

      if (!code || !state) {
        throw new BadRequestError('Missing OAuth code or state');
      }

      // Process OAuth callback
      const result = await reconnectService.handleOAuthCallback(
        platform,
        code as string,
        state as string
      );

      if (result.success) {
        // Log successful reconnection
        await reconnectService.logReconnectAttempt(result.accountId, 'completed');
        
        res.redirect(`${process.env.FRONTEND_URL}/accounts?reconnect=success&account=${result.accountId}`);
      } else {
        res.redirect(`${process.env.FRONTEND_URL}/accounts?reconnect=error&message=${encodeURIComponent(result.error)}`);
      }

      logger.info('OAuth reconnect callback processed', {
        platform,
        success: result.success,
        accountId: result.accountId
      });

    } catch (error) {
      logger.error('OAuth reconnect callback failed', { error: error.message, platform });
      res.redirect(`${process.env.FRONTEND_URL}/accounts?reconnect=error&message=callback_failed`);
    }
  }
}

export const reconnectController = new ReconnectController();