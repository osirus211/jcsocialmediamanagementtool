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

  /**
   * Send data export ready notification
   */
  static async sendDataExportReady(data: {
    to: string;
    downloadUrl: string;
    expiresAt: Date;
    fileSize: number;
    format: string;
  }): Promise<SendEmailResult> {
    const service = new EmailService();
    
    const fileSizeMB = (data.fileSize / (1024 * 1024)).toFixed(2);
    const expiryDate = data.expiresAt.toLocaleDateString();
    
    const subject = 'Your Data Export is Ready';
    const body = `Your data export is ready for download.

Download Details:
- Format: ${data.format.toUpperCase()}
- File Size: ${fileSizeMB} MB
- Expires: ${expiryDate}

Download Link: ${data.downloadUrl}

This link will expire in 7 days for security reasons. Please download your data before then.

If you have any questions, please contact our support team.

Best regards,
The Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Your Data Export is Ready</h2>
        
        <p>Your data export has been successfully prepared and is ready for download.</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Download Details</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="margin: 8px 0;"><strong>Format:</strong> ${data.format.toUpperCase()}</li>
            <li style="margin: 8px 0;"><strong>File Size:</strong> ${fileSizeMB} MB</li>
            <li style="margin: 8px 0;"><strong>Expires:</strong> ${expiryDate}</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.downloadUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Download Your Data
          </a>
        </div>
        
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;">
            <strong>Important:</strong> This download link will expire in 7 days for security reasons. 
            Please download your data before then.
          </p>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          If you have any questions, please contact our support team.
        </p>
        
        <p style="color: #6b7280;">
          Best regards,<br>
          The Team
        </p>
      </div>
    `;

    return service.sendEmail({
      to: data.to,
      subject,
      body,
      html,
    });
  }

  /**
   * Send data export failed notification
   */
  static async sendDataExportFailed(data: {
    to: string;
    error: string;
  }): Promise<SendEmailResult> {
    const service = new EmailService();
    
    const subject = 'Data Export Failed';
    const body = `We encountered an issue while preparing your data export.

Error Details:
${data.error}

Please try requesting your data export again. If the problem persists, please contact our support team.

We apologize for the inconvenience.

Best regards,
The Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Data Export Failed</h2>
        
        <p>We encountered an issue while preparing your data export.</p>
        
        <div style="background-color: #fef2f2; border: 1px solid #fca5a5; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #dc2626;">Error Details</h3>
          <p style="margin: 0; color: #7f1d1d; font-family: monospace; font-size: 14px;">
            ${data.error}
          </p>
        </div>
        
        <p>Please try requesting your data export again. If the problem persists, please contact our support team.</p>
        
        <p>We apologize for the inconvenience.</p>
        
        <p style="color: #6b7280;">
          Best regards,<br>
          The Team
        </p>
      </div>
    `;

    return service.sendEmail({
      to: data.to,
      subject,
      body,
      html,
    });
  }

  /**
   * Send workspace invitation email
   */
  async sendInvitationEmail(data: {
    to: string;
    inviterName: string;
    workspaceName: string;
    role: string;
    inviteUrl: string;
    expiresAt: Date;
  }): Promise<SendEmailResult> {
    const expiryDate = data.expiresAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subject = `You're invited to join ${data.workspaceName}`;
    
    const body = `You're invited to join ${data.workspaceName}

${data.inviterName} has invited you to join ${data.workspaceName} as a ${data.role}.

Accept your invitation: ${data.inviteUrl}

What you'll get access to:
✓ Collaborative social media management
✓ Advanced scheduling and analytics
✓ Team collaboration tools

⏰ This invitation expires on ${expiryDate}

Questions? Contact ${data.inviterName} for more information.

---
If the link doesn't work, copy and paste: ${data.inviteUrl}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Workspace Invitation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <h1 style="color: #2563eb; margin: 0; font-size: 28px; font-weight: 600;">
            You're invited to join ${data.workspaceName}
          </h1>
        </div>
        
        <!-- Invitation Details -->
        <div style="background: white; padding: 25px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <div style="background: #f8fafc; padding: 25px; border-radius: 12px; margin-bottom: 30px; border-left: 4px solid #2563eb;">
            <p style="margin: 0 0 15px 0; font-size: 16px;">
              <strong>${data.inviterName}</strong> has invited you to join <strong>${data.workspaceName}</strong> as a <strong>${data.role}</strong>.
            </p>
          </div>
          
          <!-- Call to Action -->
          <div style="text-align: center; margin: 40px 0;">
            <a href="${data.inviteUrl}" 
               style="background: #2563eb; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">
              Accept Invitation
            </a>
          </div>
          
          <!-- Features Preview -->
          <div style="margin: 30px 0;">
            <h3 style="color: #374151; font-size: 18px; margin-bottom: 20px;">What you'll get access to:</h3>
            <div style="display: grid; gap: 15px;">
              <div style="display: flex; align-items: center; padding: 10px 0;">
                <span style="color: #10b981; font-size: 20px; margin-right: 12px;">✓</span>
                <span>Collaborative social media management</span>
              </div>
              <div style="display: flex; align-items: center; padding: 10px 0;">
                <span style="color: #10b981; font-size: 20px; margin-right: 12px;">✓</span>
                <span>Advanced scheduling and analytics</span>
              </div>
              <div style="display: flex; align-items: center; padding: 10px 0;">
                <span style="color: #10b981; font-size: 20px; margin-right: 12px;">✓</span>
                <span>Team collaboration tools</span>
              </div>
            </div>
          </div>
          
          <!-- Expiry Notice -->
          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 25px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>⏰ This invitation expires on ${expiryDate}</strong><br>
              Make sure to accept it before then to join the workspace.
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
            If you have any questions, contact <strong>${data.inviterName}</strong>
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            If the button doesn't work, copy and paste this link:<br>
            <span style="word-break: break-all;">${data.inviteUrl}</span>
          </p>
        </div>
        
      </body>
      </html>
    `;

    return this.sendEmail({
      to: data.to,
      subject,
      body,
      html,
    });
  }
}

export const emailService = new EmailService();
