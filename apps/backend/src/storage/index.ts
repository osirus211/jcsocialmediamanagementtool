/**
 * Storage Module
 * 
 * Exports storage providers and factory functions
 */

export { StorageProvider, UploadOptions, UploadResult } from './StorageProvider';
export { LocalStorageProvider, createLocalStorageFromEnv } from './LocalStorageProvider';

// S3 exports - only available if @aws-sdk/client-s3 is installed
export type { S3StorageConfig } from './S3StorageProvider';

/**
 * Storage provider type
 */
export type StorageType = 'local' | 's3';

/**
 * Create storage provider based on environment configuration
 * 
 * Uses STORAGE_TYPE environment variable to determine provider:
 * - 'local': LocalStorageProvider (default)
 * - 's3': S3StorageProvider (requires @aws-sdk/client-s3)
 */
export async function createStorageProvider() {
  const storageType = (process.env.STORAGE_TYPE || 'local') as StorageType;

  switch (storageType) {
    case 's3': {
      // Dynamic import to avoid requiring AWS SDK if not used
      const { createS3StorageFromEnv } = await import('./S3StorageProvider');
      return createS3StorageFromEnv();
    }
    case 'local':
    default: {
      const { createLocalStorageFromEnv } = await import('./LocalStorageProvider');
      return createLocalStorageFromEnv();
    }
  }
}
