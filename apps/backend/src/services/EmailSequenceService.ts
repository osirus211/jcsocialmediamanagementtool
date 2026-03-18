import { Queue, Job } from 'bullmq';
import { QueueManager } from '../queue/QueueManager';
import { User, IUser } from '../models/User';
import { EmailTemplateService } from './EmailTemplateService';
import { EmailQueue } from '../queue/EmailQueue';
import { logger } from '../utils/logger';

/**
 * Email Sequence Service
 * 
 * Manages welcome email sequences for new users
 * 
 * Features:
 * - 4-step welcome email sequence (Day 0, 1, 3, 7)
 * - Delayed job scheduling
 * - Unsubscribe handling
 * - Progress tracking
 * - Retry logic for failed emails
 */

export interface EmailSequenceStep {
  step: number;
  delay: number; // milliseconds
  templateType: string;
  subject: string;
}

export const EMAIL_SEQUENCE_STEPS: EmailSequenceStep[] = [
  {
    step: 0,
    delay: 0, // Immediate
    templateType: 'WELCOME_DAY_0',
    subject: 'Welcome to [App Name] - Let\'s get started!'
  },
  {
    step: 1,
    delay: 24 * 60 * 60 * 1000, // 1 day
    templateType: 'WELCOME_DAY_1',
    subject: 'Quick start: Connect your first social account'
  },
  {
    step: 2,
    delay: 3 * 24 * 60 * 60 * 1000, // 3 days
    templateType: 'WELCOME_DAY_3',
    subject: 'Unlock powerful features for your social media'
  },
  {
    step: 3,
    delay: 7 * 24 * 60 * 60 * 1000, // 7 days
    templateType: 'WELCOME_DAY_7',
    subject: 'How are you doing? Let\'s check your progress'
  }
];

export class EmailSequenceService {
  private queue: Queue;
  private emailQueue: EmailQueue;
  private templateService: EmailTemplateService;

  constructor() {
    const queueManager = QueueManager.getInstance();
    this.queue = queueManager.getQueue('email-sequence-queue', {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 7 * 24 * 3600, // 7 days
          count: 1000,
        },
        removeOnFail: {
          age: 30 * 24 * 3600, // 30 days
          count: 5000,
        },
      },
    });

    this.emailQueue = new EmailQueue();
    this.templateService = new EmailTemplateService();
    
    logger.info('Email sequence service initialized');
  }
  /**
   * Start welcome email sequence for new user
   */
  async startSequence(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Check if sequence already started
      if (user.emailSequenceStarted) {
        logger.warn('Email sequence already started for user', { userId });
        return;
      }

      // Update user state
      user.emailSequenceStarted = true;
      user.emailSequenceStep = 0;
      await user.save();

      // Schedule all sequence emails
      for (const sequenceStep of EMAIL_SEQUENCE_STEPS) {
        await this.scheduleSequenceEmail(userId, sequenceStep);
      }

      logger.info('Email sequence started', { userId, totalSteps: EMAIL_SEQUENCE_STEPS.length });
    } catch (error: any) {
      logger.error('Failed to start email sequence', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Schedule a single sequence email with per-user timing
   */
  private async scheduleSequenceEmail(userId: string, sequenceStep: EmailSequenceStep): Promise<Job> {
    const jobId = `email-sequence-${userId}-step-${sequenceStep.step}`;
    
    // Calculate per-user delay based on registration time to spread load
    const user = await User.findById(userId);
    const baseDelay = sequenceStep.delay;
    const userSpecificOffset = user ? (user.createdAt.getTime() % (60 * 60 * 1000)) : 0; // 0-60 min offset
    const finalDelay = baseDelay + userSpecificOffset;
    
    const job = await this.queue.add(
      'send-sequence-email',
      {
        userId,
        step: sequenceStep.step,
        templateType: sequenceStep.templateType,
        subject: sequenceStep.subject,
      },
      {
        jobId,
        delay: finalDelay,
        priority: 5, // Medium priority
      }
    );

    logger.info('Sequence email scheduled with per-user timing', {
      userId,
      step: sequenceStep.step,
      baseDelay,
      userOffset: userSpecificOffset,
      finalDelay,
      jobId: job.id,
    });

    return job;
  }

  /**
   * Process sequence email job
   */
  async processSequenceEmail(jobData: {
    userId: string;
    step: number;
    templateType: string;
    subject: string;
  }): Promise<void> {
    try {
      const { userId, step, templateType, subject } = jobData;

      const user = await User.findById(userId);
      if (!user) {
        logger.warn('User not found for sequence email', { userId, step });
        return;
      }

      // Check if user unsubscribed or sequence completed
      if (!user.emailSequenceStarted || user.emailSequenceCompleted) {
        logger.info('Email sequence stopped or completed', { userId, step });
        return;
      }

      // Check if user unsubscribed from emails
      if (!user.notificationPreferences.email.weeklyReport) {
        logger.info('User unsubscribed from emails, stopping sequence', { userId, step });
        await this.stopSequence(userId);
        return;
      }

      // Send the email
      await this.sendSequenceEmail(user, step, templateType, subject);

      // Update user progress and set next email time
      user.emailSequenceStep = Math.max(user.emailSequenceStep, step);
      
      // Set nextEmailAt for the next step if not the last step
      const nextStep = EMAIL_SEQUENCE_STEPS.find(s => s.step === step + 1);
      if (nextStep) {
        const userSpecificOffset = user.createdAt.getTime() % (60 * 60 * 1000); // 0-60 min offset
        user.nextEmailAt = new Date(Date.now() + nextStep.delay + userSpecificOffset);
      } else {
        user.nextEmailAt = undefined; // No more emails
      }
      
      // Mark as completed if this is the last step
      if (step === EMAIL_SEQUENCE_STEPS.length - 1) {
        user.emailSequenceCompleted = true;
      }
      
      await user.save();

      logger.info('Sequence email sent successfully', { userId, step });
    } catch (error: any) {
      logger.error('Failed to process sequence email', { 
        userId: jobData.userId, 
        step: jobData.step, 
        error: error.message 
      });
      throw error;
    }
  }
  /**
   * Send individual sequence email
   */
  private async sendSequenceEmail(
    user: IUser, 
    step: number, 
    templateType: string, 
    subject: string
  ): Promise<void> {
    try {
      // Get template data based on step
      const templateData = this.getTemplateData(user, step);
      
      // Render email template
      const template = this.templateService.render(templateType as any, templateData);
      
      // Add unsubscribe link to all emails
      const unsubscribeUrl = `${process.env.FRONTEND_URL}/unsubscribe?token=${user._id}&type=sequence`;
      const emailHtml = this.addUnsubscribeLink(template.html || template.body, unsubscribeUrl);
      
      // Send via email queue
      await this.emailQueue.addEmail({
        type: 'USER_SIGNUP', // Reuse existing type for now
        to: user.email,
        subject: template.subject || subject,
        body: template.body,
        html: emailHtml,
        data: templateData,
        userId: user._id.toString(),
      });

      logger.info('Sequence email queued', { 
        userId: user._id, 
        step, 
        templateType,
        to: user.email 
      });
    } catch (error: any) {
      logger.error('Failed to send sequence email', { 
        userId: user._id, 
        step, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get template data for specific step
   */
  private getTemplateData(user: IUser, step: number): Record<string, any> {
    const baseData = {
      userName: user.getFullName(),
      firstName: user.firstName,
      email: user.email,
      dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
      helpUrl: `${process.env.FRONTEND_URL}/help`,
      onboardingUrl: `${process.env.FRONTEND_URL}/onboarding`,
    };

    switch (step) {
      case 0: // Welcome email
        return {
          ...baseData,
          quickStartSteps: [
            'Connect your social media accounts',
            'Create your first post',
            'Schedule it for the perfect time'
          ],
        };
      
      case 1: // Getting started tips
        return {
          ...baseData,
          connectAccountsUrl: `${process.env.FRONTEND_URL}/accounts/connect`,
          createPostUrl: `${process.env.FRONTEND_URL}/composer`,
        };
      
      case 2: // Feature highlights
        return {
          ...baseData,
          analyticsUrl: `${process.env.FRONTEND_URL}/analytics`,
          teamUrl: `${process.env.FRONTEND_URL}/team`,
          bestPracticesUrl: `${process.env.FRONTEND_URL}/help/best-practices`,
        };
      
      case 3: // Check-in email
        return {
          ...baseData,
          progressSummary: 'You\'ve taken the first steps with our platform!',
          upgradeUrl: `${process.env.FRONTEND_URL}/billing/upgrade`,
          supportUrl: `${process.env.FRONTEND_URL}/support`,
        };
      
      default:
        return baseData;
    }
  }

  /**
   * Add unsubscribe link to email HTML
   */
  private addUnsubscribeLink(html: string, unsubscribeUrl: string): string {
    const unsubscribeHtml = `
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
        <p>Don't want to receive these emails? <a href="${unsubscribeUrl}" style="color: #666;">Unsubscribe here</a></p>
      </div>
    `;
    
    // Insert before closing body tag, or append if no body tag
    if (html.includes('</body>')) {
      return html.replace('</body>', `${unsubscribeHtml}</body>`);
    } else {
      return html + unsubscribeHtml;
    }
  }
  /**
   * Stop email sequence for user (unsubscribe)
   */
  async stopSequence(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Update user state
      user.emailSequenceStarted = false;
      user.emailSequenceCompleted = true;
      await user.save();

      // Cancel pending sequence jobs
      await this.cancelPendingJobs(userId);

      logger.info('Email sequence stopped', { userId });
    } catch (error: any) {
      logger.error('Failed to stop email sequence', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Cancel pending sequence jobs for user
   */
  private async cancelPendingJobs(userId: string): Promise<void> {
    try {
      // Get all delayed jobs
      const delayedJobs = await this.queue.getDelayed(0, 1000);
      
      // Filter jobs for this user and cancel them
      const userJobs = delayedJobs.filter(job => 
        job.data.userId === userId && 
        job.name === 'send-sequence-email'
      );

      for (const job of userJobs) {
        await job.remove();
        logger.info('Cancelled sequence job', { userId, jobId: job.id, step: job.data.step });
      }

      logger.info('Cancelled pending sequence jobs', { userId, cancelledCount: userJobs.length });
    } catch (error: any) {
      logger.error('Failed to cancel pending jobs', { userId, error: error.message });
      // Don't throw - this is cleanup, main operation should succeed
    }
  }

  /**
   * Get sequence status for user
   */
  async getSequenceStatus(userId: string): Promise<{
    started: boolean;
    completed: boolean;
    currentStep: number;
    pendingJobs: number;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Count pending jobs
      const delayedJobs = await this.queue.getDelayed(0, 1000);
      const pendingJobs = delayedJobs.filter(job => 
        job.data.userId === userId && 
        job.name === 'send-sequence-email'
      ).length;

      return {
        started: user.emailSequenceStarted,
        completed: user.emailSequenceCompleted,
        currentStep: user.emailSequenceStep,
        pendingJobs,
      };
    } catch (error: any) {
      logger.error('Failed to get sequence status', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Restart sequence for user (admin function)
   */
  async restartSequence(userId: string): Promise<void> {
    try {
      // Stop current sequence
      await this.stopSequence(userId);
      
      // Reset user state
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      user.emailSequenceStarted = false;
      user.emailSequenceCompleted = false;
      user.emailSequenceStep = 0;
      await user.save();

      // Start new sequence
      await this.startSequence(userId);

      logger.info('Email sequence restarted', { userId });
    } catch (error: any) {
      logger.error('Failed to restart email sequence', { userId, error: error.message });
      throw error;
    }
  }
}

let emailSequenceServiceInstance: EmailSequenceService | null = null;

export const getEmailSequenceService = (): EmailSequenceService => {
  if (!emailSequenceServiceInstance) {
    emailSequenceServiceInstance = new EmailSequenceService();
  }
  return emailSequenceServiceInstance;
};

// For backward compatibility
export const emailSequenceService = {
  get instance() {
    return getEmailSequenceService();
  }
};