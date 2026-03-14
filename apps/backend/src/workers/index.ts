/**
 * Workers Index
 * 
 * Centralized worker registration with WorkerManager
 * Based on SYSTEM_RUNTIME_CLASSIFICATION.md
 */

import { WorkerManager, IWorker } from '../services/WorkerManager';
import { workerConfigs, getConfigSummary } from '../config/workers.config';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Worker adapter to ensure all workers implement IWorker interface
 */
class WorkerAdapter implements IWorker {
  constructor(
    private worker: any,
    private name: string
  ) {}

  start(): void {
    if (typeof this.worker.start === 'function') {
      this.worker.start();
    } else {
      logger.warn('Worker does not have start() method', { worker: this.name });
    }
  }

  async stop(): Promise<void> {
    if (typeof this.worker.stop === 'function') {
      const result = this.worker.stop();
      // Handle both sync and async stop methods
      if (result instanceof Promise) {
        await result;
      }
    } else {
      logger.warn('Worker does not have stop() method', { worker: this.name });
    }
  }

  getStatus(): { isRunning: boolean; metrics?: any } {
    if (typeof this.worker.getStatus === 'function') {
      return this.worker.getStatus();
    }
    
    // Fallback status for workers without getStatus()
    return {
      isRunning: this.worker.isRunning !== undefined ? this.worker.isRunning : false,
      metrics: this.worker.metrics || this.worker.getMetrics?.() || {},
    };
  }
}

// Import CORE_RUNTIME workers (always enabled)
import { SchedulerWorker } from './SchedulerWorker';
import { FacebookPublisherWorker } from './FacebookPublisherWorker';
import { InstagramPublisherWorker } from './InstagramPublisherWorker';
import { TwitterPublisherWorker } from './TwitterPublisherWorker';
import { LinkedInPublisherWorker } from './LinkedInPublisherWorker';
import { TikTokPublisherWorker } from './TikTokPublisherWorker';
// import { GoogleBusinessPublisherWorker } from './GoogleBusinessPublisherWorker';
import { TokenRefreshWorker } from './TokenRefreshWorker';
import { DistributedTokenRefreshWorker } from './DistributedTokenRefreshWorker';

// Import FEATURE_RUNTIME workers (configurable)
import { MediaProcessingWorker } from './MediaProcessingWorker';
import { EmailWorker } from './EmailWorker';
import { NotificationWorker } from './NotificationWorker';
import { AnalyticsCollectorWorker } from './AnalyticsCollectorWorker';
import { WebhookDeliveryWorker } from './WebhookDeliveryWorker';

// Import OPTIONAL_RUNTIME workers (configurable)
import { ConnectionHealthCheckWorker } from './ConnectionHealthCheckWorker';
import { AccountHealthCheckWorker } from './AccountHealthCheckWorker';
import { BackupVerificationWorker } from './BackupVerificationWorker';
import { ReportSchedulerWorker } from './ReportSchedulerWorker';

// Import LEGACY workers (never enabled, but imported for reference)
import { PublishingWorker } from './PublishingWorker';
import { PostPublishingWorker } from './PostPublishingWorker';

/**
 * Initialize and register all workers with WorkerManager
 */
export function initializeWorkers(): WorkerManager {
  const manager = WorkerManager.getInstance();

  logger.info('Initializing workers', {
    configSummary: getConfigSummary(),
  });

  // ============================================================================
  // CORE_RUNTIME WORKERS - Essential for SaaS operation
  // ============================================================================

  manager.registerWorker(
    'scheduler-worker',
    new WorkerAdapter(new SchedulerWorker(), 'scheduler-worker'),
    workerConfigs['scheduler-worker']
  );

  manager.registerWorker(
    'facebook-publisher-worker',
    new WorkerAdapter(new FacebookPublisherWorker(), 'facebook-publisher-worker'),
    workerConfigs['facebook-publisher-worker']
  );

  manager.registerWorker(
    'instagram-publisher-worker',
    new WorkerAdapter(new InstagramPublisherWorker(), 'instagram-publisher-worker'),
    workerConfigs['instagram-publisher-worker']
  );

  manager.registerWorker(
    'twitter-publisher-worker',
    new WorkerAdapter(new TwitterPublisherWorker(), 'twitter-publisher-worker'),
    workerConfigs['twitter-publisher-worker']
  );

  manager.registerWorker(
    'linkedin-publisher-worker',
    new WorkerAdapter(new LinkedInPublisherWorker(), 'linkedin-publisher-worker'),
    workerConfigs['linkedin-publisher-worker']
  );

  manager.registerWorker(
    'tiktok-publisher-worker',
    new WorkerAdapter(new TikTokPublisherWorker(), 'tiktok-publisher-worker'),
    workerConfigs['tiktok-publisher-worker']
  );

  // TODO: Add Google Business Publisher Worker when module import is fixed
  // manager.registerWorker(
  //   'google-business-publisher-worker',
  //   new WorkerAdapter(new GoogleBusinessPublisherWorker(), 'google-business-publisher-worker'),
  //   workerConfigs['google-business-publisher-worker'] || { enabled: true, maxRestarts: 3, restartDelay: 5000 }
  // );

  manager.registerWorker(
    'token-refresh-worker',
    new WorkerAdapter(new TokenRefreshWorker(), 'token-refresh-worker'),
    workerConfigs['token-refresh-worker']
  );

  manager.registerWorker(
    'distributed-token-refresh-worker',
    new WorkerAdapter(new DistributedTokenRefreshWorker(), 'distributed-token-refresh-worker'),
    workerConfigs['distributed-token-refresh-worker']
  );

  // ============================================================================
  // FEATURE_RUNTIME WORKERS - Required for specific features
  // ============================================================================

  manager.registerWorker(
    'media-processing-worker',
    new WorkerAdapter(new MediaProcessingWorker(), 'media-processing-worker'),
    workerConfigs['media-processing-worker']
  );

  manager.registerWorker(
    'email-worker',
    new WorkerAdapter(new EmailWorker(), 'email-worker'),
    workerConfigs['email-worker']
  );

  manager.registerWorker(
    'notification-worker',
    new WorkerAdapter(new NotificationWorker(), 'notification-worker'),
    workerConfigs['notification-worker']
  );

  manager.registerWorker(
    'analytics-collector-worker',
    new WorkerAdapter(new AnalyticsCollectorWorker(), 'analytics-collector-worker'),
    workerConfigs['analytics-collector-worker']
  );

  manager.registerWorker(
    'webhook-delivery-worker',
    new WorkerAdapter(new WebhookDeliveryWorker(), 'webhook-delivery-worker'),
    workerConfigs['webhook-delivery-worker'] || { enabled: true, maxRestarts: 3, restartDelay: 5000 }
  );

  // ============================================================================
  // OPTIONAL_RUNTIME WORKERS - Nice-to-have operational features
  // ============================================================================

  manager.registerWorker(
    'connection-health-check-worker',
    new WorkerAdapter(new ConnectionHealthCheckWorker(), 'connection-health-check-worker'),
    workerConfigs['connection-health-check-worker']
  );

  manager.registerWorker(
    'account-health-check-worker',
    new WorkerAdapter(new AccountHealthCheckWorker(), 'account-health-check-worker'),
    workerConfigs['account-health-check-worker']
  );

  manager.registerWorker(
    'backup-verification-worker',
    new WorkerAdapter(
      new BackupVerificationWorker({
        enabled: workerConfigs['backup-verification-worker'].enabled,
        backupPath: config.backup.path,
        mongoUri: config.database.uri,
        intervalHours: config.backup.verifyIntervalHours,
        timeoutMs: config.backup.verifyTimeoutMs,
        tempDbPrefix: 'backup_verify_',
        maxBackupAgeHours: config.backup.maxAgeHours,
      }),
      'backup-verification-worker'
    ),
    workerConfigs['backup-verification-worker']
  );

  manager.registerWorker(
    'report-scheduler-worker',
    new WorkerAdapter(new ReportSchedulerWorker(), 'report-scheduler-worker'),
    { enabled: true, maxRestarts: 3, restartDelay: 5000 }
  );

  // ============================================================================
  // LEGACY WORKERS - Deprecated (registered but never enabled)
  // ============================================================================

  manager.registerWorker(
    'publishing-worker',
    new WorkerAdapter(new PublishingWorker(), 'publishing-worker'),
    workerConfigs['publishing-worker']
  );

  manager.registerWorker(
    'post-publishing-worker',
    new WorkerAdapter(new PostPublishingWorker(), 'post-publishing-worker'),
    workerConfigs['post-publishing-worker']
  );

  logger.info('Worker registration complete', {
    totalWorkers: manager.getStatus().length,
    enabledWorkers: manager.getStatus().filter(w => w.isEnabled).length,
  });

  return manager;
}

/**
 * Start all workers
 */
export async function startWorkers(): Promise<WorkerManager> {
  const manager = initializeWorkers();
  
  // Register signal handlers for graceful shutdown
  manager.registerSignalHandlers();
  
  // Start all enabled workers
  await manager.startAll();
  
  // Print status for debugging
  manager.printStatus();
  
  return manager;
}

/**
 * Stop all workers
 */
export async function stopWorkers(): Promise<void> {
  const manager = WorkerManager.getInstance();
  await manager.stopAll();
}

/**
 * Export worker manager instance getter
 */
export function getWorkerManager(): WorkerManager {
  return WorkerManager.getInstance();
}
