/**
 * Magic Link / Passwordless Authentication Service
 * 
 * Handles secure magic link token generation, validation, and management
 * for passwordless authentication flow
 */

import * as crypto from 'crypto';
import { User, IUser } from '../models/User';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface MagicLinkToken {
  token: string;
  hashedToken: string;
  expiresAt: Date;
}

export interface MagicLinkVerification {
  valid: boolean;
  user?: IUser;
  expired?: boolean;
  used?: boolean;
}

export class MagicLinkService {
  private static readonly TOKEN_LENGTH = 32; // 32 bytes = 256 bits
  private static readonly TOKEN_EXPIRY_MINUTES = 15;

  /**
   * Generate a secure magic link token
   */
  static generateToken(): MagicLinkToken {
    try {
      // Generate cryptographically secure random token
      const token = crypto.randomBytes(MagicLinkService.TOKEN_LENGTH).toString('hex');
      
      // Hash token for secure storage
      const hashedToken = MagicLinkService.hashToken(token);
      
      // Set expiry time (15 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + MagicLinkService.TOKEN_EXPIRY_MINUTES);

      logger.info('Magic link token generated', { 
        tokenLength: token.length,
        expiresAt: expiresAt.toISOString()
      });

      return {
        token,
        hashedToken,
        expiresAt
      };
    } catch (error) {
      logger.error('Failed to generate magic link token', { error });
      throw new Error('Failed to generate magic link token');
    }
  }

  /**
   * Hash token for secure storage using SHA-256
   */
  static hashToken(token: string): string {
    try {
      return crypto.createHash('sha256')
        .update(token)
        .digest('hex');
    } catch (error) {
      logger.error('Failed to hash magic link token', { error });
      throw new Error('Failed to hash magic link token');
    }
  }

  /**
   * Create magic link for user
   */
  static async createMagicLink(email: string): Promise<{ token: string; user: IUser }> {
    try {
      // Find user by email
      const user = await User.findOne({
        email: email.toLowerCase(),
        softDeletedAt: null,
      });

      if (!user) {
        // Don't reveal if email exists (security)
        logger.info('Magic link requested for non-existent email', { email });
        throw new NotFoundError('If the email exists, a magic link has been sent');
      }

      // Generate magic link token
      const { token, hashedToken, expiresAt } = MagicLinkService.generateToken();

      // Store hashed token in user document
      user.magicLinkToken = hashedToken;
      user.magicLinkExpiresAt = expiresAt;
      await user.save();

      logger.info('Magic link created for user', { 
        userId: user._id, 
        email: user.email,
        expiresAt: expiresAt.toISOString()
      });

      return { token, user };
    } catch (error) {
      logger.error('Failed to create magic link', { email, error });
      throw error;
    }
  }

  /**
   * Verify magic link token
   */
  static async verifyMagicLink(token: string): Promise<MagicLinkVerification> {
    try {
      // Hash the provided token
      const hashedToken = MagicLinkService.hashToken(token);

      // Find user with matching hashed token
      const user = await User.findOne({
        magicLinkToken: hashedToken,
        softDeletedAt: null,
      }).select('+magicLinkToken +magicLinkExpiresAt +refreshTokens');

      if (!user) {
        logger.warn('Magic link verification failed - token not found', { 
          tokenLength: token.length 
        });
        return { valid: false };
      }

      // Check if token has expired
      const now = new Date();
      if (!user.magicLinkExpiresAt || user.magicLinkExpiresAt < now) {
        logger.warn('Magic link verification failed - token expired', { 
          userId: user._id,
          expiresAt: user.magicLinkExpiresAt?.toISOString(),
          now: now.toISOString()
        });
        
        // Clean up expired token
        user.magicLinkToken = undefined;
        user.magicLinkExpiresAt = undefined;
        await user.save();

        return { valid: false, expired: true };
      }

      logger.info('Magic link verification successful', { 
        userId: user._id, 
        email: user.email 
      });

      return { valid: true, user };
    } catch (error) {
      logger.error('Failed to verify magic link', { error });
      return { valid: false };
    }
  }

  /**
   * Consume magic link token (invalidate after use)
   */
  static async consumeMagicLink(token: string): Promise<IUser> {
    try {
      const verification = await MagicLinkService.verifyMagicLink(token);

      if (!verification.valid || !verification.user) {
        if (verification.expired) {
          throw new UnauthorizedError('Magic link has expired');
        }
        throw new UnauthorizedError('Invalid or expired magic link');
      }

      const user = verification.user;

      // Invalidate the token (one-time use)
      user.magicLinkToken = undefined;
      user.magicLinkExpiresAt = undefined;
      
      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      logger.info('Magic link consumed successfully', { 
        userId: user._id, 
        email: user.email 
      });

      return user;
    } catch (error) {
      logger.error('Failed to consume magic link', { error });
      throw error;
    }
  }

  /**
   * Clean up expired magic link tokens
   */
  static async cleanupExpiredTokens(): Promise<number> {
    try {
      const now = new Date();
      
      const result = await User.updateMany(
        {
          magicLinkExpiresAt: { $lt: now },
          magicLinkToken: { $exists: true }
        },
        {
          $unset: {
            magicLinkToken: 1,
            magicLinkExpiresAt: 1
          }
        }
      );

      const cleanedCount = result.modifiedCount || 0;
      
      if (cleanedCount > 0) {
        logger.info('Cleaned up expired magic link tokens', { count: cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired magic link tokens', { error });
      return 0;
    }
  }
}