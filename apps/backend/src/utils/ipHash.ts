/**
 * IP Address Hashing Utility
 * 
 * Provides secure IP address hashing for privacy-preserving logging
 * Uses SHA-256 with optional salt for one-way hashing
 */

import crypto from 'crypto';
import { config } from '../config';

/**
 * Hash IP address using SHA-256
 * 
 * @param ipAddress - IP address to hash
 * @param salt - Optional salt (defaults to encryption key)
 * @returns Hex-encoded hash
 */
export function hashIpAddress(ipAddress: string, salt?: string): string {
  const hashSalt = salt || config.encryption.key;
  
  return crypto
    .createHash('sha256')
    .update(ipAddress + hashSalt)
    .digest('hex');
}

/**
 * Extract IP address from Express request
 * 
 * Handles X-Forwarded-For header for proxied requests
 * 
 * @param req - Express request object
 * @returns IP address string
 */
export function getClientIp(req: any): string {
  // Check X-Forwarded-For header (for proxied requests)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // Take the first IP if multiple are present
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }

  // Check X-Real-IP header
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fall back to socket address
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Get hashed IP address from Express request
 * 
 * @param req - Express request object
 * @param salt - Optional salt
 * @returns Hashed IP address
 */
export function getHashedClientIp(req: any, salt?: string): string {
  const ip = getClientIp(req);
  return hashIpAddress(ip, salt);
}
