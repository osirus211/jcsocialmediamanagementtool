/**
 * Transaction Manager
 * 
 * Provides atomic transaction support for multi-step MongoDB operations.
 * Ensures data consistency by wrapping related operations in a single transaction.
 * 
 * Features:
 * - MongoDB session-based transactions
 * - Automatic rollback on failure
 * - Retry logic with exponential backoff
 * - Timeout enforcement (30 seconds default)
 * - MongoDB version check (requires 4.0+)
 * - Metrics tracking for monitoring
 * 
 * Usage:
 * ```typescript
 * const transactionManager = TransactionManager.getInstance();
 * 
 * // Execute operations in transaction
 * const result = await transactionManager.withTransaction(async (session) => {
 *   const post = await Post.create([postData], { session });
 *   await Media.updateMany(
 *     { _id: { $in: mediaIds } },
 *     { postId: post[0]._id },
 *     { session }
 *   );
 *   return post[0];
 * });
 * ```
 */

import mongoose, { ClientSession } from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';
import { config } from '../config';
import {
import { config } from '../config';
  updateTransactionMetrics,
  recordTransactionError,
} from '../config/metrics';

export interface TransactionOptions {
  timeout?: number;      // Transaction timeout in milliseconds (default: 30000)
  retryCount?: number;   // Retry attempts on transient failures (default: 3)
  retryDelay?: number;   // Initial retry delay in milliseconds (default: 1000, exponential backoff)
}

export interface TransactionMetrics {
  total: number;
  success: number;
  rollback: number;
  error: number;
  retries: number;
  timing: {
    durationMs: number[];
  };
  rollbackReasons: Record<string, number>;
}

export class TransactionNotSupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionNotSupportedError';
  }
}

export class TransactionTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Transaction exceeded timeout of ${timeout}ms`);
    this.name = 'TransactionTimeoutError';
  }
}

export class TransactionManager {
  private static instance: TransactionManager | null = null;
  
  private readonly DEFAULT_TIMEOUT = 30000;      // 30 seconds
  private readonly DEFAULT_RETRY_COUNT = 3;
  private readonly DEFAULT_RETRY_DELAY = 1000;  // 1 second
  
  private metrics: TransactionMetrics = {
    total: 0,
    success: 0,
    rollback: 0,
    error: 0,
    retries: 0,
    timing: {
      durationMs: [],
    },
    rollbackReasons: {},
  };
  
  private transactionSupportChecked: boolean = false;
  private transactionSupported: boolean = false;
  
  private constructor() {
    logger.info('TransactionManager initialized');
  }
  
  static getInstance(): TransactionManager {
    if (!TransactionManager.instance) {
      TransactionManager.instance = new TransactionManager();
    }
    return TransactionManager.instance;
  }

  /**
   * Check if MongoDB supports transactions (requires version 4.0+)
   * 
   * @returns true if transactions are supported
   * @throws TransactionNotSupportedError if MongoDB version < 4.0
   */
  async checkTransactionSupport(): Promise<boolean> {
    if (this.transactionSupportChecked) {
      return this.transactionSupported;
    }
    
    try {
      // Check if connected
      if (mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB not connected');
      }
      
      // Get MongoDB version
      const adminDb = mongoose.connection.db.admin();
      const serverInfo = await adminDb.serverInfo();
      const version = serverInfo.version;
      
      logger.info('MongoDB version detected', { version });
      
      // Parse version (e.g., "4.4.6" -> [4, 4, 6])
      const versionParts = version.split('.').map(Number);
      const majorVersion = versionParts[0];
      
      // Transactions require MongoDB 4.0+
      this.transactionSupported = majorVersion >= 4;
      this.transactionSupportChecked = true;
      
      if (!this.transactionSupported) {
        const error = new TransactionNotSupportedError(
          `MongoDB version ${version} does not support transactions (requires 4.0+)`
        );
        logger.error('Transaction support check failed', {
          version,
          majorVersion,
          required: '4.0+',
        });
        throw error;
      }
      
      logger.info('Transaction support confirmed', { version });
      return true;
      
    } catch (error: any) {
      this.transactionSupportChecked = true;
      this.transactionSupported = false;
      
      if (error instanceof TransactionNotSupportedError) {
        throw error;
      }
      
      logger.error('Failed to check transaction support', {
        error: error.message,
      });
      throw new TransactionNotSupportedError(
        `Failed to check MongoDB version: ${error.message}`
      );
    }
  }

  /**
   * Execute function within a MongoDB transaction
   * 
   * @param fn - Function to execute with session parameter
   * @param options - Transaction options (timeout, retryCount, retryDelay)
   * @returns Result of function execution
   * @throws TransactionTimeoutError if transaction exceeds timeout
   * @throws TransactionNotSupportedError if MongoDB version < 4.0
   */
  async withTransaction<T>(
    fn: (session: ClientSession) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    // Check if feature is enabled
    const enabled = process.env.TRANSACTION_ENABLED !== 'false';
    if (!enabled) {
      logger.warn('Transactions disabled, executing without transaction');
      // Execute without session (no transaction)
      return await fn(null as any);
    }
    
    // Check transaction support
    await this.checkTransactionSupport();
    
    const timeout = options?.timeout ?? this.DEFAULT_TIMEOUT;
    const retryCount = options?.retryCount ?? this.DEFAULT_RETRY_COUNT;
    const retryDelay = options?.retryDelay ?? this.DEFAULT_RETRY_DELAY;
    
    const startTime = Date.now();
    this.metrics.total++;
    
    // Retry loop for transient failures
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      let session: ClientSession | null = null;
      
      try {
        // Start session
        session = await mongoose.startSession();
        
        logger.debug('Transaction started', {
          attempt: attempt + 1,
          maxAttempts: retryCount + 1,
          timeout,
        });
        
        // Start transaction
        session.startTransaction({
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          maxCommitTimeMS: timeout,
        });
        
        // Execute function with timeout
        const result = await this.executeWithTimeout(
          fn(session),
          timeout,
          session
        );
        
        // Commit transaction
        await session.commitTransaction();
        
        const duration = Date.now() - startTime;
        this.metrics.success++;
        this.metrics.timing.durationMs.push(duration);
        
        // Update Prometheus metrics
        updateTransactionMetrics('success', duration);
        
        logger.info('Transaction committed successfully', {
          attempt: attempt + 1,
          durationMs: duration,
        });
        
        return result;
        
      } catch (error: any) {
        // Abort transaction on error
        if (session && session.inTransaction()) {
          try {
            await session.abortTransaction();
            this.metrics.rollback++;
            
            // Track rollback reason
            const reason = this.classifyError(error);
            this.metrics.rollbackReasons[reason] = 
              (this.metrics.rollbackReasons[reason] || 0) + 1;
            
            // Update Prometheus metrics
            updateTransactionMetrics('rollback', Date.now() - startTime);
            
            logger.warn('Transaction rolled back', {
              attempt: attempt + 1,
              reason,
              error: error.message,
            });
          } catch (abortError: any) {
            logger.error('Failed to abort transaction', {
              error: abortError.message,
            });
          }
        }
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);
        const isLastAttempt = attempt === retryCount;
        
        if (isRetryable && !isLastAttempt) {
          // Retry with exponential backoff
          const delay = retryDelay * Math.pow(2, attempt);
          this.metrics.retries++;
          
          logger.info('Retrying transaction after transient failure', {
            attempt: attempt + 1,
            maxAttempts: retryCount + 1,
            delayMs: delay,
            error: error.message,
          });
          
          await this.sleep(delay);
          continue;
        }
        
        // Final failure - no more retries
        this.metrics.error++;
        const duration = Date.now() - startTime;
        
        // Update Prometheus metrics
        updateTransactionMetrics('error', duration);
        recordTransactionError(this.classifyError(error));
        
        logger.error('Transaction failed after all retries', {
          attemptsMade: attempt + 1,
          maxAttempts: retryCount + 1,
          durationMs: duration,
          error: error.message,
          stack: error.stack,
        });
        
        throw error;
        
      } finally {
        // Always end session
        if (session) {
          await session.endSession();
        }
      }
    }
    
    // Should never reach here
    throw new Error('Transaction retry loop exited unexpectedly');
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number,
    session: ClientSession
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new TransactionTimeoutError(timeout));
        }, timeout);
      }),
    ]);
  }

  /**
   * Check if error is retryable (transient failure)
   */
  private isRetryableError(error: any): boolean {
    // MongoDB transient transaction errors
    if (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')) {
      return true;
    }
    
    // Network errors
    const errorMessage = error.message?.toLowerCase() || '';
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('etimedout')
    ) {
      return true;
    }
    
    // Write conflict errors
    if (
      error.code === 112 || // WriteConflict
      error.code === 251    // NoSuchTransaction
    ) {
      return true;
    }
    
    // Default to non-retryable
    return false;
  }

  /**
   * Classify error for metrics
   */
  private classifyError(error: any): string {
    if (error instanceof TransactionTimeoutError) {
      return 'timeout';
    }
    
    if (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')) {
      return 'transient';
    }
    
    if (error.code === 112) {
      return 'write_conflict';
    }
    
    if (error.code === 251) {
      return 'no_such_transaction';
    }
    
    const errorMessage = error.message?.toLowerCase() || '';
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return 'network';
    }
    
    if (errorMessage.includes('duplicate key')) {
      return 'duplicate_key';
    }
    
    if (errorMessage.includes('validation')) {
      return 'validation';
    }
    
    return 'unknown';
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get transaction metrics
   */
  getMetrics(): TransactionMetrics {
    return {
      total: this.metrics.total,
      success: this.metrics.success,
      rollback: this.metrics.rollback,
      error: this.metrics.error,
      retries: this.metrics.retries,
      timing: {
        durationMs: [...this.metrics.timing.durationMs],
      },
      rollbackReasons: { ...this.metrics.rollbackReasons },
    };
  }

  /**
   * Get transaction success rate
   */
  getSuccessRate(): number {
    if (this.metrics.total === 0) return 0;
    return this.metrics.success / this.metrics.total;
  }

  /**
   * Get transaction rollback rate
   */
  getRollbackRate(): number {
    if (this.metrics.total === 0) return 0;
    return this.metrics.rollback / this.metrics.total;
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      total: 0,
      success: 0,
      rollback: 0,
      error: 0,
      retries: 0,
      timing: {
        durationMs: [],
      },
      rollbackReasons: {},
    };
  }

  /**
   * Reset transaction support check (for testing)
   */
  resetTransactionSupportCheck(): void {
    this.transactionSupportChecked = false;
    this.transactionSupported = false;
  }
}

// Export singleton instance
export const transactionManager = TransactionManager.getInstance();

