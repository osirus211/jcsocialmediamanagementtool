/**
 * Token Encryption Service
 * 
 * Provides secure encryption/decryption for OAuth tokens
 * Uses existing AES-256-GCM encryption utilities with key rotation support
 */

import { encrypt, decrypt, isEncrypted, getCurrentKeyVersion } from '../utils/encryption';
import { logger } from '../utils/logger';

export class TokenEncryptionService {
  /**
   * Encrypt a token string
   * @param token - Plain text token to encrypt
   * @returns Encrypted token string
   */
  encryptToken(token: string): string {
    if (!token || token.trim().length === 0) {
      throw new Error('Token cannot be empty');
    }

    try {
      // Check if already encrypted
      if (isEncrypted(token)) {
        logger.warn('Attempted to encrypt already encrypted token');
        return token;
      }

      const encrypted = encrypt(token);
      
      logger.debug('Token encrypted successfully', {
        keyVersion: getCurrentKeyVersion(),
        tokenLength: token.length
      });

      return encrypted;
    } catch (error: any) {
      logger.error('Token encryption failed', {
        error: error.message
      });
      throw new Error(`Failed to encrypt token: ${error.message}`);
    }
  }

  /**
   * Decrypt a token string
   * @param encryptedToken - Encrypted token string
   * @returns Decrypted plain text token
   */
  decryptToken(encryptedToken: string): string {
    if (!encryptedToken || encryptedToken.trim().length === 0) {
      throw new Error('Encrypted token cannot be empty');
    }

    try {
      // Check if actually encrypted
      if (!isEncrypted(encryptedToken)) {
        logger.warn('Attempted to decrypt non-encrypted token');
        return encryptedToken;
      }

      const decrypted = decrypt(encryptedToken);
      
      logger.debug('Token decrypted successfully');

      return decrypted;
    } catch (error: any) {
      logger.error('Token decryption failed', {
        error: error.message
      });
      throw new Error(`Failed to decrypt token: ${error.message}`);
    }
  }

  /**
   * Encrypt multiple tokens in a batch
   * @param tokens - Array of plain text tokens
   * @returns Array of encrypted tokens
   */
  encryptTokens(tokens: string[]): string[] {
    return tokens.map(token => this.encryptToken(token));
  }

  /**
   * Decrypt multiple tokens in a batch
   * @param encryptedTokens - Array of encrypted tokens
   * @returns Array of decrypted tokens
   */
  decryptTokens(encryptedTokens: string[]): string[] {
    return encryptedTokens.map(token => this.decryptToken(token));
  }

  /**
   * Check if a token is encrypted
   * @param token - Token string to check
   * @returns True if token is encrypted
   */
  isTokenEncrypted(token: string): boolean {
    return isEncrypted(token);
  }

  /**
   * Safely encrypt token (no-op if already encrypted)
   * @param token - Token string
   * @returns Encrypted token
   */
  safeEncrypt(token: string): string {
    if (isEncrypted(token)) {
      return token;
    }
    return this.encryptToken(token);
  }

  /**
   * Safely decrypt token (no-op if not encrypted)
   * @param token - Token string
   * @returns Decrypted token
   */
  safeDecrypt(token: string): string {
    if (!isEncrypted(token)) {
      return token;
    }
    return this.decryptToken(token);
  }

  /**
   * Re-encrypt token with current key version (for key rotation)
   * @param encryptedToken - Token encrypted with old key
   * @returns Token encrypted with current key
   */
  reEncryptToken(encryptedToken: string): string {
    try {
      // Decrypt with old key
      const plainToken = this.decryptToken(encryptedToken);
      
      // Encrypt with current key
      const reEncrypted = this.encryptToken(plainToken);
      
      logger.debug('Token re-encrypted successfully', {
        keyVersion: getCurrentKeyVersion()
      });

      return reEncrypted;
    } catch (error: any) {
      logger.error('Token re-encryption failed', {
        error: error.message
      });
      throw new Error(`Failed to re-encrypt token: ${error.message}`);
    }
  }

  /**
   * Validate that a token can be decrypted
   * @param encryptedToken - Encrypted token to validate
   * @returns True if token can be decrypted
   */
  validateEncryptedToken(encryptedToken: string): boolean {
    try {
      this.decryptToken(encryptedToken);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const tokenEncryptionService = new TokenEncryptionService();
