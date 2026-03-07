/**
 * Storage Provider Interface
 * 
 * Abstraction layer for file storage operations
 * Supports multiple backends (S3, R2, local, etc.)
 */

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

export interface StorageProvider {
  /**
   * Upload a file to storage
   * 
   * @param buffer - File buffer to upload
   * @param key - Storage key (path) for the file
   * @param options - Upload options (content type, metadata)
   * @returns Upload result with key and public URL
   */
  upload(buffer: Buffer, key: string, options?: UploadOptions): Promise<UploadResult>;

  /**
   * Delete a file from storage
   * 
   * @param key - Storage key (path) of the file to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Get public URL for a file
   * 
   * @param key - Storage key (path) of the file
   * @returns Public URL to access the file
   */
  getPublicUrl(key: string): string;
}
