/**
 * Platform Account Data Model
 * 
 * Standardized account information from platform discovery
 * Supports platform-specific metadata
 */

import { AccountType, SocialPlatform } from '../adapters/platforms/PlatformAdapter';

export interface PlatformAccountMetadata {
  profileUrl?: string;
  avatarUrl?: string;
  followerCount?: number;
  linkedPageId?: string; // Instagram only
  linkedPageName?: string; // Instagram only
  category?: string; // Facebook only
  [key: string]: any;
}

export interface PlatformAccount {
  platformAccountId: string;
  accountName: string;
  accountType: AccountType;
  metadata: PlatformAccountMetadata;
  pageAccessToken?: string; // Facebook/Instagram only
}

/**
 * Type guard to check if an object is a valid PlatformAccount
 */
export function isPlatformAccount(obj: any): obj is PlatformAccount {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.platformAccountId === 'string' &&
    obj.platformAccountId.length > 0 &&
    typeof obj.accountName === 'string' &&
    obj.accountName.length > 0 &&
    ['personal', 'business', 'creator', 'page', 'organization'].includes(obj.accountType) &&
    typeof obj.metadata === 'object' &&
    obj.metadata !== null
  );
}

/**
 * Type guard to check if account has a page access token (Facebook/Instagram)
 */
export function hasPageAccessToken(account: PlatformAccount): account is PlatformAccount & { pageAccessToken: string } {
  return typeof account.pageAccessToken === 'string' && account.pageAccessToken.length > 0;
}

/**
 * Type guard to check if account is Instagram with linked page
 */
export function isInstagramWithLinkedPage(account: PlatformAccount): boolean {
  return (
    typeof account.metadata.linkedPageId === 'string' &&
    account.metadata.linkedPageId.length > 0 &&
    typeof account.metadata.linkedPageName === 'string'
  );
}

/**
 * Type guard to check if account has follower count
 */
export function hasFollowerCount(account: PlatformAccount): account is PlatformAccount & { metadata: { followerCount: number } } {
  return typeof account.metadata.followerCount === 'number' && account.metadata.followerCount >= 0;
}

/**
 * Validate account structure and required fields
 */
export function validatePlatformAccount(account: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!account) {
    errors.push('Account is null or undefined');
    return { valid: false, errors };
  }

  if (typeof account.platformAccountId !== 'string' || account.platformAccountId.length === 0) {
    errors.push('platformAccountId must be a non-empty string');
  }

  if (typeof account.accountName !== 'string' || account.accountName.length === 0) {
    errors.push('accountName must be a non-empty string');
  }

  if (!['personal', 'business', 'creator', 'page', 'organization'].includes(account.accountType)) {
    errors.push('accountType must be one of: personal, business, creator, page, organization');
  }

  if (typeof account.metadata !== 'object' || account.metadata === null) {
    errors.push('metadata must be an object');
  }

  if (account.pageAccessToken !== undefined && typeof account.pageAccessToken !== 'string') {
    errors.push('pageAccessToken must be a string if provided');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a PlatformAccount with validation
 */
export function createPlatformAccount(data: {
  platformAccountId: string;
  accountName: string;
  accountType: AccountType;
  metadata?: PlatformAccountMetadata;
  pageAccessToken?: string;
}): PlatformAccount {
  const account: PlatformAccount = {
    platformAccountId: data.platformAccountId,
    accountName: data.accountName,
    accountType: data.accountType,
    metadata: data.metadata ?? {},
    pageAccessToken: data.pageAccessToken
  };

  const validation = validatePlatformAccount(account);
  if (!validation.valid) {
    throw new Error(`Invalid PlatformAccount: ${validation.errors.join(', ')}`);
  }

  return account;
}

/**
 * Sanitize account for logging (remove sensitive data)
 */
export function sanitizeAccountForLogging(account: PlatformAccount): Partial<PlatformAccount> {
  return {
    platformAccountId: account.platformAccountId,
    accountName: account.accountName,
    accountType: account.accountType,
    metadata: {
      ...account.metadata,
      // Remove page access token from metadata if present
      pageAccessToken: undefined
    },
    // Remove page access token
    pageAccessToken: account.pageAccessToken ? '[REDACTED]' : undefined
  };
}
