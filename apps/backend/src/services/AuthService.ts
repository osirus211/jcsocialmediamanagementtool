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

export interface AuthResponse {
  user: IUser;
  tokens: TokenPair;
}

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
  static async login(input: LoginInput): Promise<AuthResponse> {
    try {
      logger.info('RUNTIME_TRACE LOGIN_START', { timestamp: new Date().toISOString() });
      // Find user with password field
      const user = await User.findOne({
        email: input.email.toLowerCase(),
        softDeletedAt: null,
      }).select('+password +refreshTokens');

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

      await emailNotificationService.sendUserSignup({
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

      await emailNotificationService.sendPasswordReset({
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
}
