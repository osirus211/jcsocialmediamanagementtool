/**
 * Two-Factor Authentication Service
 * 
 * Handles TOTP generation, verification, and backup code management
 * Uses otplib for RFC 6238 compliant TOTP implementation
 */

const { authenticator } = require('otplib');
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export interface TwoFactorSecret {
  secret: string;
  otpauthUrl: string;
}

export interface BackupCodeVerification {
  valid: boolean;
  index: number;
}

export class TwoFactorService {
  private static readonly APP_NAME = 'Social Media Manager';
  private static readonly BACKUP_CODE_LENGTH = 8;

  static {
    // Configure otplib for consistent TOTP generation
    authenticator.options = {
      step: 30,        // 30-second time step
      window: 1,       // Allow ±30 seconds clock drift
      digits: 6,       // 6-digit codes
      algorithm: 'sha1' // SHA-1 (TOTP standard)
    };
  }

  /**
   * Generate TOTP secret and otpauth URL for a user
   */
  static generateSecret(email: string): TwoFactorSecret {
    try {
      // Generate a random secret
      const secret = authenticator.generateSecret();
      
      // Create otpauth URL for authenticator apps
      const otpauthUrl = authenticator.keyuri(
        email,
        TwoFactorService.APP_NAME,
        secret
      );

      logger.info('Generated 2FA secret', { email });

      return {
        secret,
        otpauthUrl
      };
    } catch (error) {
      logger.error('Failed to generate 2FA secret', { email, error });
      throw new Error('Failed to generate 2FA secret');
    }
  }

  /**
   * Generate QR code as base64 data URL from otpauth URL
   */
  static async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      logger.info('Generated QR code for 2FA setup');
      return qrCodeDataUrl;
    } catch (error) {
      logger.error('Failed to generate QR code', { error });
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Verify TOTP token against secret
   */
  static verifyToken(token: string, secret: string): boolean {
    try {
      // Remove any spaces or formatting from token
      const cleanToken = token.replace(/\s/g, '');
      
      // Verify token is 6 digits
      if (!/^\d{6}$/.test(cleanToken)) {
        return false;
      }

      // Verify TOTP token
      const isValid = authenticator.verify({
        token: cleanToken,
        secret
      });

      logger.info('TOTP token verification', { 
        valid: isValid,
        tokenLength: cleanToken.length 
      });

      return isValid;
    } catch (error) {
      logger.error('Failed to verify TOTP token', { error });
      return false;
    }
  }

  /**
   * Generate backup codes for account recovery
   */
  static generateBackupCodes(count: number = 8): string[] {
    try {
      const codes: string[] = [];
      
      for (let i = 0; i < count; i++) {
        // Generate random hex string
        const code = crypto.randomBytes(TwoFactorService.BACKUP_CODE_LENGTH / 2)
          .toString('hex')
          .toUpperCase();
        codes.push(code);
      }

      logger.info('Generated backup codes', { count });
      return codes;
    } catch (error) {
      logger.error('Failed to generate backup codes', { error });
      throw new Error('Failed to generate backup codes');
    }
  }

  /**
   * Hash backup code for secure storage
   */
  static hashBackupCode(code: string): string {
    try {
      // Use SHA-256 for hashing backup codes
      return crypto.createHash('sha256')
        .update(code.toUpperCase())
        .digest('hex');
    } catch (error) {
      logger.error('Failed to hash backup code', { error });
      throw new Error('Failed to hash backup code');
    }
  }

  /**
   * Verify backup code against hashed codes array
   * Returns validation result and index of matched code
   */
  static verifyBackupCode(input: string, hashedCodes: string[]): BackupCodeVerification {
    try {
      // Clean and normalize input
      const cleanInput = input.replace(/\s/g, '').toUpperCase();
      
      // Verify input format (8 hex characters)
      if (!/^[0-9A-F]{8}$/.test(cleanInput)) {
        return { valid: false, index: -1 };
      }

      // Hash the input code
      const inputHash = TwoFactorService.hashBackupCode(cleanInput);
      
      // Find matching hash
      const index = hashedCodes.findIndex(hash => hash === inputHash);
      const valid = index !== -1;

      logger.info('Backup code verification', { 
        valid,
        index: valid ? index : -1,
        inputLength: cleanInput.length 
      });

      return { valid, index };
    } catch (error) {
      logger.error('Failed to verify backup code', { error });
      return { valid: false, index: -1 };
    }
  }
}