import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Auth Token Service
 * 
 * Manages JWT tokens for user authentication
 * 
 * NOTE: This is separate from TokenService which handles OAuth tokens for social accounts
 * 
 * Features:
 * - Access token generation (short-lived)
 * - Refresh token generation (long-lived)
 * - Token verification
 * - Token rotation
 * - Token revocation (via blacklist in production)
 */

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenFamily?: string;
}

export class AuthTokenService {
  /**
   * Generate access and refresh token pair
   */
  static generateTokenPair(payload: TokenPayload): TokenPair {
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.accessExpiry,
      algorithm: 'HS256',
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(
      { ...payload, tokenFamily: payload.userId },
      config.jwt.refreshSecret,
      { 
        expiresIn: config.jwt.refreshExpiry,
        algorithm: 'HS256',
      } as jwt.SignOptions
    );

    return {
      accessToken,
      refreshToken,
      tokenFamily: payload.userId,
    };
  }

  /**
   * Generate temporary token (for 2FA, password reset, etc.)
   */
  static generateTempToken(payload: TokenPayload & { purpose: string }, expiresIn: string = '5m'): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn,
      algorithm: 'HS256',
    } as jwt.SignOptions);
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }) as TokenPayload;
    } catch (error: any) {
      // Re-throw JWT errors with their original name for proper error handling
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw error;
      }
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify refresh token
   */
  static async verifyRefreshToken(token: string): Promise<TokenPayload & { tokenFamily: string }> {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret, { algorithms: ['HS256'] }) as TokenPayload & { tokenFamily: string };
      
      // Check if token is blacklisted (revoked)
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }
      
      return decoded;
    } catch (error: any) {
      // Re-throw JWT errors with their original name for proper error handling
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw error;
      }
      // Preserve revoked error message
      if (error.message === 'Token has been revoked') {
        throw error;
      }
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  static decodeToken(token: string): any {
    return jwt.decode(token);
  }

  /**
   * Rotate refresh token (generate new pair from refresh token)
   */
  static async rotateRefreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const decoded = await this.verifyRefreshToken(refreshToken);
      
      // Blacklist the old refresh token immediately to prevent reuse
      await this.revokeRefreshToken(refreshToken);
      
      return this.generateTokenPair({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      });
    } catch (error: any) {
      const errorMsg = error.message?.toLowerCase() || '';
      
      // Detect token reuse/revocation errors
      if (errorMsg.includes('revoked') || 
          errorMsg.includes('blacklisted') || 
          errorMsg.includes('reuse') || 
          errorMsg.includes('expired')) {
        // Import UnauthorizedError
        const { UnauthorizedError } = await import('../utils/errors');
        throw new UnauthorizedError('Refresh token invalid or reused');
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Revoke refresh token
   * 
   * Adds token to Redis blacklist with TTL matching token expiry
   * This prevents token reuse attacks
   */
  static async revokeRefreshToken(token: string): Promise<void> {
    try {
      const { getRedisClient } = await import('../config/redis');
      const redis = getRedisClient();
      
      if (redis) {
        const decoded = this.decodeToken(token);
        if (decoded && decoded.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await redis.setex(`blacklist:refresh:${token}`, ttl, '1');
            logger.info('Refresh token blacklisted', { 
              token: token.substring(0, 20) + '...',
              ttl 
            });
          }
        }
      } else {
        logger.warn('Redis not available - token revocation not persisted');
      }
    } catch (error) {
      logger.error('Failed to revoke refresh token:', error);
      // Don't throw - allow logout to continue even if blacklist fails
    }
  }

  /**
   * Check if token is blacklisted
   */
  static async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const { getRedisClient } = await import('../config/redis');
      const redis = getRedisClient();
      
      if (redis) {
        const result = await redis.get(`blacklist:refresh:${token}`);
        return result === '1';
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to check token blacklist:', error);
      return false; // Fail open to avoid blocking valid tokens
    }
  }
}
