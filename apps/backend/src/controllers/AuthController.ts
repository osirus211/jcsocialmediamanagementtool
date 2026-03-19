import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { logger } from '../utils/logger';
import { config } from '../config';
import { UnauthorizedError } from '../utils/errors';

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
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log('🔐 Login request received:', { email: req.body.email });
      const { email, password } = req.body;

      const result = await AuthService.login({ email, password });
      
      // Check if 2FA is required
      if ('requiresTwoFactor' in result) {
        console.log('🔐 2FA challenge required for:', email);
        res.status(200).json({
          requiresTwoFactor: true,
          tempToken: result.tempToken,
          userId: result.userId,
          message: result.message,
        });
        return;
      }

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

  /**
   * Update user profile
   * PATCH /api/v1/auth/profile
   */
  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { firstName, lastName, bio, timezone, language } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const updatedUser = await AuthService.updateProfile(userId, {
        firstName,
        lastName,
        bio,
        timezone,
        language,
      });

      res.status(200).json({
        message: 'Profile updated successfully',
        user: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload avatar
   * POST /api/v1/auth/avatar
   */
  static async uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const avatarUrl = await AuthService.uploadAvatar(userId, req.file);

      res.status(200).json({
        message: 'Avatar uploaded successfully',
        avatarUrl,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get active sessions
   * GET /api/v1/auth/sessions
   */
  static async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const sessions = await AuthService.getSessions(userId);

      res.status(200).json({
        sessions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Revoke specific session
   * DELETE /api/v1/auth/sessions/:sessionId
   */
  static async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { sessionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await AuthService.revokeSession(userId, sessionId);

      res.status(200).json({
        message: 'Session revoked successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update notification preferences
   * PATCH /api/v1/auth/notifications
   */
  static async updateNotificationPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { email, push } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const updatedUser = await AuthService.updateNotificationPreferences(userId, {
        email,
        push,
      });

      res.status(200).json({
        message: 'Notification preferences updated successfully',
        notificationPreferences: updatedUser.notificationPreferences,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete account
   * DELETE /api/v1/auth/account
   */
  static async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { password } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await AuthService.deleteAccount(userId, password);

      // Clear refresh token cookie
      res.clearCookie('refreshToken', {
        path: '/api/v1/auth',
      });

      res.status(200).json({
        message: 'Account deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Complete login after 2FA verification
   * POST /api/v1/auth/complete-login
   */
  static async completeLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, token } = req.body;

      if (!userId || !token) {
        res.status(400).json({ 
          error: 'Bad Request',
          message: 'User ID and verification token are required'
        });
        return;
      }

      const result = await AuthService.completeLogin(userId, token);

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: config.env === 'production', // HTTPS only in production
        sameSite: 'strict', // CSRF protection
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/v1/auth', // Limit cookie to auth endpoints
      });

      res.status(200).json({
        message: 'Login completed successfully',
        user: result.user,
        accessToken: result.tokens.accessToken,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change email address
   * POST /api/v1/auth/change-email
   */
  static async changeEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { newEmail, password } = req.body;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      await AuthService.requestEmailChange(userId, newEmail, password);

      res.status(200).json({
        message: 'Email change verification sent to your new email address',
        verificationSent: true,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend email verification
   * POST /api/v1/auth/resend-email-verification
   */
  static async resendEmailVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      await AuthService.resendEmailVerification(userId);

      res.status(200).json({
        message: 'Verification email resent successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel email change
   * DELETE /api/v1/auth/cancel-email-change
   */
  static async cancelEmailChange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      await AuthService.cancelEmailChange(userId);

      res.status(200).json({
        message: 'Email change cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pending email change
   * GET /api/v1/auth/pending-email-change
   */
  static async getPendingEmailChange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      const pendingChange = await AuthService.getPendingEmailChange(userId);

      res.status(200).json({
        pendingChange,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get login history
   * GET /api/v1/auth/login-history
   */
  static async getLoginHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { limit = 50, offset = 0 } = req.query;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      const activities = await AuthService.getLoginHistory(userId, Number(limit), Number(offset));

      res.status(200).json({
        activities,
        total: activities.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get trusted devices
   * GET /api/v1/auth/trusted-devices
   */
  static async getTrustedDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      const devices = await AuthService.getTrustedDevices(userId);

      res.status(200).json({
        devices,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Revoke trusted device
   * DELETE /api/v1/auth/trusted-devices/:deviceId
   */
  static async revokeTrustedDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { deviceId } = req.params;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      await AuthService.revokeTrustedDevice(userId, deviceId);

      res.status(200).json({
        message: 'Device revoked successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get account status
   * GET /api/v1/auth/account-status
   */
  static async getAccountStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      const status = await AuthService.getAccountStatus(userId);

      res.status(200).json({
        status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export account data
   * GET /api/v1/auth/export-data
   */
  static async exportAccountData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      const exportData = await AuthService.exportAccountData(userId);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="account-data-${new Date().toISOString().split('T')[0]}.json"`);
      
      res.status(200).json(exportData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deactivate account
   * POST /api/v1/auth/deactivate-account
   */
  static async deactivateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { password } = req.body;

      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      await AuthService.deactivateAccount(userId, password);

      // Clear refresh token cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/v1/auth',
      });

      res.status(200).json({
        message: 'Account deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate WebAuthn registration options
   * POST /api/v1/auth/webauthn/register/options
   */
  static async generateWebAuthnRegistrationOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { WebAuthnService } = await import('../services/WebAuthnService');
      const { User } = await import('../models/User');
      
      const user = await User.findById(req.user!.userId);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      
      const options = await WebAuthnService.generateRegistrationOptions(user);
      
      res.json({
        success: true,
        data: options
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify WebAuthn registration
   * POST /api/v1/auth/webauthn/register/verify
   */
  static async verifyWebAuthnRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { WebAuthnService } = await import('../services/WebAuthnService');
      const { User } = await import('../models/User');
      
      const user = await User.findById(req.user!.userId);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      
      const { response } = req.body;
      
      const result = await WebAuthnService.verifyRegistration(user, response);
      
      res.json({
        success: true,
        verified: result.verified
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate WebAuthn authentication options
   * POST /api/v1/auth/webauthn/authenticate/options
   */
  static async generateWebAuthnAuthenticationOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { WebAuthnService } = await import('../services/WebAuthnService');
      const { User } = await import('../models/User');
      const { email } = req.body;
      
      const user = await User.findOne({ email: email.toLowerCase(), softDeletedAt: null });
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }
      
      const options = await WebAuthnService.generateAuthenticationOptions(user);
      
      res.json({
        success: true,
        data: options
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify WebAuthn authentication
   * POST /api/v1/auth/webauthn/authenticate/verify
   */
  static async verifyWebAuthnAuthentication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { WebAuthnService } = await import('../services/WebAuthnService');
      const { AuthTokenService } = await import('../services/AuthTokenService');
      const { User } = await import('../models/User');
      const { email, response } = req.body;
      
      const user = await User.findOne({ email: email.toLowerCase(), softDeletedAt: null });
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }
      
      const result = await WebAuthnService.verifyAuthentication(user, response);
      
      if (result.verified) {
        // Generate tokens
        const tokens = AuthTokenService.generateTokenPair({
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
        });

        // Store refresh token
        await user.addRefreshToken(tokens.refreshToken);

        // Set refresh token in httpOnly cookie
        res.cookie('refreshToken', tokens.refreshToken, {
          httpOnly: true,
          secure: config.env === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/api/v1/auth',
        });

        res.json({
          success: true,
          verified: true,
          accessToken: tokens.accessToken,
          user
        });
      } else {
        res.json({
          success: false,
          verified: false,
          message: 'Authentication failed'
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get connected OAuth providers
   * GET /api/v1/auth/connected-providers
   */
  static async getConnectedProviders(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      // Import SocialAccount model and enum
      const { SocialAccount, SocialPlatform } = await import('../models/SocialAccount');
      
      // Find all social accounts for this user
      const accounts = await SocialAccount.find({ userId });
      
      // Return which providers are connected
      res.json({
        google: false, // Google OAuth is not a social platform in this system
        github: accounts.some(a => a.provider === SocialPlatform.GITHUB),
        apple: accounts.some(a => a.provider === SocialPlatform.APPLE),
      });
    } catch (error) {
      logger.error('Failed to get connected providers:', error);
      next(error);
    }
  }
}

