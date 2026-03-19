/**
 * Email Notification Service
 * 
 * Sends email notifications for critical events
 */

import mongoose from 'mongoose';
import { SystemEvent } from './EventService';
import { EmailTemplateService } from './EmailTemplateService';
import { logger } from '../utils/logger';
import { config } from '../config';
import nodemailer from 'nodemailer';

// Email service interface (can be implemented with SendGrid, AWS SES, etc.)
interface EmailProvider {
  sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void>;
}

// SMTP email provider using Nodemailer
class SMTPEmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Important for shared hosting SMTP compatibility
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Verify SMTP connection on startup
    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('✅ SMTP connection verified — email is ready', {
        host: process.env.SMTP_HOST,
        user: process.env.SMTP_USER,
        port: process.env.SMTP_PORT,
      });
    } catch (error: any) {
      logger.error('❌ SMTP connection failed:', {
        error: error.message,
        host: process.env.SMTP_HOST,
        user: process.env.SMTP_USER,
      });
    }
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
  }
}

// Mock email provider for development
class MockEmailProvider implements EmailProvider {
  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    logger.info('📧 Mock email sent:', {
      to: params.to,
      subject: params.subject,
      preview: params.text.substring(0, 100) + '...',
    });
  }
}

export class EmailNotificationService {
  private emailProvider: EmailProvider;

  constructor() {
    const provider = process.env.EMAIL_PROVIDER;
    const isTest = process.env.NODE_ENV === 'test';
    const hasCredentials = 
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_USER !== 'your-email@gmail.com' &&
      process.env.SMTP_PASS !== 'your-app-password';

    if (!isTest && provider === 'smtp' && hasCredentials) {
      this.emailProvider = new SMTPEmailProvider();
      logger.info('Email service initialized with SMTP provider', {
        host: process.env.SMTP_HOST,
        user: process.env.SMTP_USER,
      });
    } else {
      this.emailProvider = new MockEmailProvider();
      if (!isTest) {
        logger.warn('⚠️  No valid SMTP credentials — using MockEmailProvider', {
          provider,
          hasCredentials,
          smtpHost: process.env.SMTP_HOST,
          smtpUser: process.env.SMTP_USER,
        });
      } else {
        logger.info('Email service initialized with Mock provider (test environment)');
      }
    }
  }

  /**
   * Send email notification
   */
  async sendNotification(params: {
    eventType: SystemEvent;
    workspaceId: string;
    userId?: string;
    payload: Record<string, any>;
  }): Promise<void> {
    const { eventType, workspaceId, userId, payload } = params;

    try {
      // Get email details
      const emailDetails = this.getEmailDetails(eventType, payload);
      if (!emailDetails) {
        logger.debug(`No email template for event: ${eventType}`);
        return;
      }

      // Get recipient email
      const recipientEmail = await this.getRecipientEmail(workspaceId, userId);
      if (!recipientEmail) {
        logger.warn('No recipient email found');
        return;
      }

      // Send email
      await this.emailProvider.sendEmail({
        to: recipientEmail,
        subject: emailDetails.subject,
        html: emailDetails.html,
        text: emailDetails.text,
      });

      logger.info(`Email sent for event: ${eventType}`, {
        to: recipientEmail,
        subject: emailDetails.subject,
      });
    } catch (error: any) {
      logger.error('Failed to send email notification:', error);
      throw error;
    }
  }

  /**
   * Get email details based on event type
   */
  private getEmailDetails(
    eventType: SystemEvent,
    payload: Record<string, any>
  ): {
    subject: string;
    html: string;
    text: string;
  } | null {
    const templates: Partial<Record<SystemEvent, any>> = {
      [SystemEvent.POST_FAILED]: {
        subject: `Post Failed: ${payload.platform}`,
        html: this.getPostFailedHtml(payload),
        text: `Your post failed to publish to ${payload.platform}. Error: ${payload.error}. Please check your connection and try again.`,
      },
      [SystemEvent.APPROVAL_REQUIRED]: {
        subject: 'Post Approval Required',
        html: this.getApprovalRequiredHtml(payload),
        text: `A new post is waiting for your approval. Content: ${payload.content}`,
      },
      [SystemEvent.CONNECTION_EXPIRED]: {
        subject: `${payload.platform} Connection Expired`,
        html: this.getConnectionExpiredHtml(payload),
        text: `Your ${payload.platform} connection has expired. Please reconnect your account to continue publishing.`,
      },
      [SystemEvent.SUBSCRIPTION_FAILED]: {
        subject: 'Subscription Payment Failed',
        html: this.getSubscriptionFailedHtml(payload),
        text: `Your subscription payment failed: ${payload.reason}. Please update your payment method to avoid service interruption.`,
      },
      [SystemEvent.PAYMENT_FAILED]: {
        subject: 'Payment Failed',
        html: this.getPaymentFailedHtml(payload),
        text: `Payment of $${(payload.amount / 100).toFixed(2)} failed: ${payload.reason}. Please update your payment method.`,
      },
      [SystemEvent.TRIAL_ENDING]: {
        subject: `Trial Ending in ${payload.daysRemaining} Days`,
        html: this.getTrialEndingHtml(payload),
        text: `Your trial ends in ${payload.daysRemaining} days. Upgrade now to continue using all features.`,
      },
      [SystemEvent.LIMIT_REACHED]: {
        subject: `${payload.limitType} Limit Reached`,
        html: this.getLimitReachedHtml(payload),
        text: `You've reached your ${payload.limitType} limit (${payload.limit}). Upgrade your plan for more capacity.`,
      },
    };

    return templates[eventType] || null;
  }

  /**
   * Email templates
   */
  private getPostFailedHtml(payload: Record<string, any>): string {
    return `
      <h2>Post Publishing Failed</h2>
      <p>Your post failed to publish to <strong>${payload.platform}</strong>.</p>
      <p><strong>Error:</strong> ${payload.error}</p>
      <p>Please check your connection and try again.</p>
      <a href="${config.app.url}/posts/${payload.postId}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Post</a>
    `;
  }

  private getApprovalRequiredHtml(payload: Record<string, any>): string {
    return `
      <h2>Post Approval Required</h2>
      <p>A new post is waiting for your approval.</p>
      <p><strong>Content:</strong> ${payload.content.substring(0, 200)}${payload.content.length > 200 ? '...' : ''}</p>
      <a href="${config.app.url}/approvals/${payload.postId}" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review Post</a>
    `;
  }

  private getConnectionExpiredHtml(payload: Record<string, any>): string {
    return `
      <h2>Connection Expired</h2>
      <p>Your <strong>${payload.platform}</strong> connection has expired.</p>
      <p>Please reconnect your account to continue publishing posts.</p>
      <a href="${config.app.url}/settings/connections" style="background-color: #FF9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reconnect Account</a>
    `;
  }

  private getSubscriptionFailedHtml(payload: Record<string, any>): string {
    return `
      <h2>Subscription Payment Failed</h2>
      <p>Your subscription payment failed: <strong>${payload.reason}</strong></p>
      <p>Please update your payment method to avoid service interruption.</p>
      <a href="${config.app.url}/settings/billing" style="background-color: #F44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Update Payment Method</a>
    `;
  }

  private getPaymentFailedHtml(payload: Record<string, any>): string {
    return `
      <h2>Payment Failed</h2>
      <p>Payment of <strong>$${(payload.amount / 100).toFixed(2)}</strong> failed: ${payload.reason}</p>
      <p>Please update your payment method.</p>
      <a href="${config.app.url}/settings/billing" style="background-color: #F44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Update Payment Method</a>
    `;
  }

  private getTrialEndingHtml(payload: Record<string, any>): string {
    return `
      <h2>Trial Ending Soon</h2>
      <p>Your trial ends in <strong>${payload.daysRemaining} days</strong>.</p>
      <p>Upgrade now to continue using all features without interruption.</p>
      <a href="${config.app.url}/settings/billing" style="background-color: #9C27B0; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Upgrade Now</a>
    `;
  }

  private getLimitReachedHtml(payload: Record<string, any>): string {
    return `
      <h2>Limit Reached</h2>
      <p>You've reached your <strong>${payload.limitType}</strong> limit (${payload.limit}).</p>
      <p>Upgrade your plan for more capacity.</p>
      <a href="${config.app.url}/settings/billing" style="background-color: #FF5722; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Upgrade Plan</a>
    `;
  }

  /**
   * Get recipient email
   */
  private async getRecipientEmail(
    workspaceId: string,
    userId?: string
  ): Promise<string | null> {
    // TODO: Query user email from database
    // For now, return placeholder
    return 'user@example.com';
  }

  /**
   * Send OAuth expired notification
   */
  async sendOAuthExpired(params: {
    to: string;
    platform: string;
    reconnectUrl: string;
    userId: string;
    workspaceId: string;
  }): Promise<void> {
    try {
      await this.emailProvider.sendEmail({
        to: params.to,
        subject: `${params.platform} Connection Expired`,
        html: `
          <h2>Connection Expired</h2>
          <p>Your <strong>${params.platform}</strong> connection has expired.</p>
          <p>Please reconnect your account to continue publishing posts.</p>
          <a href="${params.reconnectUrl}" style="background-color: #FF9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reconnect Account</a>
        `,
        text: `Your ${params.platform} connection has expired. Please reconnect your account to continue publishing. Visit: ${params.reconnectUrl}`,
      });

      logger.info('OAuth expired email sent', {
        to: params.to,
        platform: params.platform,
      });
    } catch (error: any) {
      logger.error('Failed to send OAuth expired email:', error);
      throw error;
    }
  }

  /**
   * Send magic link email for passwordless authentication
   */
  async sendMagicLink(params: {
    to: string;
    magicLinkUrl: string;
    userName?: string;
    expiresIn?: string;
  }): Promise<void> {
    try {
      const templateService = new EmailTemplateService();
      const template = templateService.render('MAGIC_LINK', {
        magicLinkUrl: params.magicLinkUrl,
        userName: params.userName || '',
        expiresIn: params.expiresIn || '15 minutes',
      });

      await this.emailProvider.sendEmail({
        to: params.to,
        subject: template.subject,
        html: template.html,
        text: template.body,
      });

      logger.info('Magic link email sent', {
        to: params.to,
        expiresIn: params.expiresIn,
      });
    } catch (error: any) {
      logger.error('Failed to send magic link email:', error);
      throw error;
    }
  }

  /**
   * Send post success notification
   */
  async sendPostSuccess(params: {
    to: string;
    platform: string;
    postId: string;
    content: string;
    publishedAt: Date;
  }): Promise<void> {
    try {
      await this.emailProvider.sendEmail({
        to: params.to,
        subject: `Post Published Successfully to ${params.platform}`,
        html: `
          <h2>Post Published Successfully</h2>
          <p>Your post has been published to <strong>${params.platform}</strong>.</p>
          <p><strong>Content:</strong> ${params.content.substring(0, 200)}${params.content.length > 200 ? '...' : ''}</p>
          <p><strong>Published at:</strong> ${params.publishedAt.toLocaleString()}</p>
        `,
        text: `Your post has been published successfully to ${params.platform}. Content: ${params.content}`,
      });

      logger.info('Post success email sent', {
        to: params.to,
        platform: params.platform,
        postId: params.postId,
      });
    } catch (error: any) {
      logger.error('Failed to send post success email:', error);
      throw error;
    }
  }

  /**
   * Send post failure notification
   */
  async sendPostFailure(params: {
    to: string;
    platform: string;
    postId: string;
    content: string;
    error: string;
    failedAt: Date;
  }): Promise<void> {
    try {
      await this.emailProvider.sendEmail({
        to: params.to,
        subject: `Post Failed to Publish to ${params.platform}`,
        html: `
          <h2>Post Publishing Failed</h2>
          <p>Your post failed to publish to <strong>${params.platform}</strong>.</p>
          <p><strong>Content:</strong> ${params.content.substring(0, 200)}${params.content.length > 200 ? '...' : ''}</p>
          <p><strong>Error:</strong> ${params.error}</p>
          <p><strong>Failed at:</strong> ${params.failedAt.toLocaleString()}</p>
          <p>Please check your connection and try again.</p>
        `,
        text: `Your post failed to publish to ${params.platform}. Error: ${params.error}. Please check your connection and try again.`,
      });

      logger.info('Post failure email sent', {
        to: params.to,
        platform: params.platform,
        postId: params.postId,
      });
    } catch (error: any) {
      logger.error('Failed to send post failure email:', error);
      throw error;
    }
  }

  /**
   * Send email verification email
   */
  async sendEmailVerificationEmail(params: {
    to: string;
    firstName: string;
    verificationUrl: string;
  }): Promise<void> {
    try {
      await this.emailProvider.sendEmail({
        to: params.to,
        subject: 'Verify Your Email Address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Verify Your Email Address</h2>
            <p>Hi ${params.firstName},</p>
            <p>Thank you for registering! Please verify your email address to complete your account setup.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${params.verificationUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Verify Email Address
              </a>
            </p>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6b7280;">${params.verificationUrl}</p>
            <p>This verification link will expire in 24 hours.</p>
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
        `,
        text: `Hi ${params.firstName}, Thank you for registering! Please verify your email address by clicking this link: ${params.verificationUrl} This verification link will expire in 24 hours. If you didn't create an account, please ignore this email.`,
      });

      logger.info('Email verification email sent', { to: params.to });
    } catch (error: any) {
      logger.error('Failed to send email verification email', { error: error.message, to: params.to });
      throw error;
    }
  }

  async sendWelcomeEmail(params: {
    to: string;
    firstName: string;
    dashboardUrl: string;
  }): Promise<void> {
    try {
      await this.emailProvider.sendEmail({
        to: params.to,
        subject: 'Welcome to Social Media Scheduler!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Welcome to Social Media Scheduler!</h2>
            <p>Hi ${params.firstName},</p>
            <p>Welcome to Social Media Scheduler! We're excited to have you on board.</p>
            <p>You can now start scheduling your social media posts and managing your content across multiple platforms.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${params.dashboardUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Get Started</a>
            </p>
            <p>Here's what you can do with Social Media Scheduler:</p>
            <ul>
              <li>Schedule posts across multiple social media platforms</li>
              <li>Manage your content calendar</li>
              <li>Track your social media performance</li>
              <li>Collaborate with your team</li>
            </ul>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Best regards,<br>The Social Media Scheduler Team</p>
          </div>
        `,
        text: `Hi ${params.firstName}, Welcome to Social Media Scheduler! We're excited to have you on board. You can now start scheduling your social media posts and managing your content across multiple platforms. Visit your dashboard: ${params.dashboardUrl}`,
      });

      logger.info('Welcome email sent', { to: params.to });
    } catch (error: any) {
      logger.error('Failed to send welcome email', { error: error.message, to: params.to });
      throw error;
    }
  }

  async sendPasswordResetEmail(params: {
    to: string;
    firstName: string;
    resetUrl: string;
    expiresIn: string;
  }): Promise<void> {
    try {
      await this.emailProvider.sendEmail({
        to: params.to,
        subject: 'Reset Your Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Reset Your Password</h2>
            <p>Hi ${params.firstName},</p>
            <p>You requested to reset your password. Click the button below to set a new password:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${params.resetUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
            </p>
            <p>This link will expire in ${params.expiresIn}. If you didn't request this, you can safely ignore this email.</p>
            <p>For security reasons, this link can only be used once.</p>
            <p>Best regards,<br>Your Social Media Team</p>
          </div>
        `,
        text: `Hi ${params.firstName}, you requested to reset your password. Visit this link to set a new password: ${params.resetUrl}. This link will expire in ${params.expiresIn}.`,
      });

      logger.info('Password reset email sent', { to: params.to });
    } catch (error: any) {
      logger.error('Failed to send password reset email', { error: error.message, to: params.to });
      throw error;
    }
  }

  /**
   * Send account deletion confirmation email
   */
  async sendAccountDeletionConfirmation(params: {
    to: string;
    userName: string;
    deletedAt: Date;
    dataRetentionInfo: string;
  }): Promise<void> {
    try {
      await this.emailProvider.sendEmail({
        to: params.to,
        subject: 'Account Deletion Confirmation',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">Account Deletion Confirmation</h2>
            <p>Hi ${params.userName},</p>
            <p>This email confirms that your account has been permanently deleted on ${params.deletedAt.toLocaleDateString()}.</p>
            <p><strong>Data Retention Information:</strong></p>
            <p>${params.dataRetentionInfo}</p>
            <p>All your personal data, posts, analytics, and settings have been permanently removed from our systems in compliance with GDPR Article 17 (Right to Erasure).</p>
            <p>If you did not request this deletion or believe this was done in error, please contact our support team immediately at support@example.com.</p>
            <p>Thank you for using our service.</p>
            <p>Best regards,<br>Your Social Media Team</p>
          </div>
        `,
        text: `Hi ${params.userName}, this email confirms that your account has been permanently deleted on ${params.deletedAt.toLocaleDateString()}. ${params.dataRetentionInfo} All your personal data has been permanently removed from our systems in compliance with GDPR Article 17.`,
      });

      logger.info('Account deletion confirmation email sent', { to: params.to });
    } catch (error: any) {
      logger.error('Failed to send account deletion confirmation email', { error: error.message, to: params.to });
      throw error;
    }
  }
}

export const emailNotificationService = new EmailNotificationService();