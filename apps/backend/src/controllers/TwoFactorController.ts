/**
 * Two-Factor Authentication Controller
 * 
 * Handles 2FA setup, verification, and management requests
 */

import { Request, Response, NextFunction } from 'express';
import { TwoFactorService } from '../services/TwoFactorService';
import { User } from '../models/User';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

export class TwoFactorController {
  /**
   * GET /api/v2/2fa/setup
   * Generate temporary TOTP secret and QR code
   */
  static async setup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Get user
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if 2FA is already enabled
      if (user.twoFactorEnabled) {
        throw new BadRequestError('Two-factor authentication is already enabled');
      }

      // Generate secret and QR code
      const { secret, otpauthUrl } = TwoFactorService.generateSecret(user.email);
      const qrCodeDataUrl = await TwoFactorService.generateQRCode(otpauthUrl);

      logger.info('2FA setup initiated', { userId, email: user.email });

      res.status(200).json({
        success: true,
        data: {
          secret,
          qrCode: qrCodeDataUrl,
          manualEntryKey: secret,
          appName: 'Social Media Manager'
        }
      });
    } catch (error) {
      logger.error('2FA setup error:', error);
      next(error);
    }
  }

  /**
   * POST /api/v2/2fa/verify-setup
   * Verify TOTP token and enable 2FA
   */
  static async verifySetup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { token } = req.body;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Get user with 2FA fields
      const user = await User.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if 2FA is already enabled
      if (user.twoFactorEnabled) {
        throw new BadRequestError('Two-factor authentication is already enabled');
      }

      // Get temporary secret from session/cache (for now, generate new one)
      // In production, this should be stored temporarily during setup
      const { secret } = TwoFactorService.generateSecret(user.email);

      // Verify TOTP token
      const isValidToken = TwoFactorService.verifyToken(token, secret);
      if (!isValidToken) {
        throw new UnauthorizedError('Invalid verification code');
      }

      // Generate backup codes
      const backupCodes = TwoFactorService.generateBackupCodes(8);
      const hashedBackupCodes = backupCodes.map(code => 
        TwoFactorService.hashBackupCode(code)
      );

      // Enable 2FA
      user.twoFactorEnabled = true;
      user.twoFactorSecret = secret;
      user.twoFactorBackupCodes = hashedBackupCodes;
      user.twoFactorVerifiedAt = new Date();
      await user.save();

      logger.info('2FA enabled successfully', { userId, email: user.email });

      res.status(200).json({
        success: true,
        message: 'Two-factor authentication enabled successfully',
        data: {
          backupCodes
        }
      });
    } catch (error) {
      logger.error('2FA verify setup error:', error);
      next(error);
    }
  }

  /**
   * POST /api/v2/2fa/validate
   * Validate TOTP token or backup code during login
   */
  static async validate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, token } = req.body;

      // Get user with 2FA fields
      const user = await User.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if 2FA is enabled
      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        throw new BadRequestError('Two-factor authentication is not enabled');
      }

      let isValid = false;
      let usedBackupCodeIndex = -1;

      // Check if token is 6 digits (TOTP) or 8 characters (backup code)
      if (/^\d{6}$/.test(token)) {
        // Verify TOTP token
        isValid = TwoFactorService.verifyToken(token, user.twoFactorSecret);
      } else if (/^[0-9A-F]{8}$/i.test(token)) {
        // Verify backup code
        const verification = TwoFactorService.verifyBackupCode(token, user.twoFactorBackupCodes);
        isValid = verification.valid;
        usedBackupCodeIndex = verification.index;
      }

      if (!isValid) {
        throw new UnauthorizedError('Invalid verification code');
      }

      // If backup code was used, mark it as consumed
      if (usedBackupCodeIndex >= 0) {
        user.twoFactorBackupCodes.splice(usedBackupCodeIndex, 1);
        await user.save();
        logger.info('Backup code consumed', { userId, remainingCodes: user.twoFactorBackupCodes.length });
      }

      logger.info('2FA validation successful', { userId, method: usedBackupCodeIndex >= 0 ? 'backup' : 'totp' });

      res.status(200).json({
        success: true,
        message: 'Verification successful'
      });
    } catch (error) {
      logger.error('2FA validation error:', error);
      next(error);
    }
  }

  /**
   * POST /api/v2/2fa/disable
   * Disable 2FA after verifying TOTP token
   */
  static async disable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { token } = req.body;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Get user with 2FA fields
      const user = await User.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if 2FA is enabled
      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        throw new BadRequestError('Two-factor authentication is not enabled');
      }

      // Verify TOTP token
      const isValidToken = TwoFactorService.verifyToken(token, user.twoFactorSecret);
      if (!isValidToken) {
        throw new UnauthorizedError('Invalid verification code');
      }

      // Disable 2FA and clear all data
      user.twoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      user.twoFactorBackupCodes = [];
      user.twoFactorVerifiedAt = undefined;
      await user.save();

      logger.info('2FA disabled successfully', { userId, email: user.email });

      res.status(200).json({
        success: true,
        message: 'Two-factor authentication disabled successfully'
      });
    } catch (error) {
      logger.error('2FA disable error:', error);
      next(error);
    }
  }

  /**
   * POST /api/v2/2fa/regenerate-backup-codes
   * Generate new backup codes after verifying TOTP token
   */
  static async regenerateBackupCodes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { token } = req.body;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Get user with 2FA fields
      const user = await User.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if 2FA is enabled
      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        throw new BadRequestError('Two-factor authentication is not enabled');
      }

      // Verify TOTP token
      const isValidToken = TwoFactorService.verifyToken(token, user.twoFactorSecret);
      if (!isValidToken) {
        throw new UnauthorizedError('Invalid verification code');
      }

      // Generate new backup codes
      const backupCodes = TwoFactorService.generateBackupCodes(8);
      const hashedBackupCodes = backupCodes.map(code => 
        TwoFactorService.hashBackupCode(code)
      );

      // Update user with new backup codes
      user.twoFactorBackupCodes = hashedBackupCodes;
      await user.save();

      logger.info('Backup codes regenerated', { userId, email: user.email });

      res.status(200).json({
        success: true,
        message: 'Backup codes regenerated successfully',
        data: {
          backupCodes
        }
      });
    } catch (error) {
      logger.error('2FA regenerate backup codes error:', error);
      next(error);
    }
  }
}