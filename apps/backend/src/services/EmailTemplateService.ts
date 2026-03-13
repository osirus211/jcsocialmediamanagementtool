import { NotificationType } from '../queue/EmailQueue';

/**
 * Email Template Service
 * 
 * Renders email templates for different notification types
 * 
 * Features:
 * - Type-safe template rendering
 * - HTML and plain text generation
 * - XSS protection (HTML escaping)
 * - Fallback templates
 */

export interface EmailTemplate {
  subject: string;
  body: string;
  html: string;
}

export class EmailTemplateService {
  /**
   * Render email template
   */
  render(type: NotificationType, data: Record<string, any>): EmailTemplate {
    try {
      switch (type) {
        case 'POST_SUCCESS':
          return this.renderPostSuccess(data);
        
        case 'POST_FAILURE':
          return this.renderPostFailure(data);
        
        case 'OAUTH_EXPIRED':
          return this.renderOAuthExpired(data);
        
        case 'OAUTH_REFRESH_FAILURE':
          return this.renderOAuthRefreshFailure(data);
        
        case 'SYSTEM_ALERT':
          return this.renderSystemAlert(data);
        
        case 'ACCOUNT_LIMITS':
          return this.renderAccountLimits(data);
        
        case 'USER_SIGNUP':
          return this.renderUserSignup(data);
        
        case 'PASSWORD_RESET':
          return this.renderPasswordReset(data);
        
        case 'MAGIC_LINK':
          return this.renderMagicLink(data);
        
        case 'SUBSCRIPTION_CREATED':
          return this.renderSubscriptionCreated(data);
        
        case 'SUBSCRIPTION_UPDATED':
          return this.renderSubscriptionUpdated(data);
        
        case 'SUBSCRIPTION_CANCELLED':
          return this.renderSubscriptionCancelled(data);
        
        case 'PAYMENT_FAILED':
          return this.renderPaymentFailed(data);
        
        default:
          return this.renderFallback(type, data);
      }
    } catch (error: any) {
      console.error(`Template rendering error for ${type}:`, error.message);
      return this.renderFallback(type, data);
    }
  }

  private renderPostSuccess(data: Record<string, any>): EmailTemplate {
    const platform = data.platform || 'social media';
    const postTitle = this.escapeHtml(data.postTitle || 'Your post');
    const platformUrl = data.platformUrl || '';

    const subject = `Post published successfully to ${platform}`;
    const body = `${postTitle} has been published to ${platform}.${platformUrl ? `\n\nView post: ${platformUrl}` : ''}`;
    const html = `
      <h2>Post Published Successfully</h2>
      <p><strong>${postTitle}</strong> has been published to <strong>${platform}</strong>.</p>
      ${platformUrl ? `<p><a href="${platformUrl}">View your post</a></p>` : ''}
    `;

    return { subject, body, html };
  }

  private renderPostFailure(data: Record<string, any>): EmailTemplate {
    const platform = data.platform || 'social media';
    const error = this.escapeHtml(data.error || 'Unknown error');
    const postTitle = this.escapeHtml(data.postTitle || 'Your post');

    const subject = `Post failed to publish to ${platform}`;
    const body = `${postTitle} failed to publish to ${platform}.\n\nError: ${error}\n\nPlease check your account connection and try again.`;
    const html = `
      <h2>Post Publishing Failed</h2>
      <p><strong>${postTitle}</strong> failed to publish to <strong>${platform}</strong>.</p>
      <p><strong>Error:</strong> ${error}</p>
      <p>Please check your account connection and try again.</p>
    `;

    return { subject, body, html };
  }

  private renderOAuthExpired(data: Record<string, any>): EmailTemplate {
    const platform = data.platform || 'social media';
    const reconnectUrl = data.reconnectUrl || '';

    const subject = `${platform} authentication expired`;
    const body = `Your ${platform} authentication has expired. Please re-authenticate to continue publishing.${reconnectUrl ? `\n\nReconnect: ${reconnectUrl}` : ''}`;
    const html = `
      <h2>Authentication Expired</h2>
      <p>Your <strong>${platform}</strong> authentication has expired.</p>
      <p>Please re-authenticate to continue publishing.</p>
      ${reconnectUrl ? `<p><a href="${reconnectUrl}">Reconnect ${platform}</a></p>` : ''}
    `;

    return { subject, body, html };
  }

  private renderOAuthRefreshFailure(data: Record<string, any>): EmailTemplate {
    const platform = data.platform || 'social media';
    const reconnectUrl = data.reconnectUrl || '';

    const subject = `${platform} token refresh failed`;
    const body = `Failed to refresh your ${platform} token. Manual intervention required.${reconnectUrl ? `\n\nReconnect: ${reconnectUrl}` : ''}`;
    const html = `
      <h2>Token Refresh Failed</h2>
      <p>Failed to refresh your <strong>${platform}</strong> token.</p>
      <p>Manual intervention required. Please reconnect your account.</p>
      ${reconnectUrl ? `<p><a href="${reconnectUrl}">Reconnect ${platform}</a></p>` : ''}
    `;

    return { subject, body, html };
  }

  private renderSystemAlert(data: Record<string, any>): EmailTemplate {
    const alertType = data.alertType || 'system issue';
    const message = this.escapeHtml(data.message || 'System alert');
    const severity = data.severity || 'warning';

    const subject = `System Alert: ${alertType}`;
    const body = `${message}\n\nSeverity: ${severity}`;
    const html = `
      <h2>System Alert: ${alertType}</h2>
      <p>${message}</p>
      <p><strong>Severity:</strong> ${severity}</p>
    `;

    return { subject, body, html };
  }

  private renderAccountLimits(data: Record<string, any>): EmailTemplate {
    const limitType = data.limitType || 'account limit';
    const current = data.current || 0;
    const max = data.max || 0;
    const upgradeUrl = data.upgradeUrl || '';

    const subject = `Account limit notification: ${limitType}`;
    const body = `You are approaching your ${limitType} (${current}/${max}).${upgradeUrl ? `\n\nUpgrade your plan: ${upgradeUrl}` : ''}`;
    const html = `
      <h2>Account Limit Notification</h2>
      <p>You are approaching your <strong>${limitType}</strong> (${current}/${max}).</p>
      ${upgradeUrl ? `<p><a href="${upgradeUrl}">Upgrade your plan</a></p>` : ''}
    `;

    return { subject, body, html };
  }

  private renderUserSignup(data: Record<string, any>): EmailTemplate {
    const userName = this.escapeHtml(data.userName || 'there');
    const verificationUrl = data.verificationUrl || '';

    const subject = 'Welcome to Social Media Manager';
    const body = `Hi ${userName},\n\nWelcome to Social Media Manager! We're excited to have you on board.${verificationUrl ? `\n\nVerify your email: ${verificationUrl}` : ''}`;
    const html = `
      <h2>Welcome to Social Media Manager</h2>
      <p>Hi ${userName},</p>
      <p>Welcome to Social Media Manager! We're excited to have you on board.</p>
      ${verificationUrl ? `<p><a href="${verificationUrl}">Verify your email</a></p>` : ''}
    `;

    return { subject, body, html };
  }

  private renderPasswordReset(data: Record<string, any>): EmailTemplate {
    const resetUrl = data.resetUrl || '';
    const expiresIn = data.expiresIn || '1 hour';

    const subject = 'Password Reset Request';
    const body = `You requested a password reset.\n\nReset your password: ${resetUrl}\n\nThis link expires in ${expiresIn}.`;
    const html = `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in ${expiresIn}.</p>
    `;

    return { subject, body, html };
  }

  private renderMagicLink(data: Record<string, any>): EmailTemplate {
    const magicLinkUrl = data.magicLinkUrl || '';
    const expiresIn = data.expiresIn || '15 minutes';
    const userName = this.escapeHtml(data.userName || '');

    const subject = 'Your Magic Link - Sign in to Social Media Manager';
    const body = `${userName ? `Hi ${userName},\n\n` : ''}Click the link below to sign in to your Social Media Manager account:\n\n${magicLinkUrl}\n\nThis link expires in ${expiresIn} and can only be used once.\n\nIf you didn't request this, please ignore this email.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Sign in to Social Media Manager</h2>
        ${userName ? `<p>Hi ${userName},</p>` : ''}
        <p>Click the button below to sign in to your account:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicLinkUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
            Sign In Now
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          This link expires in ${expiresIn} and can only be used once.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          If you didn't request this, please ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <span style="word-break: break-all;">${magicLinkUrl}</span>
        </p>
      </div>
    `;

    return { subject, body, html };
  }

  private renderSubscriptionCreated(data: Record<string, any>): EmailTemplate {
    const planName = data.planName || 'your plan';
    const billingPeriod = data.billingPeriod || 'monthly';

    const subject = 'Subscription Activated';
    const body = `Your ${planName} subscription (${billingPeriod}) has been activated.`;
    const html = `
      <h2>Subscription Activated</h2>
      <p>Your <strong>${planName}</strong> subscription (${billingPeriod}) has been activated.</p>
    `;

    return { subject, body, html };
  }

  private renderSubscriptionUpdated(data: Record<string, any>): EmailTemplate {
    const planName = data.planName || 'your plan';
    const changeType = data.changeType || 'updated';

    const subject = 'Subscription Updated';
    const body = `Your subscription has been ${changeType} to ${planName}.`;
    const html = `
      <h2>Subscription Updated</h2>
      <p>Your subscription has been ${changeType} to <strong>${planName}</strong>.</p>
    `;

    return { subject, body, html };
  }

  private renderSubscriptionCancelled(data: Record<string, any>): EmailTemplate {
    const endDate = data.endDate || 'the end of your billing period';

    const subject = 'Subscription Cancelled';
    const body = `Your subscription has been cancelled. You will have access until ${endDate}.`;
    const html = `
      <h2>Subscription Cancelled</h2>
      <p>Your subscription has been cancelled.</p>
      <p>You will have access until ${endDate}.</p>
    `;

    return { subject, body, html };
  }

  private renderPaymentFailed(data: Record<string, any>): EmailTemplate {
    const amount = data.amount || 'your subscription';
    const updatePaymentUrl = data.updatePaymentUrl || '';

    const subject = 'Payment Failed';
    const body = `Your payment for ${amount} failed. Please update your payment method.${updatePaymentUrl ? `\n\nUpdate payment: ${updatePaymentUrl}` : ''}`;
    const html = `
      <h2>Payment Failed</h2>
      <p>Your payment for ${amount} failed.</p>
      <p>Please update your payment method.</p>
      ${updatePaymentUrl ? `<p><a href="${updatePaymentUrl}">Update payment method</a></p>` : ''}
    `;

    return { subject, body, html };
  }

  private renderFallback(type: NotificationType, data: Record<string, any>): EmailTemplate {
    const subject = 'Notification';
    const body = `You have a new notification of type: ${type}`;
    const html = `<p>You have a new notification of type: <strong>${type}</strong></p>`;

    return { subject, body, html };
  }

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
}

export const emailTemplateService = new EmailTemplateService();
