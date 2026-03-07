/**
 * Local Storage Provider
 * 
 * Implements StorageProvider interface using local filesystem
 * For development and testing purposes
 * 
 * NOTE: Not recommended for production use
 */

import { StorageProvider, UploadOptions, UploadResult } from './StorageProvider';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

export interface LocalStorageConfig {
  basePath: string; // Base directory for file storage
  baseUrl: string; // Base URL for public access
}

export class LocalStorageProvider implements StorageProvider {
  private config: LocalStorageConfig;

  constructor(config: LocalStorageConfig) {
    this.config = config;

    logger.info('LocalStorageProvider initialized', {
      basePath: config.basePath,
      baseUrl: config.baseUrl,
    });
  }

  /**
   * Upload a file to local filesystem
   */
  async upload(
    buffer: Buffer,
    key: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    try {
      const filePath = path.join(this.config.basePath, key);
      const directory = path.dirname(filePath);

      // Ensure directory exists
      await fs.mkdir(directory, { recursive: true });

      // Write file
      await fs.writeFile(filePath, buffer);

      const url = this.getPublicUrl(key);

      logger.info('File uploaded to local storage', {
        key,
        size: buffer.length,
        path: filePath,
      });

      return {
        key,
        url,
        size: buffer.length,
      };
    } catch (error: any) {
      logger.error('Local storage upload error', {
        error: error.message,
        key,
      });
      throw new Error(`Failed to upload file to local storage: ${error.message}`);
    }
  }

  /**
   * Delete a file from local filesystem
   */
  async delete(key: string): Promise<void> {
    try {
      const filePath = path.join(this.config.basePath, key);
      await fs.unlink(filePath);

      logger.info('File deleted from local storage', {
        key,
        path: filePath,
      });
    } catch (error: any) {
      // Ignore if file doesn't exist
      if (error.code === 'ENOENT') {
        logger.warn('File not found for deletion', { key });
        return;
      }

      logger.error('Local storage delete error', {
        error: error.message,
        key,
      });
      throw new Error(`Failed to delete file from local storage: ${error.message}`);
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(key: string): string {
    return `${this.config.baseUrl}/${key}`;
  }
}

/**
 * Create local storage provider from environment variables
 */
export function createLocalStorageFromEnv(): LocalStorageProvider {
  const config: LocalStorageConfig = {
    basePath: process.env.LOCAL_STORAGE_PATH || './uploads',
    baseUrl: process.env.LOCAL_STORAGE_URL || 'http://localhost:3000/uploads',
  };

  return new LocalStorageProvider(config);
}
