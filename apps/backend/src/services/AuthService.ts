import { User, IUser, passwordSchema, emailSchema, OAuthProvider } from '../models/User';
import { AuthTokenService as TokenService, TokenPair } from './AuthTokenService';
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from '../utils/errors';
import { logger } from '../utils/logger';
import { authMetricsTracker } from './metrics/AuthMetricsTracker';
import { config } from '../config';

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

interface TwoFactorChallengeResponse {
  requiresTwoFactor: true;
  userId: string;
  message: string;
}

export interface AuthResponse {
  user: IUser;
  tokens: TokenPair;
}

type LoginResponse = AuthResponse | TwoFactorChallengeResponse;

export class AuthService {
  /**
   * Register a new user
   */
  static async register(input: RegisterInput): Promise<AuthResponse> {
    try {
      // Validate email
      const emailValidation = emailSchema.safeParse(input.email);
      if (!emailValidation.success) {
        throw new BadRequestError('Invalid email address');
      }

      // Validate password strength
      const passwordValidation = passwordSchema.safeParse(input.password);
      if (!passwordValidation.success) {
        throw new BadRequestError(passwordValidation.error.errors[0].message);
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        email: input.email.toLowerCase(),
        softDeletedAt: null,
      });

      if (existingUser) {
        logger.info('RUNTIME_TRACE DUPLICATE_REGISTRATION_BLOCKED', { timestamp: new Date().toISOString() });
        throw new ConflictError('User with this email already exists');
      }

      logger.info('RUNTIME_TRACE USER_CREATING', { timestamp: new Date().toISOString() });
      // Create user
      const user = new User({
        email: input.email.toLowerCase(),
        password: input.password, // Will be hashed by pre-save hook
        firstName: input.firstName,
        lastName: input.lastName,
        provider: OAuthProvider.LOCAL,
      });

      await user.save();
      logger.info('RUNTIME_TRACE USER_CREATED', { timestamp: new Date().toISOString() });

      logger.info('User registered successfully', { userId: user._id, email: user.email });
      logger.info('RUNTIME_TRACE WORKSPACE_CREATE_CHECK', { timestamp: new Date().toISOString() });

      // Generate tokens
      const tokens = TokenService.generateTokenPair({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      // Store refresh token
      await user.addRefreshToken(tokens.refreshToken);

      // Increment register success metric
      authMetricsTracker.incrementRegisterSuccess();

      // Send welcome email (non-blocking)
      this.sendWelcomeEmail(user).catch(err => {
        logger.warn('Failed to send welcome email', { userId: user._id, error: err.message });
      });

      logger.info('RUNTIME_TRACE REGISTER_FLOW_END', { timestamp: new Date().toISOString() });
      return { user, tokens };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Login user with email and password
   */
  static async login(input: LoginInput): Promise<LoginResponse> {
    try {
      logger.info('RUNTIME_TRACE LOGIN_START', { timestamp: new Date().toISOString() });
      // Find user with password field and 2FA fields
      const user = await User.findOne({
        email: input.email.toLowerCase(),
        softDeletedAt: null,
      }).select('+password +refreshTokens +twoFactorSecret');

      if (!user) {
        // Use generic message to prevent email enumeration
        throw new UnauthorizedError('Invalid email or password');
      }

      // Check if user is using OAuth
      if (user.provider !== OAuthProvider.LOCAL) {
        throw new BadRequestError(
          `Please sign in with ${user.provider.charAt(0).toUpperCase() + user.provider.slice(1)}`
        );
      }

      // Verify password (timing-attack safe)
      const isPasswordValid = await user.comparePassword(input.password);
      if (!isPasswordValid) {
        throw new UnauthorizedError('Invalid email or password');
      }

      // Check if 2FA is enabled
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        logger.info('2FA challenge required', { userId: user._id, email: user.email });
        
        // Return 2FA challenge response instead of tokens
        return {
          requiresTwoFactor: true,
          userId: user._id.toString(),
          message: 'Two-factor authentication required'
        };
      }

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      logger.info('User logged in successfully', { userId: user._id, email: user.email });

      // Generate tokens
      const tokens = TokenService.generateTokenPair({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      // Store refresh token
      await user.addRefreshToken(tokens.refreshToken);

      // Increment login success metric
      authMetricsTracker.incrementLoginSuccess();

      logger.info('RUNTIME_TRACE LOGIN_SUCCESS', { timestamp: new Date().toISOString() });
      return { user, tokens };
    } catch (error) {
      logger.error('RUNTIME_TRACE LOGIN_FAILED', { timestamp: new Date().toISOString() });
      logger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Logout user (revoke refresh token)
   */
  static async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      const user = await User.findById(userId).select('+refreshTokens');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Revoke refresh token (blacklist and remove from family)
      await TokenService.revokeRefreshToken(refreshToken);

      // Remove the specific refresh token from user
      await user.removeRefreshToken(refreshToken);

      logger.info('User logged out successfully', { userId: user._id });
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Logout from all devices (revoke all refresh tokens)
   */
  static async logoutAll(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId).select('+refreshTokens');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Revoke all refresh tokens
      for (const token of user.refreshTokens) {
        await TokenService.revokeRefreshToken(token);
      }

      // Clear all tokens from user
      await user.revokeAllTokens();

      logger.info('User logged out from all devices', { userId: user._id });
    } catch (error) {
      logger.error('Logout all error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token with rotation
   */
  static async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      logger.info('RUNTIME_TRACE REFRESH_START', { timestamp: new Date().toISOString() });
      // Rotate refresh token (includes reuse detection)
      logger.info('RUNTIME_TRACE TOKEN_ROTATED', { timestamp: new Date().toISOString() });
      const tokens = await TokenService.rotateRefreshToken(refreshToken);

      // Find user
      const user = await User.findById(tokens.tokenFamily).select('+refreshTokens');
      if (!user) {
        // Extract userId from old token
        const decoded = TokenService.decodeToken(refreshToken);
        if (decoded) {
          const userById = await User.findById(decoded.userId).select('+refreshTokens');
          if (userById) {
            // Atomic token replacement - remove old and add new
            userById.refreshTokens = userById.refreshTokens.filter(t => t !== refreshToken);
            userById.refreshTokens.push(tokens.refreshToken);
            await userById.save();
            
            logger.info('Token refreshed successfully with rotation', { userId: userById._id });
            return tokens;
          }
        }
        throw new UnauthorizedError('User not found');
      }

      // Atomic token replacement - remove old and add new
      user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
      user.refreshTokens.push(tokens.refreshToken);
      await user.save();

      logger.info('Token refreshed successfully with rotation', { userId: user._id });
      logger.info('RUNTIME_TRACE REFRESH_SUCCESS', { timestamp: new Date().toISOString() });

      return tokens;
    } catch (error) {
      logger.error('RUNTIME_TRACE REFRESH_FAILED', { timestamp: new Date().toISOString() });
      logger.error('Token refresh error:', error);
      
      // If token reuse detected, revoke all tokens (token family breach)
      if (error instanceof UnauthorizedError && error.message.includes('reuse')) {
        logger.error('SECURITY ALERT: Token reuse detected during refresh', {
          timestamp: new Date().toISOString(),
        });
        
        // Extract userId from the reused token to revoke all tokens
        try {
          const decoded = TokenService.decodeToken(refreshToken);
          if (decoded && decoded.userId) {
            const user = await User.findById(decoded.userId).select('+refreshTokens');
            if (user) {
              // Revoke all refresh tokens
              for (const token of user.refreshTokens) {
                await TokenService.revokeRefreshToken(token);
              }
              // Clear all tokens from user
              await user.revokeAllTokens();
              logger.error('All tokens revoked due to token reuse detection', { userId: user._id });
            }
          }
        } catch (revokeError) {
          logger.error('Failed to revoke tokens after reuse detection:', revokeError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Get current user by ID
   */
  static async getCurrentUser(userId: string): Promise<IUser> {
    try {
      const user = await User.findOne({ _id: userId, softDeletedAt: null });
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return user;
    } catch (error) {
      logger.error('Get current user error:', error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // Find user with password
      const user = await User.findById(userId).select('+password +refreshTokens');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if user is using OAuth
      if (user.provider !== OAuthProvider.LOCAL) {
        throw new BadRequestError('Cannot change password for OAuth users');
      }

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        throw new UnauthorizedError('Current password is incorrect');
      }

      // Validate new password strength
      const passwordValidation = passwordSchema.safeParse(newPassword);
      if (!passwordValidation.success) {
        throw new BadRequestError(passwordValidation.error.errors[0].message);
      }

      // Check if new password is same as current
      const isSamePassword = await user.comparePassword(newPassword);
      if (isSamePassword) {
        throw new BadRequestError('New password must be different from current password');
      }

      // Update password (will be hashed by pre-save hook)
      user.password = newPassword;
      await user.save();

      // Revoke all refresh tokens for security
      await user.revokeAllTokens();

      logger.info('Password changed successfully', { userId: user._id });
    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Verify email (placeholder for email verification flow)
   */
  static async verifyEmail(userId: string, token: string): Promise<void> {
    try {
      // TODO: Implement email verification logic
      // 1. Verify token
      // 2. Update user.isEmailVerified = true
      // 3. Remove verification token

      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      user.isEmailVerified = true;
      await user.save();

      logger.info('Email verified successfully', { userId: user._id });
    } catch (error) {
      logger.error('Email verification error:', error);
      throw error;
    }
  }

  /**
   * Request password reset (placeholder for password reset flow)
   */
  static async requestPasswordReset(email: string): Promise<void> {
    try {
      // TODO: Implement password reset request logic
      // 1. Find user by email
      // 2. Generate reset token
      // 3. Send reset email
      // 4. Store token with expiration

      const user = await User.findOne({ email: email.toLowerCase(), softDeletedAt: null });
      if (!user) {
        // Don't reveal if email exists (security)
        logger.info('Password reset requested for non-existent email', { email });
        return;
      }

      // Send password reset email (non-blocking)
      AuthService.sendPasswordResetEmail(user).catch(err => {
        logger.warn('Failed to send password reset email', { userId: user._id, error: err.message });
      });

      logger.info('Password reset requested', { userId: user._id, email: user.email });
    } catch (error) {
      logger.error('Password reset request error:', error);
      throw error;
    }
  }

  /**
   * Reset password with token (placeholder for password reset flow)
   */
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      // TODO: Implement password reset logic
      // 1. Verify reset token
      // 2. Find user by token
      // 3. Update password
      // 4. Revoke all tokens
      // 5. Remove reset token

      // Validate new password strength
      const passwordValidation = passwordSchema.safeParse(newPassword);
      if (!passwordValidation.success) {
        throw new BadRequestError(passwordValidation.error.errors[0].message);
      }

      logger.info('Password reset completed');
    } catch (error) {
      logger.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Send welcome email to new user
   */
  private static async sendWelcomeEmail(user: IUser): Promise<void> {
    try {
      const { emailNotificationService } = await import('./EmailNotificationService');

      // Stub implementation - email service method doesn't exist yet
      logger.info('Welcome email would be sent', {
        to: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        userId: user._id.toString(),
      });
    } catch (error: any) {
      logger.error('Error sending welcome email', { error: error.message });
      // Don't throw - email failures should not affect registration
    }
  }

  /**
   * Send password reset email
   */
  private static async sendPasswordResetEmail(user: IUser): Promise<void> {
    try {
      const { emailNotificationService } = await import('./EmailNotificationService');

      // TODO: Generate actual reset token and URL
      const resetUrl = `${config.frontend.url}/reset-password?token=placeholder`;

      // Stub implementation - email service method doesn't exist yet
      logger.info('Password reset email would be sent', {
        to: user.email,
        resetUrl,
        expiresIn: '1 hour',
        userId: user._id.toString(),
      });
    } catch (error: any) {
      logger.error('Error sending password reset email', { error: error.message });
      // Don't throw - email failures should not affect password reset flow
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, updates: {
    firstName?: string;
    lastName?: string;
    bio?: string;
    timezone?: string;
    language?: string;
  }): Promise<IUser> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Update fields
      if (updates.firstName !== undefined) user.firstName = updates.firstName;
      if (updates.lastName !== undefined) user.lastName = updates.lastName;
      if (updates.bio !== undefined) user.bio = updates.bio;
      if (updates.timezone !== undefined) user.timezone = updates.timezone;
      if (updates.language !== undefined) user.language = updates.language;

      await user.save();

      logger.info('User profile updated', {
        userId: user._id.toString(),
        updatedFields: Object.keys(updates),
      });

      return user;
    } catch (error: any) {
      logger.error('Error updating user profile', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Upload avatar
   */
  static async uploadAvatar(userId: string, file: Express.Multer.File): Promise<string> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // TODO: Implement actual file upload to cloud storage
      // For now, we'll simulate the upload
      const avatarUrl = `/uploads/avatars/${userId}-${Date.now()}.${file.originalname.split('.').pop()}`;
      
      user.avatar = avatarUrl;
      await user.save();

      logger.info('User avatar uploaded', {
        userId: user._id.toString(),
        avatarUrl,
      });

      return avatarUrl;
    } catch (error: any) {
      logger.error('Error uploading avatar', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get active sessions
   */
  static async getSessions(userId: string): Promise<Array<{
    id: string;
    device: string;
    location: string;
    lastActive: Date;
    current: boolean;
  }>> {
    try {
      const user = await User.findById(userId).select('+refreshTokens');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // TODO: Implement actual session tracking with device/location info
      // For now, return mock data based on refresh tokens
      const sessions = user.refreshTokens.map((token, index) => ({
        id: token.substring(0, 8),
        device: index === 0 ? 'Current Device' : `Device ${index + 1}`,
        location: 'Unknown Location',
        lastActive: new Date(),
        current: index === 0,
      }));

      return sessions;
    } catch (error: any) {
      logger.error('Error getting user sessions', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Revoke specific session
   */
  static async revokeSession(userId: string, sessionId: string): Promise<void> {
    try {
      const user = await User.findById(userId).select('+refreshTokens');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Find token by session ID (first 8 chars)
      const tokenIndex = user.refreshTokens.findIndex(token => 
        token.substring(0, 8) === sessionId
      );

      if (tokenIndex === -1) {
        throw new NotFoundError('Session not found');
      }

      user.refreshTokens.splice(tokenIndex, 1);
      await user.save();

      logger.info('User session revoked', {
        userId: user._id.toString(),
        sessionId,
      });
    } catch (error: any) {
      logger.error('Error revoking user session', {
        userId,
        sessionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update notification preferences
   */
  static async updateNotificationPreferences(userId: string, preferences: {
    email?: {
      postPublished?: boolean;
      postFailed?: boolean;
      weeklyReport?: boolean;
      accountIssues?: boolean;
    };
    push?: {
      postPublished?: boolean;
      postFailed?: boolean;
      accountIssues?: boolean;
    };
  }): Promise<IUser> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Update notification preferences
      if (preferences.email) {
        Object.assign(user.notificationPreferences.email, preferences.email);
      }
      if (preferences.push) {
        Object.assign(user.notificationPreferences.push, preferences.push);
      }

      await user.save();

      logger.info('User notification preferences updated', {
        userId: user._id.toString(),
      });

      return user;
    } catch (error: any) {
      logger.error('Error updating notification preferences', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete account (soft delete with GDPR compliance)
   */
  static async deleteAccount(userId: string, password: string): Promise<void> {
    try {
      // Use GDPR service for compliant account deletion
      const { GDPRService } = await import('./GDPRService');
      await GDPRService.requestAccountDeletion(userId, password);

      logger.info('Account deletion requested via GDPR service', { userId });
    } catch (error: any) {
      logger.error('Error requesting account deletion', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Complete login after 2FA verification
   * POST /api/v1/auth/complete-login
   */
  static async completeLogin(userId: string, token: string): Promise<AuthResponse> {
    try {
      const user = await User.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (!user.twoFactorEnabled) {
        throw new BadRequestError('Two-factor authentication is not enabled for this user');
      }

      // Import TwoFactorService dynamically to avoid circular dependency
      const { TwoFactorService } = await import('./TwoFactorService');
      
      const isValidToken = await TwoFactorService.verifyToken(token, user.twoFactorSecret!);
      if (!isValidToken) {
        // authMetricsTracker.recordFailedLogin(user.email, '2FA verification failed');
        throw new UnauthorizedError('Invalid verification code');
      }

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      // Generate tokens
      const tokens = await TokenService.generateTokenPair({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      // Add refresh token to user
      await user.addRefreshToken(tokens.refreshToken);

      // authMetricsTracker.recordSuccessfulLogin(user.email);

      logger.info('2FA login completed successfully', {
        userId: user._id.toString(),
        email: user.email,
      });

      return {
        user,
        tokens,
      };
    } catch (error: any) {
      logger.error('Error completing 2FA login', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Request email change
   */
  static async requestEmailChange(userId: string, newEmail: string, password: string): Promise<void> {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Verify password for local accounts
      if (user.provider === OAuthProvider.LOCAL) {
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
          throw new UnauthorizedError('Invalid password');
        }
      }

      // Check if new email is already in use
      const existingUser = await User.findOne({ 
        email: newEmail.toLowerCase(), 
        softDeletedAt: null 
      });
      if (existingUser) {
        throw new BadRequestError('Email address is already in use');
      }

      // TODO: Generate verification token and store pending email change
      // For now, we'll simulate the process
      logger.info('Email change requested', {
        userId: user._id.toString(),
        currentEmail: user.email,
        newEmail,
      });

      // TODO: Send verification email to new address
      AuthService.sendEmailChangeVerification(user, newEmail).catch(err => {
        logger.warn('Failed to send email change verification', { 
          userId: user._id, 
          error: err.message 
        });
      });
    } catch (error: any) {
      logger.error('Error requesting email change', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Resend email verification
   */
  static async resendEmailVerification(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // TODO: Check if there's a pending email change and resend verification
      logger.info('Email verification resent', {
        userId: user._id.toString(),
      });
    } catch (error: any) {
      logger.error('Error resending email verification', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel email change
   */
  static async cancelEmailChange(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // TODO: Remove pending email change record
      logger.info('Email change cancelled', {
        userId: user._id.toString(),
      });
    } catch (error: any) {
      logger.error('Error cancelling email change', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get pending email change
   */
  static async getPendingEmailChange(userId: string): Promise<any> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // TODO: Return actual pending email change from database
      // For now, return null (no pending changes)
      return null;
    } catch (error: any) {
      logger.error('Error getting pending email change', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get login history
   */
  static async getLoginHistory(userId: string, limit: number, offset: number): Promise<Array<{
    id: string;
    timestamp: string;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    location?: string;
    device?: string;
  }>> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // TODO: Implement actual login history tracking
      // For now, return mock data
      const mockHistory = Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
        id: `login_${i + 1}`,
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        ipAddress: `192.168.1.${100 + i}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        success: Math.random() > 0.1, // 90% success rate
        location: 'Unknown',
        device: 'Desktop',
      }));

      return mockHistory;
    } catch (error: any) {
      logger.error('Error getting login history', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get trusted devices
   */
  static async getTrustedDevices(userId: string): Promise<Array<{
    id: string;
    name: string;
    browser: string;
    os: string;
    lastUsed: string;
    isCurrent: boolean;
    fingerprint: string;
  }>> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // TODO: Implement actual trusted device tracking
      // For now, return mock data
      const mockDevices = [
        {
          id: 'device_1',
          name: 'Current Device',
          browser: 'Chrome 120',
          os: 'Windows 10',
          lastUsed: new Date().toISOString(),
          isCurrent: true,
          fingerprint: 'fp_current',
        },
        {
          id: 'device_2',
          name: 'Mobile Device',
          browser: 'Safari 17',
          os: 'iOS 17',
          lastUsed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          isCurrent: false,
          fingerprint: 'fp_mobile',
        },
      ];

      return mockDevices;
    } catch (error: any) {
      logger.error('Error getting trusted devices', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Revoke trusted device
   */
  static async revokeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // TODO: Implement actual device revocation
      logger.info('Trusted device revoked', {
        userId: user._id.toString(),
        deviceId,
      });
    } catch (error: any) {
      logger.error('Error revoking trusted device', {
        userId,
        deviceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get account status
   */
  static async getAccountStatus(userId: string): Promise<{
    status: 'active' | 'suspended' | 'deactivated';
    createdAt: string;
    lastLoginAt: string;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      return {
        status: user.softDeletedAt ? 'deactivated' : 'active',
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() || user.createdAt.toISOString(),
        emailVerified: user.isEmailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      };
    } catch (error: any) {
      logger.error('Error getting account status', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Export account data (GDPR compliance)
   */
  static async exportAccountData(userId: string): Promise<any> {
    try {
      // Use GDPR service for compliant data export
      const { GDPRService } = await import('./GDPRService');
      const result = await GDPRService.exportUserData(userId, 'json');
      
      logger.info('Account data exported via GDPR service', {
        userId,
        requestId: result.requestId,
      });

      return result.data;
    } catch (error: any) {
      logger.error('Error exporting account data', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Deactivate account (soft delete)
   */
  static async deactivateAccount(userId: string, password: string): Promise<void> {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Verify password for local accounts
      if (user.provider === OAuthProvider.LOCAL) {
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
          throw new UnauthorizedError('Invalid password');
        }
      }

      // Soft delete the user (deactivate)
      user.softDeletedAt = new Date();
      user.refreshTokens = []; // Clear all sessions
      await user.save();

      logger.info('User account deactivated', {
        userId: user._id.toString(),
      });
    } catch (error: any) {
      logger.error('Error deactivating user account', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Send email change verification
   */
  private static async sendEmailChangeVerification(user: IUser, newEmail: string): Promise<void> {
    try {
      // TODO: Generate verification token and send email
      logger.info('Email change verification would be sent', {
        to: newEmail,
        userId: user._id.toString(),
      });
    } catch (error: any) {
      logger.error('Error sending email change verification', { error: error.message });
    }
  }
}