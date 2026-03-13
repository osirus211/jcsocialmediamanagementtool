/**
 * Magic Link / Passwordless Authentication Controller
 * 
 * Handles magic link generation, email sending, and verification
 */

import { Request, Response, NextFunction } from 'express';
import { MagicLinkService } from '../services/MagicLinkService';
import { AuthTokenService as TokenService } from '../services/AuthTokenService';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { authMetricsTracker } from '../services/metrics/AuthMetricsTracker';
import { config } from '../config';

export class MagicLinkController {
  /**
   * POST /api/v1/auth/magic-link/request
   * Request a magic link for passwordless authentication
   */
  static async requestMagicLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        throw new BadRequestError('Email is required');
      }

      logger.info('Magic link requested', { email });

      try {
        // Create magic link
        const { token, user } = await MagicLinkService.createMagicLink(email);

        // Generate magic link URL
        const magicLinkUrl = `${config.frontend.url}/auth/magic-link/verify?token=${token}`;

        // Send magic link email (non-blocking)
        MagicLinkController.sendMagicLinkEmail(user.email, magicLinkUrl, user.getFullName()).catch(err => {
          logger.warn('Failed to send magic link email', { 
            userId: user._id, 
            email: user.email, 
            error: err.message 
          });
        });

        logger.info('Magic link created and email queued', { 
          userId: user._id, 
          email: user.email 
        });

      } catch (error) {
        // Don't reveal if email exists (security)
        logger.info('Magic link request processed (email may not exist)', { email });
      }

      // Always return success to prevent email enumeration
      res.status(200).json({
        success: true,
        message: 'If the email exists, a magic link has been sent to your inbox.',
      });
    } catch (error) {
      logger.error('Magic link request error:', error);
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/magic-link/verify
   * Verify magic link token and complete authentication
   */
  static async verifyMagicLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        throw new BadRequestError('Magic link token is required');
      }

      logger.info('Magic link verification attempt', { tokenLength: token.length });

      // Consume magic link (one-time use)
      const user = await MagicLinkService.consumeMagicLink(token);

      // Generate authentication tokens
      const tokens = TokenService.generateTokenPair({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      // Store refresh token
      await user.addRefreshToken(tokens.refreshToken);

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: config.env === 'production', // HTTPS only in production
        sameSite: 'strict', // CSRF protection
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/v1/auth', // Limit cookie to auth endpoints
      });

      // Increment login success metric
      authMetricsTracker.incrementLoginSuccess();

      logger.info('Magic link authentication successful', { 
        userId: user._id, 
        email: user.email 
      });

      res.status(200).json({
        success: true,
        message: 'Authentication successful',
        user,
        accessToken: tokens.accessToken,
      });
    } catch (error) {
      logger.error('Magic link verification error:', error);
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/magic-link/status
   * Check if a magic link token is valid (without consuming it)
   */
  static async checkMagicLinkStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        throw new BadRequestError('Magic link token is required');
      }

      // Verify token without consuming it
      const verification = await MagicLinkService.verifyMagicLink(token);

      if (!verification.valid) {
        if (verification.expired) {
          res.status(200).json({
            valid: false,
            expired: true,
            message: 'Magic link has expired',
          });
          return;
        }

        res.status(200).json({
          valid: false,
          message: 'Invalid magic link',
        });
        return;
      }

      res.status(200).json({
        valid: true,
        message: 'Magic link is valid',
        user: {
          email: verification.user?.email,
          firstName: verification.user?.firstName,
          lastName: verification.user?.lastName,
        },
      });
    } catch (error) {
      logger.error('Magic link status check error:', error);
      next(error);
    }
  }

  /**
   * Send magic link email
   */
  private static async sendMagicLinkEmail(
    email: string, 
    magicLinkUrl: string, 
    userName: string
  ): Promise<void> {
    try {
      const { emailNotificationService } = await import('../services/EmailNotificationService');

      await emailNotificationService.sendMagicLink({
        to: email,
        magicLinkUrl,
        userName,
        expiresIn: '15 minutes',
      });

      logger.info('Magic link email sent', { to: email });
    } catch (error: any) {
      logger.error('Error sending magic link email', { 
        to: email, 
        error: error.message 
      });
      // Don't throw - email failures should not affect magic link creation
    }
  }
}