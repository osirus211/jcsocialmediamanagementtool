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
        
        case 'WELCOME_DAY_0':
          return this.renderWelcomeDay0(data);
        
        case 'WELCOME_DAY_1':
          return this.renderWelcomeDay1(data);
        
        case 'WELCOME_DAY_3':
          return this.renderWelcomeDay3(data);
        
        case 'WELCOME_DAY_7':
          return this.renderWelcomeDay7(data);
        
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

  private renderWelcomeDay0(data: Record<string, any>): EmailTemplate {
    const userName = this.escapeHtml(data.userName || 'there');
    const firstName = this.escapeHtml(data.firstName || 'there');
    const dashboardUrl = data.dashboardUrl || '';
    const onboardingUrl = data.onboardingUrl || '';
    const quickStartSteps = data.quickStartSteps || [];

    const subject = `Welcome to our platform, ${firstName}!`;
    
    const body = `Hi ${userName},

Welcome to our social media management platform! We're thrilled to have you on board.

To get you started quickly, here are 3 simple steps:

${quickStartSteps.map((step: string, index: number) => `${index + 1}. ${step}`).join('\n')}

Ready to dive in? Start with our quick onboarding guide:
${onboardingUrl}

Or jump straight to your dashboard:
${dashboardUrl}

If you have any questions, just reply to this email - we're here to help!

Best regards,
The Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Welcome to our platform, ${firstName}! 🎉</h1>
        
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
          We're thrilled to have you on board. Let's get you started with creating amazing social media content!
        </p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; font-size: 18px; margin-bottom: 15px;">Quick Start Guide</h2>
          <ol style="color: #666; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
            ${quickStartSteps.map((step: string) => `<li style="margin-bottom: 8px;">${this.escapeHtml(step)}</li>`).join('')}
          </ol>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${onboardingUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Start Onboarding</a>
        </div>
        
        <p style="color: #666; font-size: 14px; line-height: 1.5; margin-top: 30px;">
          Questions? Just reply to this email - we're here to help!
        </p>
        
        <p style="color: #666; font-size: 14px;">
          Best regards,<br>
          The Team
        </p>
      </div>
    `;

    return { subject, body, html };
  }

  private renderWelcomeDay1(data: Record<string, any>): EmailTemplate {
    const firstName = this.escapeHtml(data.firstName || 'there');
    const connectAccountsUrl = data.connectAccountsUrl || '';
    const createPostUrl = data.createPostUrl || '';
    const helpUrl = data.helpUrl || '';

    const subject = `Ready to connect your social accounts?`;
    
    const body = `Hi ${firstName},

Hope you're settling in well! Today, let's get your social media accounts connected so you can start scheduling posts.

Here's what you can do right now:

1. Connect Your Social Accounts
   Link your Twitter, Facebook, Instagram, and LinkedIn accounts in just a few clicks.
   ${connectAccountsUrl}

2. Create Your First Post
   Use our composer to craft the perfect post with AI assistance.
   ${createPostUrl}

3. Schedule for Peak Times
   Our analytics will suggest the best times to post for maximum engagement.

Need help? Check out our documentation:
${helpUrl}

You've got this!

Best regards,
The Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Ready to connect your social accounts? 🔗</h1>
        
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
          Hi ${firstName}, hope you're settling in well! Let's get your social media accounts connected.
        </p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; font-size: 18px; margin-bottom: 15px;">Next Steps</h2>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #007bff; font-size: 16px; margin-bottom: 8px;">1. Connect Your Social Accounts</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">Link Twitter, Facebook, Instagram, and LinkedIn in just a few clicks.</p>
            <a href="${connectAccountsUrl}" style="color: #007bff; text-decoration: none; font-weight: bold;">Connect Accounts →</a>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #007bff; font-size: 16px; margin-bottom: 8px;">2. Create Your First Post</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">Use our composer with AI assistance to craft the perfect post.</p>
            <a href="${createPostUrl}" style="color: #007bff; text-decoration: none; font-weight: bold;">Create Post →</a>
          </div>
          
          <div>
            <h3 style="color: #007bff; font-size: 16px; margin-bottom: 8px;">3. Schedule for Peak Times</h3>
            <p style="color: #666; font-size: 14px;">Our analytics suggest the best times for maximum engagement.</p>
          </div>
        </div>
        
        <p style="color: #666; font-size: 14px; line-height: 1.5;">
          Need help? <a href="${helpUrl}" style="color: #007bff;">Check out our documentation</a>
        </p>
        
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
          You've got this!<br>
          The Team
        </p>
      </div>
    `;

    return { subject, body, html };
  }

  private renderWelcomeDay3(data: Record<string, any>): EmailTemplate {
    const firstName = this.escapeHtml(data.firstName || 'there');
    const analyticsUrl = data.analyticsUrl || '';
    const teamUrl = data.teamUrl || '';
    const bestPracticesUrl = data.bestPracticesUrl || '';

    const subject = `Unlock powerful features for your social media`;
    
    const body = `Hi ${firstName},

You're doing great! By now you might have connected some accounts and created your first posts. 

Let's explore some powerful features that will take your social media game to the next level:

📊 Analytics & Insights
Track your performance, see what content resonates, and optimize your strategy.
${analyticsUrl}

👥 Team Collaboration
Invite team members, set up approval workflows, and collaborate seamlessly.
${teamUrl}

💡 Best Practices
Learn proven strategies for each platform to maximize your reach and engagement.
${bestPracticesUrl}

Pro tip: The best time to post varies by platform and audience. Check your analytics to find your optimal posting times!

Keep up the momentum!

Best regards,
The Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Unlock powerful features 🚀</h1>
        
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
          Hi ${firstName}, you're doing great! Let's explore features that will take your social media to the next level.
        </p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="margin-bottom: 25px;">
            <h3 style="color: #007bff; font-size: 18px; margin-bottom: 10px;">📊 Analytics & Insights</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 12px;">Track performance, see what resonates, and optimize your strategy.</p>
            <a href="${analyticsUrl}" style="color: #007bff; text-decoration: none; font-weight: bold;">View Analytics →</a>
          </div>
          
          <div style="margin-bottom: 25px;">
            <h3 style="color: #007bff; font-size: 18px; margin-bottom: 10px;">👥 Team Collaboration</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 12px;">Invite team members, set up approval workflows, and collaborate seamlessly.</p>
            <a href="${teamUrl}" style="color: #007bff; text-decoration: none; font-weight: bold;">Manage Team →</a>
          </div>
          
          <div>
            <h3 style="color: #007bff; font-size: 18px; margin-bottom: 10px;">💡 Best Practices</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 12px;">Learn proven strategies for each platform to maximize reach and engagement.</p>
            <a href="${bestPracticesUrl}" style="color: #007bff; text-decoration: none; font-weight: bold;">Learn More →</a>
          </div>
        </div>
        
        <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="color: #1976d2; font-size: 14px; margin: 0; font-weight: bold;">💡 Pro tip:</p>
          <p style="color: #666; font-size: 14px; margin: 5px 0 0 0;">The best time to post varies by platform and audience. Check your analytics to find your optimal posting times!</p>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
          Keep up the momentum!<br>
          The Team
        </p>
      </div>
    `;

    return { subject, body, html };
  }

  private renderWelcomeDay7(data: Record<string, any>): EmailTemplate {
    const firstName = this.escapeHtml(data.firstName || 'there');
    const progressSummary = data.progressSummary || 'You\'ve taken the first steps with our platform!';
    const upgradeUrl = data.upgradeUrl || '';
    const supportUrl = data.supportUrl || '';
    const dashboardUrl = data.dashboardUrl || '';

    const subject = `How are you doing? Let's check your progress`;
    
    const body = `Hi ${firstName},

It's been a week since you joined us! How has your experience been so far?

${progressSummary}

Here's how we can help you succeed even more:

🎯 Need More Features?
If you're on our free plan, consider upgrading to unlock advanced features like:
- Unlimited posts and scheduling
- Advanced analytics and reporting  
- Team collaboration tools
- Priority support

${upgradeUrl}

❓ Questions or Need Help?
Our support team is here to help you succeed. Don't hesitate to reach out!
${supportUrl}

📈 Keep Growing
Check your dashboard to see your progress and plan your next posts:
${dashboardUrl}

We're here to support your social media success every step of the way.

Best regards,
The Team

P.S. We'd love to hear about your experience! Just reply to this email and let us know how we're doing.`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">How are you doing? 📈</h1>
        
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
          Hi ${firstName}, it's been a week since you joined us! How has your experience been so far?
        </p>
        
        <div style="background: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="color: #2e7d32; font-size: 14px; margin: 0;">${this.escapeHtml(progressSummary)}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; font-size: 18px; margin-bottom: 15px;">How we can help you succeed even more:</h2>
          
          <div style="margin-bottom: 25px;">
            <h3 style="color: #007bff; font-size: 16px; margin-bottom: 10px;">🎯 Need More Features?</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">If you're on our free plan, consider upgrading to unlock:</p>
            <ul style="color: #666; font-size: 14px; margin: 10px 0; padding-left: 20px;">
              <li>Unlimited posts and scheduling</li>
              <li>Advanced analytics and reporting</li>
              <li>Team collaboration tools</li>
              <li>Priority support</li>
            </ul>
            <a href="${upgradeUrl}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; margin-top: 10px;">Upgrade Now</a>
          </div>
          
          <div style="margin-bottom: 25px;">
            <h3 style="color: #007bff; font-size: 16px; margin-bottom: 10px;">❓ Questions or Need Help?</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">Our support team is here to help you succeed.</p>
            <a href="${supportUrl}" style="color: #007bff; text-decoration: none; font-weight: bold;">Contact Support →</a>
          </div>
          
          <div>
            <h3 style="color: #007bff; font-size: 16px; margin-bottom: 10px;">📈 Keep Growing</h3>
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">Check your dashboard to see your progress and plan your next posts.</p>
            <a href="${dashboardUrl}" style="color: #007bff; text-decoration: none; font-weight: bold;">View Dashboard →</a>
          </div>
        </div>
        
        <p style="color: #666; font-size: 14px; line-height: 1.5; margin-top: 20px;">
          We're here to support your social media success every step of the way.
        </p>
        
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
          Best regards,<br>
          The Team
        </p>
        
        <p style="color: #999; font-size: 12px; margin-top: 20px; font-style: italic;">
          P.S. We'd love to hear about your experience! Just reply to this email and let us know how we're doing.
        </p>
      </div>
    `;

    return { subject, body, html };
  }
}

export const emailTemplateService = new EmailTemplateService();
