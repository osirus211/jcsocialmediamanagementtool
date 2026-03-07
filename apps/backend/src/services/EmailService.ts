import { Resend } from 'resend';
import { config } from '../config';
import { logger } from '../utils/logger';
import { NotificationType, EmailJobData } from '../queue/EmailQueue';

/**
 * Email Service
 * 
 * Production email service using Resend
 * 
 * Features:
 * - Template-based emails
 * - HTML and plain text support
 * - Error handling with retryable classification
 * - Rate limiting awareness
 * - Structured logging
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  html?: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
}

export class EmailService {
  private resend: Resend | null = null;
  private fromEmail: string;
  private isConfigured: boolean = false;

  constructor() {
    this.fromEmail = config.email?.fromEmail || 'noreply@example.com';
    this.initialize();
  }

  /**
   * Initialize Resend client
   */
  private initialize(): void {
    const apiKey = config.email?.resendApiKey;

    if (!apiKey) {
      logger.warn('Resend API key not configured - email service disabled');
      this.isConfigured = false;
      return;
    }

    try {
      this.resend = new Resend(apiKey);
      this.isConfigured = true;
      logger.info('Email service initialized with Resend');
    } catch (error: any) {
      logger.error('Failed to initialize Resend client', { error: error.message });
      this.isConfigured = false;
    }
  }

  /**
   * Send email
   */
  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.isConfigured || !this.resend) {
      logger.warn('Email service not configured - skipping email', {
        to: input.to,
        subject: input.subject,
      });
      return {
        success: false,
        error: 'Email service not configured',
        errorCode: 'NOT_CONFIGURED',
        retryable: false,
      };
    }

    try {
      const startTime = Date.now();

      const result = await this.resend.emails.send({
        from: input.from || this.fromEmail,
        to: input.to,
        subject: input.subject,
        text: input.body,
        html: input.html || this.convertTextToHtml(input.body),
      });

      const duration = Date.now() - startTime;

      logger.info('Email sent successfully', {
        to: input.to,
        subject: input.subject,
        emailId: result.data?.id,
        duration_ms: duration,
      });

      return {
        success: true,
        emailId: result.data?.id,
      };
    } catch (error: any) {
      const errorInfo = this.classifyError(error);

      logger.error('Email send failed', {
        to: input.to,
        subject: input.subject,
        error: error.message,
        errorCode: errorInfo.errorCode,
        retryable: errorInfo.retryable,
      });

      return {
        success: false,
        error: error.message,
        errorCode: errorInfo.errorCode,
        retryable: errorInfo.retryable,
      };
    }
  }

  /**
   * Classify error for retry logic
   */
  private classifyError(error: any): { errorCode: string; retryable: boolean } {
    const errorMessage = error.message?.toLowerCase() || '';
    const statusCode = error.statusCode || error.status;

    // Network/timeout errors - retryable
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('etimedout')
    ) {
      return { errorCode: 'NETWORK_ERROR', retryable: true };
    }

    // Rate limiting - retryable
    if (statusCode === 429 || errorMessage.includes('rate limit')) {
      return { errorCode: 'RATE_LIMIT', retryable: true };
    }

    // Service unavailable - retryable
    if (statusCode === 503 || errorMessage.includes('service unavailable')) {
      return { errorCode: 'SERVICE_UNAVAILABLE', retryable: true };
    }

    // Internal server error - retryable
    if (statusCode === 500 || errorMessage.includes('internal server error')) {
      return { errorCode: 'INTERNAL_ERROR', retryable: true };
    }

    // Invalid email - not retryable
    if (
      statusCode === 400 ||
      errorMessage.includes('invalid email') ||
      errorMessage.includes('invalid recipient')
    ) {
      return { errorCode: 'INVALID_EMAIL', retryable: false };
    }

    // Authentication error - not retryable
    if (statusCode === 401 || errorMessage.includes('unauthorized')) {
      return { errorCode: 'UNAUTHORIZED', retryable: false };
    }

    // Default to retryable for unknown errors
    return { errorCode: 'UNKNOWN_ERROR', retryable: true };
  }

  /**
   * Convert plain text to basic HTML
   */
  private convertTextToHtml(text: string): string {
    return text
      .split('\n')
      .map(line => `<p>${this.escapeHtml(line)}</p>`)
      .join('');
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Check if service is configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }
}

export const emailService = new EmailService();
