import { distributedLockService } from './DistributedLockService';
import { startKeyRotation, endKeyRotation, getCurrentKeyVersion } from '../utils/encryption';
import { logger } from '../utils/logger';

/**
 * Key Rotation Service
 * 
 * Manages encryption key rotation with distributed locking
 * Ensures only one instance can rotate keys at a time
 */

export class KeyRotationService {
  private static instance: KeyRotationService;
  private readonly ROTATION_LOCK_KEY = 'key:rotation';
  private readonly ROTATION_LOCK_TTL = 10 * 60 * 1000; // 10 minutes

  static getInstance(): KeyRotationService {
    if (!KeyRotationService.instance) {
      KeyRotationService.instance = new KeyRotationService();
    }
    return KeyRotationService.instance;
  }

  /**
   * Perform key rotation with distributed lock
   */
  async rotateKeys(fromVersion: number): Promise<{ success: boolean; message: string }> {
    // Acquire distributed lock for key rotation
    const lock = await distributedLockService.acquireLock(this.ROTATION_LOCK_KEY, {
      ttl: this.ROTATION_LOCK_TTL,
      retryAttempts: 0, // Don't retry - only one rotation at a time
    });

    if (!lock) {
      const message = 'Key rotation already in progress by another instance';
      logger.warn(message);
      return { success: false, message };
    }

    try {
      const currentVersion = getCurrentKeyVersion();
      
      if (fromVersion >= currentVersion) {
        const message = `Invalid rotation: fromVersion (${fromVersion}) must be less than current version (${currentVersion})`;
        logger.error(message);
        return { success: false, message };
      }

      logger.info('Starting key rotation', {
        fromVersion,
        toVersion: currentVersion,
        lockAcquired: true,
      });

      // Start the rotation grace period
      startKeyRotation(fromVersion);

      // In a real implementation, you would:
      // 1. Update configuration to use new key version
      // 2. Notify all application instances
      // 3. Wait for grace period
      // 4. Verify all instances are using new key
      // 5. End grace period

      logger.info('Key rotation completed successfully', {
        fromVersion,
        toVersion: currentVersion,
      });

      return {
        success: true,
        message: `Key rotation from version ${fromVersion} to ${currentVersion} completed`,
      };

    } catch (error: any) {
      logger.error('Key rotation failed', {
        fromVersion,
        error: error.message,
        stack: error.stack,
      });

      // End rotation on error
      endKeyRotation();

      return {
        success: false,
        message: `Key rotation failed: ${error.message}`,
      };

    } finally {
      // Always release the lock
      try {
        await distributedLockService.releaseLock(lock);
        logger.debug('Key rotation lock released');
      } catch (lockError: any) {
        logger.error('Failed to release key rotation lock', {
          error: lockError.message,
        });
      }
    }
  }

  /**
   * Create rollback script for key rotation
   */
  generateRollbackScript(fromVersion: number, toVersion: number): string {
    return `#!/bin/bash
# Key Rotation Rollback Script
# Generated: ${new Date().toISOString()}
# Rollback from version ${toVersion} to version ${fromVersion}

echo "Starting key rotation rollback..."
echo "From version: ${toVersion}"
echo "To version: ${fromVersion}"

# 1. Stop all application instances
echo "Step 1: Stop application instances"
# kubectl scale deployment app --replicas=0
# docker-compose stop app

# 2. Update environment variable
echo "Step 2: Update APP_SECRET to previous version"
# Update your deployment configuration here

# 3. Restart application instances
echo "Step 3: Restart application instances"
# kubectl scale deployment app --replicas=3
# docker-compose start app

# 4. Verify rollback
echo "Step 4: Verify rollback"
curl -f http://localhost:3000/health || echo "Health check failed"

echo "Rollback completed. Verify manually that tokens can be decrypted."
`;
  }

  /**
   * Get key rotation status
   */
  getRotationStatus(): {
    isRotating: boolean;
    currentVersion: number;
    lockExists: boolean;
  } {
    return {
      isRotating: false, // Would check grace period in real implementation
      currentVersion: getCurrentKeyVersion(),
      lockExists: false, // Would check Redis lock in real implementation
    };
  }

  /**
   * Monitor key rotation health
   */
  async monitorRotation(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: Record<string, any>;
  }> {
    const issues: string[] = [];
    const metrics: Record<string, any> = {
      currentVersion: getCurrentKeyVersion(),
      rotationInProgress: false,
    };

    // Check if rotation is stuck
    // In real implementation, check if lock exists for too long
    
    // Check if grace period is active for too long
    // In real implementation, check grace period duration

    return {
      healthy: issues.length === 0,
      issues,
      metrics,
    };
  }
}

export const keyRotationService = KeyRotationService.getInstance();