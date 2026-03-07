/**
 * Token Expiration Guard Utility
 * 
 * Provides guard functions to check token expiration before API calls
 * 
 * Features:
 * - Pre-call expiration validation
 * - Automatic refresh trigger for expiring tokens
 * - Clear error messages for expired tokens
 * - No tokens in error messages
 */

import { ISocialAccount, AccountStatus } from '../models/SocialAccount';
import { logger } from './logger';

export class TokenExpiredError extends Error {
  constructor(
    message: string,
    public readonly accountId: string,
    public readonly accountName: string
  ) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class TokenExpiringSoonError extends Error {
  constructor(
    message: string,
    public readonly accountId: string,
    public readonly accountName: string,
    public readonly daysUntilExpiry: number
  ) {
    super(message);
    this.name = 'TokenExpiringSoonError';
  }
}

/**
 * Assert that account token is not expired
 * Throws TokenExpiredError if token is expired
 */
export function assertTokenNotExpired(account: ISocialAccount): void {
  if (!account.tokenExpiresAt) {
    // No expiration date means token doesn't expire
    return;
  }

  const now = new Date();
  const expiresAt = new Date(account.tokenExpiresAt);

  if (now >= expiresAt) {
    logger.warn('Token expired, blocking API call', {
      accountId: account._id,
      accountName: account.accountName,
      expiresAt,
    });

    throw new TokenExpiredError(
      'Access token has expired. Please reconnect your Instagram account.',
      account._id.toString(),
      account.accountName
    );
  }
}

/**
 * Assert that account token is not expiring soon
 * Throws TokenExpiringSoonError if token is expiring within threshold
 */
export function assertTokenNotExpiringSoon(
  account: ISocialAccount,
  thresholdDays: number = 7
): void {
  if (!account.tokenExpiresAt) {
    // No expiration date means token doesn't expire
    return;
  }

  const now = new Date();
  const expiresAt = new Date(account.tokenExpiresAt);
  const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry <= thresholdDays && daysUntilExpiry > 0) {
    logger.warn('Token expiring soon, should refresh', {
      accountId: account._id,
      accountName: account.accountName,
      daysUntilExpiry: Math.floor(daysUntilExpiry),
      threshold: thresholdDays,
    });

    throw new TokenExpiringSoonError(
      `Access token expires in ${Math.floor(daysUntilExpiry)} days. Please refresh your connection.`,
      account._id.toString(),
      account.accountName,
      Math.floor(daysUntilExpiry)
    );
  }
}

/**
 * Check if account is in a valid state for API calls
 * Returns true if account can be used, false otherwise
 */
export function isAccountUsable(account: ISocialAccount): boolean {
  // Check account status
  if (
    account.status === AccountStatus.DISCONNECTED ||
    account.status === AccountStatus.REAUTH_REQUIRED ||
    account.status === AccountStatus.PERMISSION_REVOKED
  ) {
    return false;
  }

  // Check token expiration
  if (account.tokenExpiresAt) {
    const now = new Date();
    const expiresAt = new Date(account.tokenExpiresAt);

    if (now >= expiresAt) {
      return false;
    }
  }

  return true;
}

/**
 * Get days until token expiration
 * Returns null if no expiration date
 */
export function getDaysUntilExpiration(account: ISocialAccount): number | null {
  if (!account.tokenExpiresAt) {
    return null;
  }

  const now = new Date();
  const expiresAt = new Date(account.tokenExpiresAt);
  const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  return Math.floor(daysUntilExpiry);
}

/**
 * Validate token expiration and warn if < 50 days
 * Used during token exchange to validate new tokens
 */
export function validateTokenExpiration(
  expiresAt: Date | undefined,
  context: string
): void {
  if (!expiresAt) {
    logger.warn('Token has no expiration date', { context });
    return;
  }

  const now = new Date();
  const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry < 50) {
    logger.warn('Token expiration is less than 50 days', {
      context,
      daysUntilExpiry: Math.floor(daysUntilExpiry),
      expiresAt,
    });
  } else {
    logger.info('Token expiration validated', {
      context,
      daysUntilExpiry: Math.floor(daysUntilExpiry),
      expiresAt,
    });
  }
}
