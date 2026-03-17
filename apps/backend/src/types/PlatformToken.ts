/**
 * Platform Token Data Model
 * 
 * Normalized token structure across all platforms
 * Provides type guards for token validation
 */

import { SocialPlatform, TokenType } from '../adapters/platforms/PlatformAdapter';

export interface PlatformToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  expiresIn?: number; // Added missing property
  tokenType: TokenType;
  platform: SocialPlatform;
  scope?: string[]; // Added missing property
}

/**
 * Type guard to check if an object is a valid PlatformToken
 */
export function isPlatformToken(obj: any): obj is PlatformToken {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.accessToken === 'string' &&
    obj.accessToken.length > 0 &&
    (obj.refreshToken === null || typeof obj.refreshToken === 'string') &&
    (obj.expiresAt === null || obj.expiresAt instanceof Date) &&
    ['bearer', 'page', 'user'].includes(obj.tokenType) &&
    ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'].includes(obj.platform)
  );
}

/**
 * Type guard to check if a token has a refresh token
 */
export function hasRefreshToken(token: PlatformToken): token is PlatformToken & { refreshToken: string } {
  return token.refreshToken !== null && token.refreshToken.length > 0;
}

/**
 * Type guard to check if a token has an expiry date
 */
export function hasExpiryDate(token: PlatformToken): token is PlatformToken & { expiresAt: Date } {
  return token.expiresAt !== null && token.expiresAt instanceof Date;
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: PlatformToken, bufferMinutes: number = 5): boolean {
  if (!hasExpiryDate(token)) {
    return false; // No expiry date means token doesn't expire
  }

  const now = new Date();
  const bufferMs = bufferMinutes * 60 * 1000;
  const expiryWithBuffer = new Date(token.expiresAt.getTime() - bufferMs);

  return now >= expiryWithBuffer;
}

/**
 * Check if a token is expiring soon (within threshold)
 */
export function isTokenExpiringSoon(token: PlatformToken, thresholdMinutes: number = 15): boolean {
  if (!hasExpiryDate(token)) {
    return false; // No expiry date means token doesn't expire
  }

  const now = new Date();
  const thresholdMs = thresholdMinutes * 60 * 1000;
  const expiryThreshold = new Date(token.expiresAt.getTime() - thresholdMs);

  return now >= expiryThreshold;
}

/**
 * Validate token structure and required fields
 */
export function validatePlatformToken(token: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!token) {
    errors.push('Token is null or undefined');
    return { valid: false, errors };
  }

  if (typeof token.accessToken !== 'string' || token.accessToken.length === 0) {
    errors.push('accessToken must be a non-empty string');
  }

  if (token.refreshToken !== null && typeof token.refreshToken !== 'string') {
    errors.push('refreshToken must be a string or null');
  }

  if (token.expiresAt !== null && !(token.expiresAt instanceof Date)) {
    errors.push('expiresAt must be a Date or null');
  }

  if (!['bearer', 'page', 'user'].includes(token.tokenType)) {
    errors.push('tokenType must be "bearer", "page", or "user"');
  }

  if (!['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'].includes(token.platform)) {
    errors.push('platform must be one of: facebook, instagram, twitter, linkedin, tiktok');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a PlatformToken with validation
 */
export function createPlatformToken(data: {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  tokenType: TokenType;
  platform: SocialPlatform;
}): PlatformToken {
  const token: PlatformToken = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? null,
    expiresAt: data.expiresAt ?? null,
    tokenType: data.tokenType,
    platform: data.platform
  };

  const validation = validatePlatformToken(token);
  if (!validation.valid) {
    throw new Error(`Invalid PlatformToken: ${validation.errors.join(', ')}`);
  }

  return token;
}
