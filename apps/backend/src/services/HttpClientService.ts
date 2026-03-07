/**
 * HTTP Client Service for Platform API Calls
 * 
 * Provides a configured axios wrapper for making API requests to social platforms
 * Features:
 * - Timeout configuration
 * - Request/response logging with token sanitization
 * - Retry logic for network errors
 * - User-Agent header
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { logger } from '../utils/logger';

export interface HttpClientConfig {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  userAgent?: string;
}

export interface RequestMetrics {
  method: string;
  url: string;
  statusCode?: number;
  responseTime: number;
  success: boolean;
  error?: string;
}

export class HttpClientService {
  private client: AxiosInstance;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config: HttpClientConfig = {}) {
    const {
      timeout = 30000, // 30 seconds default
      maxRetries = 3,
      retryDelay = 1000,
      userAgent = 'SocialMediaScheduler/1.0'
    } = config;

    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;

    this.client = axios.create({
      timeout,
      headers: {
        'User-Agent': userAgent
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        const sanitizedConfig = this.sanitizeConfig(config);
        logger.debug('HTTP Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: sanitizedConfig.headers
        });
        return config;
      },
      (error) => {
        logger.error('HTTP Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('HTTP Response', {
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          statusCode: response.status,
          responseTime: this.getResponseTime(response)
        });
        return response;
      },
      (error) => {
        this.logError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Make a GET request with retry logic
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.requestWithRetry<T>(() => this.client.get<T>(url, config));
  }

  /**
   * Make a POST request with retry logic
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.requestWithRetry<T>(() => this.client.post<T>(url, data, config));
  }

  /**
   * Make a PUT request with retry logic
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.requestWithRetry<T>(() => this.client.put<T>(url, data, config));
  }

  /**
   * Make a DELETE request with retry logic
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.requestWithRetry<T>(() => this.client.delete<T>(url, config));
  }

  /**
   * Execute request with retry logic for network errors
   */
  private async requestWithRetry<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    attempt: number = 1
  ): Promise<AxiosResponse<T>> {
    const startTime = Date.now();

    try {
      const response = await requestFn();
      
      // Log successful request metrics
      this.logMetrics({
        method: response.config.method?.toUpperCase() || 'UNKNOWN',
        url: response.config.url || 'UNKNOWN',
        statusCode: response.status,
        responseTime: Date.now() - startTime,
        success: true
      });

      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (this.isRetryableError(error) && attempt < this.maxRetries) {
        logger.warn('Retrying HTTP request', {
          attempt,
          maxRetries: this.maxRetries,
          error: this.getErrorMessage(error),
          retryDelay: this.retryDelay
        });

        await this.sleep(this.retryDelay * attempt); // Exponential backoff
        return this.requestWithRetry(requestFn, attempt + 1);
      }

      // Log failed request metrics
      const axiosError = error as AxiosError;
      this.logMetrics({
        method: axiosError.config?.method?.toUpperCase() || 'UNKNOWN',
        url: axiosError.config?.url || 'UNKNOWN',
        statusCode: axiosError.response?.status,
        responseTime,
        success: false,
        error: this.getErrorMessage(error)
      });

      throw error;
    }
  }

  /**
   * Check if error is retryable (network errors, timeouts)
   */
  private isRetryableError(error: any): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }

    // Network errors (no response)
    if (!error.response) {
      return true;
    }

    // 5xx server errors
    if (error.response.status >= 500) {
      return true;
    }

    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }

  /**
   * Sanitize request config for logging (remove sensitive data)
   */
  private sanitizeConfig(config: AxiosRequestConfig): AxiosRequestConfig {
    const sanitized = { ...config };

    // Sanitize headers
    if (sanitized.headers) {
      const headers = { ...sanitized.headers };
      
      // Redact authorization headers
      if (headers.Authorization) {
        headers.Authorization = '[REDACTED]';
      }
      if (headers.authorization) {
        headers.authorization = '[REDACTED]';
      }

      sanitized.headers = headers;
    }

    // Sanitize query params with tokens
    if (sanitized.params) {
      const params = { ...sanitized.params };
      if (params.access_token) {
        params.access_token = '[REDACTED]';
      }
      if (params.refresh_token) {
        params.refresh_token = '[REDACTED]';
      }
      sanitized.params = params;
    }

    return sanitized;
  }

  /**
   * Log error with sanitized details
   */
  private logError(error: AxiosError): void {
    const sanitizedConfig = error.config ? this.sanitizeConfig(error.config) : undefined;

    logger.error('HTTP Request Failed', {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      statusCode: error.response?.status,
      error: error.message,
      responseData: error.response?.data,
      headers: sanitizedConfig?.headers
    });
  }

  /**
   * Log request metrics
   */
  private logMetrics(metrics: RequestMetrics): void {
    logger.info('HTTP Request Metrics', metrics);
  }

  /**
   * Get response time from response object
   */
  private getResponseTime(response: AxiosResponse): number {
    const requestStartTime = (response.config as any).requestStartTime;
    if (requestStartTime) {
      return Date.now() - requestStartTime;
    }
    return 0;
  }

  /**
   * Get error message from error object
   */
  private getErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the underlying axios instance (for advanced usage)
   */
  getClient(): AxiosInstance {
    return this.client;
  }
}

// Export singleton instance with default config
export const httpClient = new HttpClientService();
