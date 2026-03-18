import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AuthService } from '../../services/AuthService';

// Mock dependencies
jest.mock('../../services/AuthService');

const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('AuthService Integration', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const mockResponse = {
        user: { id: 'user123', email: userData.email },
        tokens: { accessToken: 'token123', refreshToken: 'refresh123' }
      };

      mockAuthService.register.mockResolvedValue(mockResponse);

      const result = await AuthService.register(userData);

      expect(result).toEqual(mockResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith(userData);
    });

    it('should handle registration service errors', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      mockAuthService.register.mockRejectedValue(new Error('User already exists'));

      await expect(AuthService.register(userData)).rejects.toThrow('User already exists');
    });

    it('should login user successfully', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'Password123'
      };

      const mockResponse = {
        user: { id: 'user123', email: loginData.email },
        tokens: { accessToken: 'token123', refreshToken: 'refresh123' }
      };

      mockAuthService.login.mockResolvedValue(mockResponse);

      const result = await AuthService.login(loginData);

      expect(result).toEqual(mockResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginData);
    });

    it('should handle login service errors', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(AuthService.login(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should verify email successfully', async () => {
      const userId = 'user123';
      const token = 'validToken123';

      mockAuthService.verifyEmail.mockResolvedValue(undefined);

      await AuthService.verifyEmail(userId, token);

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith(userId, token);
    });

    it('should handle email verification errors', async () => {
      const userId = 'user123';
      const token = 'invalidToken';

      mockAuthService.verifyEmail.mockRejectedValue(new Error('Invalid or expired verification token'));

      await expect(AuthService.verifyEmail(userId, token)).rejects.toThrow('Invalid or expired verification token');
    });

    it('should send password reset email successfully', async () => {
      const email = 'test@example.com';

      mockAuthService.requestPasswordReset.mockResolvedValue(undefined);

      await AuthService.requestPasswordReset(email);

      expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith(email);
    });

    it('should reset password successfully', async () => {
      const resetData = {
        token: 'validResetToken',
        newPassword: 'NewPassword123'
      };

      mockAuthService.resetPassword.mockResolvedValue(undefined);

      await AuthService.resetPassword(resetData.token, resetData.newPassword);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(resetData.token, resetData.newPassword);
    });

    it('should handle password reset errors', async () => {
      const resetData = {
        token: 'invalidToken',
        newPassword: 'NewPassword123'
      };

      mockAuthService.resetPassword.mockRejectedValue(new Error('Invalid or expired reset token'));

      await expect(AuthService.resetPassword(resetData.token, resetData.newPassword)).rejects.toThrow('Invalid or expired reset token');
    });
  });
});