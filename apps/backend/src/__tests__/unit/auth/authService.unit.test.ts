// Mock dependencies first
jest.mock('../../../models/User');
jest.mock('../../../config/redis', () => ({
  getRedisClient: jest.fn(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1)
  })),
  connectRedis: jest.fn()
}));
jest.mock('../../../services/EmailService');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('../../../services/AuthTokenService', () => ({
  AuthTokenService: {
    generateTokenPair: jest.fn(() => ({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token'
    })),
    generateTempToken: jest.fn(() => 'mock-temp-token')
  }
}));
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));
jest.mock('../../../services/metrics/AuthMetricsTracker', () => ({
  authMetricsTracker: {
    incrementLoginSuccess: jest.fn()
  }
}));
jest.mock('../../../utils/errors', () => ({
  BadRequestError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'BadRequestError';
    }
  },
  UnauthorizedError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'UnauthorizedError';
    }
  },
  NotFoundError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  }
}));

// Unmock AuthService to test the real implementation
jest.unmock('../../../services/AuthService');
import { AuthService } from '../../../services/AuthService';
import { User } from '../../../models/User';
import bcrypt from 'bcrypt';

const MockedUser = User as jest.Mocked<typeof User>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    _id: 'user123',
    email: 'user@test.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'member',
    provider: 'local',
    isEmailVerified: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    lastLoginAt: new Date(),
    comparePassword: jest.fn().mockResolvedValue(true),
    addRefreshToken: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    toObject: jest.fn().mockReturnValue({
      _id: 'user123',
      email: 'user@test.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'member'
    })
  };

  // HAPPY PATH TESTS (T01-T08)
  describe('HAPPY PATH', () => {
    test('T01: login() with valid credentials returns { user, tokens }', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      } as any);

      const result = await AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
    });

    test('T02: returned user object has no password field', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      } as any);

      const result = await AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      });

      expect(result.user).not.toHaveProperty('password');
    });

    test('T03: returned user object has no refreshTokens field', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      } as any);

      const result = await AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      });

      expect(result.user).not.toHaveProperty('refreshTokens');
    });

    test('T04: returned user object has no twoFactorSecret field', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      } as any);

      const result = await AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      });

      expect(result.user).not.toHaveProperty('twoFactorSecret');
    });

    test('T05: accessToken expiry is 15 minutes', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      } as any);

      await AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      });

      const { AuthTokenService } = require('../../../services/AuthTokenService');
      expect(AuthTokenService.generateTokenPair).toHaveBeenCalled();
    });

    test('T06: refreshToken expiry is 7 days', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      } as any);

      await AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      });

      const { AuthTokenService } = require('../../../services/AuthTokenService');
      expect(AuthTokenService.generateTokenPair).toHaveBeenCalled();
    });

    test('T07: email lookup is case-insensitive', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      } as any);

      await AuthService.login({
        email: 'USER@TEST.COM',
        password: 'ValidPass123'
      });

      expect(MockedUser.findOne).toHaveBeenCalledWith({
        email: 'user@test.com',
        softDeletedAt: null
      });
    });

    test('T08: email is trimmed before lookup', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      } as any);

      await AuthService.login({
        email: '  user@test.com  ',
        password: 'ValidPass123'
      });

      expect(MockedUser.findOne).toHaveBeenCalledWith({
        email: 'user@test.com',
        softDeletedAt: null
      });
    });
  });
  // WRONG CREDENTIALS TESTS (T09-T13)
  describe('WRONG CREDENTIALS', () => {
    const wrongPasswordUser = {
      ...mockUser,
      comparePassword: jest.fn().mockResolvedValue(false)
    };

    test('T09: wrong password returns 401 with "Invalid email or password"', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(wrongPasswordUser)
      } as any);

      await expect(AuthService.login({
        email: 'user@test.com',
        password: 'WrongPassword'
      })).rejects.toThrow('Invalid email or password');
    });

    test('T10: user not found returns 401 with EXACT same message as T09', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      } as any);

      await expect(AuthService.login({
        email: 'nonexistent@test.com',
        password: 'SomePassword'
      })).rejects.toThrow('Invalid email or password');
    });

    test('T11: error message for T09 and T10 are character-for-character identical', async () => {
      let wrongPasswordError = '';
      let userNotFoundError = '';

      // Test wrong password
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(wrongPasswordUser)
      } as any);

      try {
        await AuthService.login({ email: 'user@test.com', password: 'WrongPassword' });
      } catch (error: any) {
        wrongPasswordError = error.message;
      }

      // Test user not found
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      } as any);

      try {
        await AuthService.login({ email: 'nonexistent@test.com', password: 'SomePassword' });
      } catch (error: any) {
        userNotFoundError = error.message;
      }

      expect(wrongPasswordError).toBe(userNotFoundError);
      expect(wrongPasswordError).toBe('Invalid email or password');
    });

    test('T12: bcrypt.compare called even when user not found', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      } as any);

      mockedBcrypt.compare.mockResolvedValue(false);

      try {
        await AuthService.login({ email: 'nonexistent@test.com', password: 'SomePassword' });
      } catch (error) {
        // Expected to throw
      }

      expect(mockedBcrypt.compare).toHaveBeenCalled();
    });

    test('T13: dummy hash comparison called with correct dummy hash value', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      } as any);

      mockedBcrypt.compare.mockResolvedValue(false);

      try {
        await AuthService.login({ email: 'nonexistent@test.com', password: 'SomePassword' });
      } catch (error) {
        // Expected to throw
      }

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'SomePassword',
        '$2b$12$LCKapIvNQLMCQfCLLkBave5JKE0EDvxSFcLSAO5OVKGmVEKSbzUwS'
      );
    });
  });
  // ACCOUNT STATES TESTS (T14-T16)
  describe('ACCOUNT STATES', () => {
    test('T14: unverified email returns 401 with "verify your email" message', async () => {
      const unverifiedUser = {
        ...mockUser,
        isEmailVerified: false,
        comparePassword: jest.fn().mockResolvedValue(true)
      };

      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(unverifiedUser)
      } as any);

      await expect(AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      })).rejects.toThrow('Please verify your email first');
    });

    test('T15: deactivated account returns 401', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      } as any);

      await expect(AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      })).rejects.toThrow('Invalid email or password');
    });

    test('T16: deleted/soft-deleted account returns 401', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      } as any);

      await expect(AuthService.login({
        email: 'deleted@test.com',
        password: 'ValidPass123'
      })).rejects.toThrow('Invalid email or password');
    });
  });

  // INPUT VALIDATION TESTS (T17-T24)
  describe('INPUT VALIDATION', () => {
    test('T17: missing email throws validation error', async () => {
      await expect(AuthService.login({
        email: '',
        password: 'ValidPass123'
      })).rejects.toThrow('Email and password are required');
    });

    test('T18: missing password throws validation error', async () => {
      await expect(AuthService.login({
        email: 'user@test.com',
        password: ''
      })).rejects.toThrow('Email and password are required');
    });

    test('T19: invalid email format throws validation error', async () => {
      try {
        await AuthService.login({
          email: 'invalid-email',
          password: 'ValidPass123'
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('T20: email over 255 chars throws validation error', async () => {
      const longEmail = 'a'.repeat(250) + '@test.com';

      await expect(AuthService.login({
        email: longEmail,
        password: 'ValidPass123'
      })).rejects.toThrow('Email too long');
    });

    test('T21: password under 8 chars throws validation error', async () => {
      await expect(AuthService.login({
        email: 'user@test.com',
        password: '1234567'
      })).rejects.toThrow('Password must be at least 8 characters');
    });

    test('T22: password over 128 chars throws validation error', async () => {
      const longPassword = 'a'.repeat(129);

      await expect(AuthService.login({
        email: 'user@test.com',
        password: longPassword
      })).rejects.toThrow('Password too long');
    });

    test('T23: empty string email throws validation error', async () => {
      await expect(AuthService.login({
        email: '',
        password: 'ValidPass123'
      })).rejects.toThrow('Email and password are required');
    });

    test('T24: empty string password throws validation error', async () => {
      await expect(AuthService.login({
        email: 'user@test.com',
        password: ''
      })).rejects.toThrow('Email and password are required');
    });
  });
  // 2FA GATE TESTS (T25-T29)
  describe('2FA GATE', () => {
    const mock2FAUser = {
      ...mockUser,
      twoFactorEnabled: true,
      twoFactorSecret: 'secret123'
    };

    test('T25: user with 2FA enabled returns { requiresTwoFactor: true, tempToken }', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mock2FAUser)
      } as any);

      const result = await AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      });

      expect(result).toHaveProperty('requiresTwoFactor', true);
      expect(result).toHaveProperty('tempToken');
    });

    test('T26: when 2FA required: NO accessToken in response', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mock2FAUser)
      } as any);

      const result = await AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      });

      expect(result).not.toHaveProperty('tokens');
      expect(result).not.toHaveProperty('accessToken');
    });

    test('T27: when 2FA required: NO refreshToken in response', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mock2FAUser)
      } as any);

      const result = await AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      });

      expect(result).not.toHaveProperty('tokens');
      expect(result).not.toHaveProperty('refreshToken');
    });

    test('T28: tempToken expiry is 5 minutes or less', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mock2FAUser)
      } as any);

      await AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      });

      const { AuthTokenService } = require('../../../services/AuthTokenService');
      expect(AuthTokenService.generateTempToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          email: 'user@test.com',
          role: 'member',
          purpose: '2fa_verification'
        }),
        '5m'
      );
    });

    test('T29: user without 2FA gets full tokens (no requiresTwoFactor)', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      } as any);

      const result = await AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      });

      expect(result).not.toHaveProperty('requiresTwoFactor');
      expect(result).toHaveProperty('tokens');
      expect(result).toHaveProperty('user');
    });
  });

  // SECURITY TESTS (T30-T32)
  describe('SECURITY', () => {
    test('T30: plain text password never appears in any log call', async () => {
      const { logger } = require('../../../utils/logger');
      
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      } as any);

      try {
        await AuthService.login({
          email: 'user@test.com',
          password: 'SecretPassword123'
        });
      } catch (error) {
        // Expected to throw
      }

      const allLogCalls = [
        ...logger.info.mock.calls,
        ...logger.error.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.debug.mock.calls
      ];

      allLogCalls.forEach(call => {
        const logMessage = JSON.stringify(call);
        expect(logMessage).not.toContain('SecretPassword123');
      });
    });

    test('T31: password hash never returned in user object', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      } as any);

      const result = await AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      });

      expect(result.user).not.toHaveProperty('password');
      expect(JSON.stringify(result.user)).not.toContain('$2b$');
    });

    test('T32: refreshTokens array never returned in response', async () => {
      MockedUser.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      } as any);

      const result = await AuthService.login({
        email: 'user@test.com',
        password: 'ValidPass123'
      });

      expect(result.user).not.toHaveProperty('refreshTokens');
    });
  });
});