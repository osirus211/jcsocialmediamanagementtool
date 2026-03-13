/**
 * Two-Factor Authentication Recovery Controller
 * 
 * Handles account recovery when users lose access to their 2FA device
 */

import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { AuthService } from '../services/AuthService';

export class TwoFactorRecoveryController {
  /**
   * POST /api/v2/2fa/recovery/disable
   * Disable 2FA using backup code (emergency recovery)
   */
  static async emergencyDisable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, backupCode } = req.body;

      // Find user by email
      const user = await User.findOne({ 
        email: email.toLowerCase(),
        softDeletedAt: null 
      }).select('+twoFactorSecret +twoFactorBackupCodes');

      if (!user) {
        // Use generic message to prevent email enumeration
        throw new UnauthorizedError('Invalid email or backup code');
      }

      // Check if 2FA is enabled
      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        throw new BadRequestError('Two-factor authentication is not enabled for this account');
      }

      // Verify backup code
      const { TwoFactorService } = await import('../services/TwoFactorService');
      const verification = TwoFactorService.verifyBackupCode(backupCode, user.twoFactorBackupCodes);
      
      if (!verification.valid) {
        throw new UnauthorizedError('Invalid email or backup code');
      }

      // Disable 2FA and clear all data
      user.twoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      user.twoFactorBackupCodes = [];
      user.twoFactorVerifiedAt = undefined;
      
      // Revoke all refresh tokens for security
      user.refreshTokens = [];
      
      await user.save();

      logger.warn('2FA emergency disabled using backup code', { 
        userId: user._id, 
        email: user.email,
        remainingBackupCodes: 0
      });

      res.status(200).json({
        success: true,
        message: 'Two-factor authentication has been disabled. Please log in again and consider re-enabling 2FA for security.',
      });
    } catch (error) {
      logger.error('2FA emergency disable error:', error);
      next(error);
    }
  }

  /**
   * POST /api/v2/2fa/recovery/request-support
   * Request manual support for 2FA recovery (when all backup codes are lost)
   */
  static async requestSupport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, reason } = req.body;

      // Find user by email
      const user = await User.findOne({ 
        email: email.toLowerCase(),
        softDeletedAt: null 
      });

      if (!user) {
        // Always return success to prevent email enumeration
        res.status(200).json({
          success: true,
          message: 'If the email exists and has 2FA enabled, a support request has been submitted.',
        });
        return;
      }

      // Check if 2FA is enabled
      if (!user.twoFactorEnabled) {
        res.status(200).json({
          success: true,
          message: 'If the email exists and has 2FA enabled, a support request has been submitted.',
        });
        return;
      }

      // Log the support request for manual review
      logger.warn('2FA recovery support requested', {
        userId: user._id,
        email: user.email,
        reason: reason || 'No reason provided',
        timestamp: new Date().toISOString()
      });

      // In a production system, you would:
      // 1. Create a support ticket
      // 2. Send email to support team
      // 3. Possibly send confirmation email to user
      // 4. Store the request in a database for tracking

      res.status(200).json({
        success: true,
        message: 'If the email exists and has 2FA enabled, a support request has been submitted. Our team will review your request and contact you within 24-48 hours.',
      });
    } catch (error) {
      logger.error('2FA recovery support request error:', error);
      next(error);
    }
  }

  /**
   * GET /api/v2/2fa/recovery/status
   * Check recovery options available for a user
   */
  static async getRecoveryStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        throw new BadRequestError('Email is required');
      }

      // Find user by email
      const user = await User.findOne({ 
        email: email.toLowerCase(),
        softDeletedAt: null 
      }).select('+twoFactorBackupCodes');

      if (!user || !user.twoFactorEnabled) {
        // Return generic response to prevent email enumeration
        res.status(200).json({
          success: true,
          data: {
            twoFactorEnabled: false,
            hasBackupCodes: false,
            backupCodesRemaining: 0
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          twoFactorEnabled: true,
          hasBackupCodes: user.twoFactorBackupCodes.length > 0,
          backupCodesRemaining: user.twoFactorBackupCodes.length
        }
      });
    } catch (error) {
      logger.error('2FA recovery status error:', error);
      next(error);
    }
  }
}