/**
 * Timeout Guard Utility
 * 
 * Wraps async operations with timeout protection
 */

import { logger } from './logger';

export class TimeoutError extends Error {
  constructor(operation: string, timeout: number) {
    super(`Operation '${operation}' timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Execute async operation with timeout
 * 
 * @param operation - Operation name (for logging)
 * @param fn - Async function to execute
 * @param timeout - Timeout in milliseconds
 * @returns Promise that resolves with function result or rejects with TimeoutError
 */
export async function withTimeout<T>(
  operation: string,
  fn: () => Promise<T>,
  timeout: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        logger.error('Operation timed out', {
          operation,
          timeout,
          alert: 'OPERATION_TIMEOUT',
        });
        reject(new TimeoutError(operation, timeout));
      }, timeout);
    }),
  ]);
}
