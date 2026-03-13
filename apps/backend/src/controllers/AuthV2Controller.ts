/**
 * Authentication Controller v2
 * 
 * Handles 2FA-related authentication endpoints
 */

import { Request, Response } from 'express';
import { User } from '../models/User';
import { TwoFactorService } from '../services/TwoFactorService';
import { AuthTokenService as TokenService } from '../services/AuthTokenService';
import { 
  BadRequestError, 
  UnauthorizedError, 
  NotFoundError 
} from '../utils/errors';
import { logger } from '../utils/logger';
import { authMetricsTracker } from '../services/metrics/AuthMetricsTracker';

export class AuthV2Controller {
  /**
   * POST /api/v2/auth/complete-login
   * Complete login after 2FA verification
   */
  static async completeLogin(req: Request, res: Response): Promise<void> {
    try {
      const { userId, token } = req.body;

      logger.info('2FA complete-login attempt', { userId });

      // Find user with 2FA fields
      const user = await User.findById(userId)
        .select('+twoFactorSecret +twoFactorBackupCodes +refreshTokens');

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Verify user has 2FA enabled
      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        throw new BadRequestError('Two-factor authentication is not enabled for this user');
      }

      let isValidToken = false;
      let usedBackupCodeIndex = -1;

      // Check if token is 6-digit TOTP
      if (/^\d{6}$/.test(token)) {
        logger.info('Verifying TOTP token', { userId });
        isValidToken = TwoFactorService.verifyToken(token, user.twoFactorSecret);
      }
      // Check if token is 8-character backup code
      else if (/^[0-9A-F]{8}$/i.test(token.toUpperCase())) {
        logger.info('Verifying backup code', { userId });
        const backupResult = TwoFactorService.verifyBackupCode(
          token, 
          user.twoFactorBackupCodes
        );
        isValidToken = backupResult.valid;
        usedBackupCodeIndex = backupResult.index;
      }

      if (!isValidToken) {
        logger.warn('Invalid 2FA token provided', { userId });
        throw new UnauthorizedError('Invalid authentication code');
      }

      // If backup code was used, remove it from the array (single-use)
      if (usedBackupCodeIndex !== -1) {
        logger.info('Consuming used backup code', { 
          userId, 
          codeIndex: usedBackupCodeIndex,
          remainingCodes: user.twoFactorBackupCodes.length - 1
        });
        
        user.twoFactorBackupCodes.splice(usedBackupCodeIndex, 1);
        await user.save();
      }

      // Update last login and 2FA verification timestamp
      user.lastLoginAt = new Date();
      user.twoFactorVerifiedAt = new Date();
      await user.save();

      logger.info('2FA verification successful', { userId });

      // Generate JWT tokens
      const tokens = TokenService.generateTokenPair({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      // Store refresh token
      await user.addRefreshToken(tokens.refreshToken);

      // Increment login success metric
      authMetricsTracker.incrementLoginSuccess();

      logger.info('Complete login successful', { userId });

      // Return user and tokens (exclude sensitive fields)
      const userResponse = user.toObject();
      delete userResponse.password;
      delete userResponse.refreshTokens;
      delete userResponse.twoFactorSecret;
      delete userResponse.twoFactorBackupCodes;

      res.status(200).json({
        success: true,
        message: 'Login completed successfully',
        data: {
          user: userResponse,
          tokens
        }
      });

    } catch (error) {
      logger.error('Complete login error:', error);
      
      if (error instanceof BadRequestError || 
          error instanceof UnauthorizedError || 
          error instanceof NotFoundError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      }
    }
  }
}