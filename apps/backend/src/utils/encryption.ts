import crypto from 'crypto';
import { config } from '../config';
import { logger } from './logger';

/**
 * Encryption Utilities
 * 
 * Provides secure AES-256-GCM encryption/decryption for sensitive data
 * Uses APP_SECRET as the encryption key with versioning support
 * 
 * Features:
 * - Key versioning for safe rotation
 * - Dual-key support during rotation
 * - Backward compatibility
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is always 16
const TAG_LENGTH = 16; // Authentication tag length
const SALT_LENGTH = 32; // Salt for key derivation
const CURRENT_KEY_VERSION = 1; // Increment when rotating keys

// Key rotation configuration
const KEY_ROTATION_GRACE_PERIOD = 5 * 60 * 1000; // 5 minutes
let keyRotationStartTime: Date | null = null;
let previousKeyVersion: number | null = null;

/**
 * Get encryption key for a specific version
 */
function getEncryptionKey(version: number = CURRENT_KEY_VERSION): string {
  const baseKey = config.encryption.key;
  if (!baseKey || baseKey.length < 32) {
    throw new Error('APP_SECRET must be at least 32 characters long');
  }

  // For version 1, use the base key
  if (version === 1) {
    return baseKey;
  }

  // For future versions, derive from base key + version
  // This allows for key rotation without changing APP_SECRET
  const versionSalt = `v${version}`;
  return crypto.pbkdf2Sync(baseKey, versionSalt, 10000, 32, 'sha256').toString('hex');
}

/**
 * Derive encryption key from versioned key using PBKDF2
 */
function deriveKey(salt: Buffer, version: number = CURRENT_KEY_VERSION): Buffer {
  const versionedKey = getEncryptionKey(version);
  return crypto.pbkdf2Sync(versionedKey, salt, 100000, 32, 'sha256');
}

/**
 * Check if we're in key rotation grace period
 */
function isInGracePeriod(): boolean {
  if (!keyRotationStartTime) {
    return false;
  }
  return Date.now() - keyRotationStartTime.getTime() < KEY_ROTATION_GRACE_PERIOD;
}

/**
 * Start key rotation (sets grace period)
 */
export function startKeyRotation(fromVersion: number): void {
  keyRotationStartTime = new Date();
  previousKeyVersion = fromVersion;
  
  logger.info('Key rotation started', {
    fromVersion,
    toVersion: CURRENT_KEY_VERSION,
    gracePeriodMs: KEY_ROTATION_GRACE_PERIOD,
  });

  // Auto-end grace period after timeout
  setTimeout(() => {
    endKeyRotation();
  }, KEY_ROTATION_GRACE_PERIOD);
}

/**
 * End key rotation (clears grace period)
 */
export function endKeyRotation(): void {
  if (keyRotationStartTime) {
    logger.info('Key rotation ended', {
      previousVersion: previousKeyVersion,
      currentVersion: CURRENT_KEY_VERSION,
      gracePeriodEnded: true,
    });
  }
  
  keyRotationStartTime = null;
  previousKeyVersion = null;
}

/**
 * Get current key version
 */
export function getCurrentKeyVersion(): number {
  return CURRENT_KEY_VERSION;
}

/**
 * Encrypt a string using AES-256-GCM with key versioning
 * Format: version:salt:iv:authTag:encrypted
 */
export function encrypt(text: string, keyVersion: number = CURRENT_KEY_VERSION): string {
  if (!text) {
    throw new Error('Text to encrypt cannot be empty');
  }

  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive key from versioned key + salt
    const key = deriveKey(salt, keyVersion);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Format: version:salt:iv:authTag:encrypted
    return [
      keyVersion.toString(),
      salt.toString('hex'),
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted
    ].join(':');
    
  } catch (error: any) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt a string using AES-256-GCM with key version support
 * Supports both old format (salt:iv:authTag:encrypted) and new format (version:salt:iv:authTag:encrypted)
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    throw new Error('Encrypted data cannot be empty');
  }

  try {
    // Parse the encrypted data
    const parts = encryptedData.split(':');
    
    let version: number;
    let saltHex: string;
    let ivHex: string;
    let authTagHex: string;
    let encrypted: string;

    if (parts.length === 4) {
      // Old format: salt:iv:authTag:encrypted (assume version 1)
      version = 1;
      [saltHex, ivHex, authTagHex, encrypted] = parts;
    } else if (parts.length === 5) {
      // New format: version:salt:iv:authTag:encrypted
      [version, saltHex, ivHex, authTagHex, encrypted] = parts.map((part, index) => 
        index === 0 ? parseInt(part, 10) : part
      ) as [number, string, string, string, string];
    } else {
      throw new Error('Invalid encrypted data format');
    }

    // Key version validation with grace period support
    if (version !== CURRENT_KEY_VERSION) {
      if (isInGracePeriod() && version === previousKeyVersion) {
        logger.debug('Using previous key version during grace period', {
          version,
          currentVersion: CURRENT_KEY_VERSION,
        });
      } else {
        logger.warn('Decrypting with non-current key version', {
          version,
          currentVersion: CURRENT_KEY_VERSION,
          gracePeriod: isInGracePeriod(),
        });
      }
    }
    
    // Convert from hex
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Derive key using the version from the encrypted data
    const key = deriveKey(salt, version);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
    
  } catch (error: any) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Check if a string appears to be encrypted (has the expected format)
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false;
  
  const parts = data.split(':');
  // Support both old format (4 parts) and new format (5 parts)
  return (parts.length === 4 || parts.length === 5) && 
         parts.every(part => /^[0-9a-f]+$/i.test(part));
}

/**
 * Get key version from encrypted data
 */
export function getKeyVersion(encryptedData: string): number {
  if (!encryptedData) return 1;
  
  const parts = encryptedData.split(':');
  if (parts.length === 5) {
    // New format: version:salt:iv:authTag:encrypted
    return parseInt(parts[0], 10);
  } else if (parts.length === 4) {
    // Old format: salt:iv:authTag:encrypted (assume version 1)
    return 1;
  }
  
  return 1; // Default to version 1
}

/**
 * Safely encrypt if not already encrypted
 */
export function safeEncrypt(text: string): string {
  if (isEncrypted(text)) {
    return text; // Already encrypted
  }
  return encrypt(text);
}

/**
 * Safely decrypt if encrypted, otherwise return as-is
 */
export function safeDecrypt(data: string): string {
  if (!isEncrypted(data)) {
    return data; // Not encrypted
  }
  return decrypt(data);
}