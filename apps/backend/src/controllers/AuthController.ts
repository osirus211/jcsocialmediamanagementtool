import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { logger } from '../utils/logger';
import { config } from '../config';

export class AuthController {
  /**
   * Register a new user
   * POST /api/v1/auth/register
   */
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      logger.info('RUNTIME_TRACE REGISTER_START', { timestamp: new Date().toISOString() });
      const { email, password, firstName, lastName } = req.body;

      const result = await AuthService.register({
        email,
        password,
        firstName,
        lastName,
      });

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: config.env === 'production', // HTTPS only in production
        sameSite: 'strict', // CSRF protection
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/v1/auth', // Limit cookie to auth endpoints
      });

      logger.info('RUNTIME_TRACE REGISTER_COMPLETE', { timestamp: new Date().toISOString() });
      res.status(201).json({
        message: 'User registered successfully',
        user: result.user,
        accessToken: result.tokens.accessToken,
      });
    } catch (error) {
      logger.error('RUNTIME_TRACE REGISTER_FAILED', { timestamp: new Date().toISOString() });
      next(error);
    }
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('🔐 Login request received:', { email: req.body.email });
      const { email, password } = req.body;

      const result = await AuthService.login({ email, password });
      console.log('✅ Login successful for:', email);

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: config.env === 'production', // HTTPS only in production
        sameSite: 'strict', // CSRF protection
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/v1/auth', // Limit cookie to auth endpoints
      });

      res.status(200).json({
        message: 'Login successful',
        user: result.user,
        accessToken: result.tokens.accessToken,
      });
    } catch (error) {
      console.error('❌ Login error:', error);
      next(error);
    }
  }

  /**
   * Logout user
   * POST /api/v1/auth/logout
   */
  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
      const userId = req.user?.userId;

      if (userId && refreshToken) {
        await AuthService.logout(userId, refreshToken);
      }

      // Clear refresh token cookie (must use same path as when it was set)
      res.clearCookie('refreshToken', {
        path: '/api/v1/auth',
      });

      res.status(200).json({
        message: 'Logout successful',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout from all devices
   * POST /api/v1/auth/logout-all
   */
  static async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await AuthService.logoutAll(userId);

      // Clear refresh token cookie (must use same path as when it was set)
      res.clearCookie('refreshToken', {
        path: '/api/v1/auth',
      });

      res.status(200).json({
        message: 'Logged out from all devices successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Refresh token is required',
        });
        return;
      }

      const tokens = await AuthService.refreshToken(refreshToken);

      // Set new refresh token in httpOnly cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: config.env === 'production', // HTTPS only in production
        sameSite: 'strict', // CSRF protection
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/v1/auth', // Limit cookie to auth endpoints
      });

      res.status(200).json({
        message: 'Token refreshed successfully',
        accessToken: tokens.accessToken,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user
   * GET /api/v1/auth/me
   */
  static async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await AuthService.getCurrentUser(userId);

      res.status(200).json({
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   * POST /api/v1/auth/change-password
   */
  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { currentPassword, newPassword } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await AuthService.changePassword(userId, currentPassword, newPassword);

      // Clear refresh token cookie (user will need to login again)
      // Must use same path as when it was set
      res.clearCookie('refreshToken', {
        path: '/api/v1/auth',
      });

      res.status(200).json({
        message: 'Password changed successfully. Please login again.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   */
  static async requestPasswordReset(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      await AuthService.requestPasswordReset(email);

      // Always return success to prevent email enumeration
      res.status(200).json({
        message: 'If the email exists, a password reset link has been sent.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password with token
   * POST /api/v1/auth/reset-password
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, newPassword } = req.body;

      await AuthService.resetPassword(token, newPassword);

      res.status(200).json({
        message: 'Password reset successfully. Please login with your new password.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify email
   * POST /api/v1/auth/verify-email
   */
  static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { token } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await AuthService.verifyEmail(userId, token);

      res.status(200).json({
        message: 'Email verified successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
