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
import * as crypto from 'crypto';
import bcrypt from 'bcrypt';

async function checkPasswordBreached(password: string): Promise<number> {
  try {
    const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' }
    });
    
    if (!res.ok) return 0; // fail open — never block on API error
    
    const text = await res.text();
    const match = text.split('\n').find(line => line.startsWith(suffix));
    
    if (!match) return 0;
    
    return parseInt(match.split(':')[1], 10);
  } catch {
    return 0; // fail open — never block registration if API is down
  }
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  marketingConsent?: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  trustedDeviceId?: string;
}

interface TwoFactorChallengeResponse {
  requiresTwoFactor: true;
  tempToken: string;
  userId: string;
  message: string;
  riskFactors?: string[];
}

export interface AuthResponse {
  user: Partial<IUser>;
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

      // Check if password has been breached
      const breachCount = await checkPasswordBreached(input.password);
      if (breachCount > 0) {
        throw new BadRequestError(
          `This password has appeared in ${breachCount} data breaches. Please choose a different password.`,
          'PASSWORD_BREACHED'
        );
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
        gdprConsentAt: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: '1.0',
        marketingConsent: input.marketingConsent || false,
      });

      await user.save();
      logger.info('RUNTIME_TRACE USER_CREATED', { timestamp: new Date().toISOString() });

      // Create default workspace for the user
      try {
        const { workspaceService } = await import('./WorkspaceService');
        const workspaceName = `${user.firstName}'s Workspace`;
        const workspaceSlug = `${user.firstName.toLowerCase()}-${Math.random().toString(36).substring(2, 7)}`;
        
        await workspaceService.createWorkspace({
          name: workspaceName,
          slug: workspaceSlug,
          ownerId: user._id,
          description: `Personal workspace for ${user.firstName}`,
        });
        
        logger.info('Default workspace created for new user', { 
          userId: user._id, 
          workspaceName,
          workspaceSlug 
        });
      } catch (wsError: any) {
        logger.error('Failed to create default workspace during registration', {
          userId: user._id,
          error: wsError.message
        });
        // We continue anyway so the user isn't stuck at registration, 
        // though they might hit the onboarding loop if this fails.
      }

      logger.info('User registered successfully', { userId: user._id, email: user.email });
      logger.info('RUNTIME_TRACE WORKSPACE_CREATE_CHECK', { timestamp: new Date().toISOString() });

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const hashedVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
      const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store verification token on user
      user.emailVerificationToken = hashedVerificationToken;
      user.emailVerificationExpiresAt = verificationExpiresAt;
      await user.save();

      // Send email verification email (non-blocking)
      this.sendEmailVerificationEmail(user, verificationToken).catch(err => {
        logger.warn('Failed to send email verification email', { userId: user._id, error: err.message });
      });

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

      // Send welcome email (non-blocking) - Direct email for now since Redis is not available
      this.sendDirectWelcomeEmail(user).catch(err => {
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
      
      // Sanitize and validate input
      const email = input.email.toLowerCase().trim();
      const password = input.password;
      const ipAddress = input.ipAddress;
      const userAgent = input.userAgent;

      // Input validation
      if (!email || !password) {
        throw new BadRequestError('Email and password are required');
      }

      if (email.length > 255) {
        throw new BadRequestError('Email too long');
      }

      if (password.length < 8) {
        throw new BadRequestError('Password must be at least 8 characters');
      }

      if (password.length > 128) {
        throw new BadRequestError('Password too long');
      }

      // Find user with password field and 2FA fields
      const user = await User.findOne({
        email: email.toLowerCase().trim(),
        softDeletedAt: null,
      }).select('+password +refreshTokens +twoFactorSecret');

      // TIMING ATTACK PREVENTION: Always perform password comparison even if user not found
      const dummyHash = '$2b$12$LCKapIvNQLMCQfCLLkBave5JKE0EDvxSFcLSAO5OVKGmVEKSbzUwS'; // Dummy bcrypt hash
      
      if (!user) {
        // Perform dummy comparison to prevent timing attacks
        await bcrypt.compare(password, dummyHash);
        throw new UnauthorizedError('Invalid email or password');
      }

      // Check if account is locked
      if (user.lockUntil && user.lockUntil > new Date()) {
        throw new UnauthorizedError('Account temporarily locked due to too many failed login attempts');
      }

      // Check if user is using OAuth
      if (user.provider !== OAuthProvider.LOCAL) {
        // Still perform dummy comparison for timing consistency
        await bcrypt.compare(password, dummyHash);
        throw new BadRequestError(
          `This account uses ${user.provider.charAt(0).toUpperCase() + user.provider.slice(1)} Sign-In. Please use ${user.provider.charAt(0).toUpperCase() + user.provider.slice(1)} to log in.`
        );
      }

      // Check if email is verified
      if (!user.isEmailVerified) {
        // Still perform password comparison for timing consistency
        await user.comparePassword(password);
        throw new UnauthorizedError('Please verify your email first');
      }

      // Verify password (timing-attack safe)
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        // Increment failed login attempts
        const attempts = (user.loginAttempts || 0) + 1;
        const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : undefined; // 15 minutes lockout
        
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              loginAttempts: attempts,
              lockUntil: lockUntil
            }
          }
        );
        
        throw new UnauthorizedError('Invalid email or password');
      }

      // Reset login attempts on successful password verification
      if (user.loginAttempts > 0) {
        await User.updateOne(
          { _id: user._id },
          {
            $set: { loginAttempts: 0 },
            $unset: { lockUntil: 1 }
          }
        );
      }

      // Calculate login risk score (skip in test environment to avoid ESM conflicts)
      let risk = { score: 0, requiresMFA: false, factors: [] };
      let isTrustedDevice = false;
      
      if (process.env.NODE_ENV !== 'test') {
        const { RiskScoringService } = await import('./RiskScoringService')
        const { LoginHistory } = await import('../models/LoginHistory')
        const { TrustedDevice } = await import('../models/TrustedDevice')
        
        // Check for trusted device cookie
        const trustedDeviceId = input.trustedDeviceId
        
        if (trustedDeviceId) {
          const trustedDevice = await TrustedDevice.findOne({
            userId: user._id,
            deviceId: trustedDeviceId,
            expiresAt: { $gt: new Date() }
          })
          
          if (trustedDevice) {
            isTrustedDevice = true
            // Update last seen
            trustedDevice.lastSeenAt = new Date()
            await trustedDevice.save()
          }
        }
        
        risk = await RiskScoringService.calculateLoginRisk({
          userId: user._id.toString(),
          ipAddress: input.ipAddress || 'unknown',
          userAgent: input.userAgent || 'unknown',
        })

        // Log login attempt
        await LoginHistory.create({
          userId: user._id,
          ipAddress: input.ipAddress || 'unknown',
          userAgent: input.userAgent || 'unknown',
          success: true,
          riskScore: risk.score,
          mfaRequired: risk.requiresMFA && !isTrustedDevice, // Skip MFA for trusted devices
          mfaCompleted: false
        })
      }

      // Check if 2FA is enabled OR risk requires step-up auth (but not for trusted devices)
      const requires2FA = user.twoFactorEnabled && user.twoFactorSecret
      const requiresStepUp = risk.requiresMFA && !user.twoFactorEnabled && !isTrustedDevice
      
      if ((requires2FA || requiresStepUp) && !isTrustedDevice) {
        logger.info('2FA/Step-up challenge required', { 
          userId: user._id, 
          email: user.email,
          riskScore: risk.score,
          riskFactors: risk.factors,
          requires2FA,
          requiresStepUp
        });
        
        // Generate short-lived temp token (5 minutes) for 2FA verification
        const tempToken = TokenService.generateTempToken({
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
          purpose: requiresStepUp ? 'step_up_auth' : '2fa_verification'
        }, '5m');
        
        // Return 2FA challenge response instead of tokens
        return {
          requiresTwoFactor: true,
          tempToken,
          userId: user._id.toString(),
          message: requiresStepUp 
            ? 'Additional authentication required due to suspicious activity'
            : 'Two-factor authentication required',
          riskFactors: requiresStepUp ? risk.factors : undefined
        };
      }

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      logger.info('User logged in successfully', { userId: user._id, email: user.email });

      // Send new device alert if IP changed
      if (user.lastLoginIp && user.lastLoginIp !== ipAddress) {
        const { emailNotificationService } = await import('./EmailNotificationService');
        emailNotificationService.sendNewLoginAlert({
          userId: user._id.toString(),
          email: user.email,
          firstName: user.firstName || 'User',
          ipAddress: ipAddress || 'unknown',
          userAgent: userAgent || 'unknown',
          loginAt: new Date(),
        }).catch(() => {}); // non-blocking
      }
      // Update lastLoginIp
      await User.findByIdAndUpdate(user._id, { $set: { lastLoginIp: ipAddress } });

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
      
      // Remove sensitive fields from user object
      const { password: _, refreshTokens: __, twoFactorSecret: ___, ...safeUser } = user.toObject();
      
      return { user: safeUser, tokens };
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

      // Check if password has been breached
      const breachCount = await checkPasswordBreached(newPassword);
      if (breachCount > 0) {
        throw new BadRequestError(
          `This password has appeared in ${breachCount} data breaches. Please choose a different password.`,
          'PASSWORD_BREACHED'
        );
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
   * Verify email with token
   */
  static async verifyEmail(userId: string, token: string): Promise<void> {
    try {
      // Hash the provided token to match stored hash
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      // Find user by verification token and check expiration
      const user = await User.findOne({
        _id: userId,
        emailVerificationToken: hashedToken,
        emailVerificationExpiresAt: { $gt: new Date() },
        softDeletedAt: null
      }).select('+emailVerificationToken +emailVerificationExpiresAt');

      if (!user) {
        throw new BadRequestError('Invalid or expired verification token');
      }

      // Mark email as verified and clear verification token
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpiresAt = undefined;
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
      const user = await User.findOne({ email: email.toLowerCase(), softDeletedAt: null });
      if (!user) {
        // Don't reveal if email exists (security)
        logger.info('Password reset requested for non-existent email', { email });
        return;
      }

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      // Set token expiration (15 minutes)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      
      // Update user with reset token
      user.passwordResetToken = hashedToken;
      user.passwordResetExpiresAt = expiresAt;
      await user.save();

      // Send password reset email (non-blocking)
      AuthService.sendPasswordResetEmail(user, resetToken).catch(err => {
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
      // Validate new password strength
      const passwordValidation = passwordSchema.safeParse(newPassword);
      if (!passwordValidation.success) {
        throw new BadRequestError(passwordValidation.error.errors[0].message);
      }

      // Check if password has been breached
      const breachCount = await checkPasswordBreached(newPassword);
      if (breachCount > 0) {
        throw new BadRequestError(
          `This password has appeared in ${breachCount} data breaches. Please choose a different password.`,
          'PASSWORD_BREACHED'
        );
      }

      // Hash the provided token to match stored hash
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      // Find user by reset token and check expiration
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpiresAt: { $gt: new Date() },
        softDeletedAt: null
      }).select('+passwordResetToken +passwordResetExpiresAt +refreshTokens');

      if (!user) {
        throw new BadRequestError('Invalid or expired reset token');
      }

      // Update password
      user.password = newPassword;
      
      // Clear reset token
      user.passwordResetToken = undefined;
      user.passwordResetExpiresAt = undefined;
      
      // Revoke all refresh tokens for security
      user.refreshTokens = [];
      
      await user.save();

      logger.info('Password reset completed', { userId: user._id });
    } catch (error) {
      logger.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Send welcome email to new user
   */
  /**
   * Send welcome email directly (fallback when Redis is not available)
   */
  private static async sendDirectWelcomeEmail(user: IUser): Promise<void> {
    try {
      const { emailNotificationService } = await import('./EmailNotificationService');

      // Send a proper welcome email directly
      await emailNotificationService.sendWelcomeEmail({
        to: user.email,
        firstName: user.firstName,
        dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`,
      });
      
      logger.info('Direct welcome email sent', {
        userId: user._id.toString(),
        email: user.email,
        userName: `${user.firstName} ${user.lastName}`,
      });
    } catch (error: any) {
      logger.error('Error sending direct welcome email', { 
        userId: user._id.toString(),
        error: error.message 
      });
      // Don't throw - email failures should not affect registration
    }
  }

  /**
   * Send email verification email
   */
  private static async sendEmailVerificationEmail(user: IUser, verificationToken: string): Promise<void> {
    try {
      const { emailNotificationService } = await import('./EmailNotificationService');

      const verificationUrl = `${config.frontend.url}/auth/verify-email?token=${verificationToken}`;

      // Send email verification email
      await emailNotificationService.sendEmailVerificationEmail({
        to: user.email,
        firstName: user.firstName,
        verificationUrl,
      });

      logger.info('Email verification email sent', {
        to: user.email,
        userId: user._id.toString(),
      });
    } catch (error: any) {
      logger.error('Error sending email verification email', { error: error.message });
      // Don't throw - email failures should not affect registration
    }
  }

  /**
   * Send welcome email using sequence service (requires Redis)
   */
  private static async sendWelcomeEmail(user: IUser): Promise<void> {
    try {
      const { emailSequenceService } = await import('./EmailSequenceService');

      // Start the welcome email sequence
      await emailSequenceService.instance.startSequence(user._id.toString());
      
      logger.info('Welcome email sequence started', {
        userId: user._id.toString(),
        email: user.email,
        userName: `${user.firstName} ${user.lastName}`,
      });
    } catch (error: any) {
      logger.error('Error starting welcome email sequence', { 
        userId: user._id.toString(),
        error: error.message 
      });
      // Don't throw - email failures should not affect registration
    }
  }

  /**
   * Send password reset email
   */
  private static async sendPasswordResetEmail(user: IUser, resetToken: string): Promise<void> {
    try {
      const { emailNotificationService } = await import('./EmailNotificationService');

      const resetUrl = `${config.frontend.url}/auth/reset-password?token=${resetToken}`;

      // Send password reset email
      await emailNotificationService.sendPasswordResetEmail({
        to: user.email,
        firstName: user.firstName,
        resetUrl,
        expiresIn: '15 minutes',
      });

      logger.info('Password reset email sent', {
        to: user.email,
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

      // Remove sensitive fields from user object
      const { password: _, refreshTokens: __, twoFactorSecret: ___, twoFactorBackupCodes: ____, ...safeUser } = user.toObject();

      return {
        user: safeUser,
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
      // Implementation: Generate secure token and store in user model
      const changeToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(changeToken).digest('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      user.pendingEmailChange = {
        newEmail: newEmail.toLowerCase(),
        token: hashedToken,
        expiresAt
      };
      await user.save();
      
      logger.info('Email change requested', {
        userId: user._id.toString(),
        currentEmail: user.email,
        newEmail,
      });

      // TODO: Send verification email to new address
      AuthService.sendEmailChangeVerification(user, newEmail, changeToken).catch(err => {
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
      // Implementation: Check for pending email change and resend if exists
      if (user.pendingEmailChange && user.pendingEmailChange.expiresAt > new Date()) {
        const newToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(newToken).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        user.pendingEmailChange.token = hashedToken;
        user.pendingEmailChange.expiresAt = expiresAt;
        await user.save();
        
        AuthService.sendEmailChangeVerification(user, user.pendingEmailChange.newEmail, newToken).catch(err => {
          logger.warn('Failed to resend email change verification', { 
            userId: user._id, 
            error: err.message 
          });
        });
      } else {
        // Resend regular email verification if no pending change
        if (!user.isEmailVerified) {
          const verificationToken = crypto.randomBytes(32).toString('hex');
          const hashedVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
          const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

          user.emailVerificationToken = hashedVerificationToken;
          user.emailVerificationExpiresAt = verificationExpiresAt;
          await user.save();

          this.sendEmailVerificationEmail(user, verificationToken).catch(err => {
            logger.warn('Failed to resend email verification', { userId: user._id, error: err.message });
          });
        }
      }
      
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
      // Implementation: Clear pending email change from user
      if (user.pendingEmailChange) {
        user.pendingEmailChange = undefined;
        await user.save();
      }
      
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
      // Implementation: Return pending email change if exists and not expired
      if (user.pendingEmailChange && user.pendingEmailChange.expiresAt > new Date()) {
        return {
          newEmail: user.pendingEmailChange.newEmail,
          expiresAt: user.pendingEmailChange.expiresAt
        };
      }
      
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
  private static async sendEmailChangeVerification(user: IUser, newEmail: string, token: string): Promise<void> {
    try {
      // Send email change verification using EmailService
      const { EmailService } = await import('./EmailService');
      const emailService = new EmailService();
      
      const verificationUrl = `${config.frontend.url}/auth/verify-email-change?token=${token}&userId=${user._id}`;
      
      await emailService.sendEmail({
        to: newEmail,
        subject: 'Verify Your New Email Address',
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Verify Your New Email Address</h2>
            <p>Hello ${user.firstName},</p>
            <p>You requested to change your email address from <strong>${user.email}</strong> to <strong>${newEmail}</strong>.</p>
            <p>Please click the link below to verify your new email address:</p>
            <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify New Email</a>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't request this change, please ignore this email.</p>
          </div>
        `
      });
      
      logger.info('Email change verification sent', {
        to: newEmail,
        userId: user._id.toString(),
      });
    } catch (error: any) {
      logger.error('Error sending email change verification', { error: error.message });
    }
  }
}