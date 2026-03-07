/**
 * Test Email System
 * 
 * Tests the email notification system end-to-end
 * 
 * Usage:
 *   tsx scripts/test-email-system.ts
 */

import { connectDB } from '../src/config/database';
import { connectRedis } from '../src/config/redis';
import { emailNotificationService } from '../src/services/EmailNotificationService';
import { EmailWorker } from '../src/workers/EmailWorker';
import { logger } from '../src/utils/logger';

async function main() {
  try {
    logger.info('Testing email notification system...');

    // Connect to MongoDB and Redis
    await connectDB();
    await connectRedis();

    // Start email worker
    const emailWorker = new EmailWorker();
    emailWorker.start();

    logger.info('Email worker started');

    // Test 1: Post success email
    logger.info('Test 1: Sending post success email...');
    await emailNotificationService.sendPostSuccess({
      to: 'test@example.com',
      platform: 'Twitter',
      postTitle: 'Test post for email system',
      platformUrl: 'https://twitter.com/test/status/123',
    });

    // Test 2: Post failure email
    logger.info('Test 2: Sending post failure email...');
    await emailNotificationService.sendPostFailure({
      to: 'test@example.com',
      platform: 'LinkedIn',
      postTitle: 'Failed test post',
      error: 'API rate limit exceeded',
    });

    // Test 3: OAuth expired email
    logger.info('Test 3: Sending OAuth expired email...');
    await emailNotificationService.sendOAuthExpired({
      to: 'test@example.com',
      platform: 'Facebook',
      reconnectUrl: 'https://app.example.com/reconnect',
    });

    // Test 4: User signup email
    logger.info('Test 4: Sending user signup email...');
    await emailNotificationService.sendUserSignup({
      to: 'newuser@example.com',
      userName: 'John Doe',
      verificationUrl: 'https://app.example.com/verify?token=abc123',
    });

    // Test 5: Password reset email
    logger.info('Test 5: Sending password reset email...');
    await emailNotificationService.sendPasswordReset({
      to: 'test@example.com',
      resetUrl: 'https://app.example.com/reset?token=xyz789',
      expiresIn: '1 hour',
    });

    // Test 6: Subscription created email
    logger.info('Test 6: Sending subscription created email...');
    await emailNotificationService.sendSubscriptionCreated({
      to: 'test@example.com',
      planName: 'Pro',
      billingPeriod: 'monthly',
    });

    // Test 7: Payment failed email
    logger.info('Test 7: Sending payment failed email...');
    await emailNotificationService.sendPaymentFailed({
      to: 'test@example.com',
      amount: '$29.99',
      updatePaymentUrl: 'https://app.example.com/billing',
    });

    logger.info('All test emails queued successfully!');
    logger.info('Waiting 10 seconds for emails to process...');

    // Wait for emails to process
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get metrics
    const metrics = emailWorker.getMetrics();
    logger.info('Email worker metrics:', metrics);

    // Stop worker
    await emailWorker.stop();
    logger.info('Email worker stopped');

    logger.info('Email system test completed!');
    process.exit(0);

  } catch (error) {
    logger.error('Email system test failed:', error);
    process.exit(1);
  }
}

main();
