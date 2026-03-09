import dotenv from 'dotenv';
import { Server } from 'http';

// Load environment variables FIRST
dotenv.config();

console.log('🔧 server.ts: Loading modules...');

// Initialize Sentry BEFORE importing app
import { initializeSentry } from './monitoring/sentry';
initializeSentry();

import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis, getRecoveryService } from './config/redis';
import { schedulerService } from './services/SchedulerService';
import { oauthManager } from './services/oauth/OAuthManager'; // Initialize OAuth providers

console.log('✅ server.ts: Modules loaded');

const PORT = config.port;

// Track server instance and workers for graceful shutdown
let serverInstance: Server | null = null;
let workerInstance: any = null;
let tokenRefreshWorkerInstance: any = null;
let systemMonitorInstance: any = null;
let backupVerificationWorkerInstance: any = null;
let metricsControllerInstance: any = null;
let isShuttingDown = false;

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress');
    return;
  }
  
  isShuttingDown = true;
  
  // Notify recovery service of shutdown
  const recoveryService = getRecoveryService();
  if (recoveryService) {
    recoveryService.setShuttingDown(true);
  }
  
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  // Set shutdown timeout (30 seconds)
  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout - forcing exit');
    process.exit(1);
  }, 30000);
  
  try {
    // 1. Stop accepting new requests
    if (serverInstance) {
      logger.info('Closing Express server...');
      await new Promise<void>((resolve, reject) => {
        serverInstance!.close((err) => {
          if (err) {
            logger.error('Error closing Express server:', err);
            reject(err);
          } else {
            logger.info('✅ Express server closed');
            resolve();
          }
        });
      });
    }
    
    // 2. Stop scheduler (prevents new jobs from being queued)
    logger.info('Stopping scheduler service...');
    schedulerService.stop();
    logger.info('✅ Scheduler service stopped');
    
    // 3. Stop worker (gracefully finish active jobs)
    if (workerInstance) {
      logger.info('Stopping publishing worker...');
      await workerInstance.stop();
      logger.info('✅ Publishing worker stopped');
    }
    
    // 3b. Stop token refresh worker
    if (tokenRefreshWorkerInstance) {
      logger.info('Stopping token refresh worker...');
      await tokenRefreshWorkerInstance.stop();
      logger.info('✅ Token refresh worker stopped');
      
      // Stop scheduler
      try {
        const { tokenRefreshScheduler } = await import('./workers/TokenRefreshScheduler');
        tokenRefreshScheduler.stop();
        logger.info('✅ Token refresh scheduler stopped');
      } catch (error) {
        logger.debug('Token refresh scheduler not initialized');
      }
    }
    
    // 3c. Stop system monitor
    if (systemMonitorInstance) {
      logger.info('Stopping system monitor...');
      systemMonitorInstance.stop();
      logger.info('✅ System monitor stopped');
    }
    
    // 3d. Stop backup verification worker
    if (backupVerificationWorkerInstance) {
      logger.info('Stopping backup verification worker...');
      backupVerificationWorkerInstance.stop();
      logger.info('✅ Backup verification worker stopped');
    }
    
    // 4. Close queue connections
    try {
      const { QueueManager } = await import('./queue/QueueManager');
      const queueManager = QueueManager.getInstance();
      
      if (!queueManager.isShutdown()) {
        logger.info('Closing queue connections...');
        await queueManager.closeAll();
        logger.info('✅ Queue connections closed');
      }
    } catch (error: any) {
      // QueueManager might not be initialized if Redis wasn't connected
      logger.debug('QueueManager not initialized or already closed');
    }
    
    // 5. Flush Sentry events before shutdown
    logger.info('Flushing Sentry events...');
    const { flushSentry } = await import('./monitoring/sentry');
    await flushSentry();
    logger.info('✅ Sentry events flushed');
    
    // 6. Disconnect Redis
    logger.info('Disconnecting Redis...');
    await disconnectRedis();
    logger.info('✅ Redis disconnected');
    
    // 7. Disconnect MongoDB (last, as other services may need it)
    logger.info('Disconnecting MongoDB...');
    await disconnectDatabase();
    logger.info('✅ MongoDB disconnected');
    
    clearTimeout(shutdownTimeout);
    logger.info('✅ Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  console.log('🚀 INSIDE startServer() - START');
  try {
    console.log('🚀 Starting server...');
    logger.info('🚀 Starting server...');
    
    // Connect to databases
    console.log('📦 Connecting to MongoDB...');
    logger.info('📦 Connecting to MongoDB...');
    await connectDatabase();
    console.log('✅ MongoDB connected');
    logger.info('✅ MongoDB connected');
    
    // Connect to Redis (SINGLE CONNECTION POINT)
    let redisConnected = false;
    
    try {
      console.log('📦 Connecting to Redis...');
      logger.info('📦 Connecting to Redis...');
      await connectRedis();
      redisConnected = true;
      console.log('✅ Redis connected successfully');
      logger.info('✅ Redis connected successfully');
    } catch (error) {
      console.log('❌ Redis connection failed:', error);
      logger.error('❌ Redis connection failed:', error);
      logger.warn('Continuing without Redis (rate limiting will use memory store)');
    }

    
    console.log('🔧 Initializing services...');
    logger.info('🔧 Initializing services...');

    // Initialize OAuth Manager (loads all OAuth providers)
    console.log('🔧 Initializing OAuth Manager...');
    logger.info('🔧 Initializing OAuth Manager...');
    const availablePlatforms = oauthManager.getAvailablePlatforms();
    console.log('✅ OAuth Manager initialized with platforms:', availablePlatforms);
    logger.info('✅ OAuth Manager initialized', { platforms: availablePlatforms });

    console.log('🔧 Checking scheduler service (redisConnected:', redisConnected, ')');
    // Start scheduler service - ALWAYS when Redis is connected
    if (redisConnected) {
      try {
        await schedulerService.start();
        console.log('📅 Scheduler Service STARTED');
        logger.info('📅 Scheduler service started');
      } catch (error) {
        console.log('❌ Scheduler failed to start:', error);
        logger.error('❌ Scheduler service failed to start:', error);
        throw error; // Fail fast if scheduler can't start
      }
    } else {
      console.log('⏸️  Scheduler Service DISABLED (Redis not connected)');
      logger.warn('⏸️  Scheduler Service DISABLED (Redis not connected)');
    }

    console.log('🔧 Initializing backup scheduler...');
    // Start backup scheduler - independent of Redis
    try {
      const { getBackupScheduler } = await import('./services/backup/BackupScheduler');
      const backupScheduler = getBackupScheduler();
      backupScheduler.start();
      console.log('💾 Backup Scheduler STARTED');
      logger.info('💾 Backup scheduler started');
    } catch (error) {
      console.log('⚠️  Backup scheduler failed to start (non-critical):', error);
      logger.warn('⚠️  Backup scheduler failed to start (non-critical):', error);
      // Don't throw - backup is non-critical for app startup
    }

    console.log('🔧 Checking publishing worker...');
    // Start worker - ALWAYS when Redis is connected
    if (redisConnected) {
      try {
        const { PublishingWorker } = await import('./workers/PublishingWorker');
        workerInstance = new PublishingWorker();
        await workerInstance.start();
        console.log('👷 Publishing worker started');
        logger.info('👷 Publishing worker started');
      } catch (error) {
        console.log('❌ Publishing worker failed to start:', error);
        logger.error('❌ Publishing worker failed to start:', error);
        throw error; // Fail fast if worker can't start
      }
    } else {
      console.log('⏸️  Publishing worker DISABLED (Redis not connected)');
      logger.warn('⏸️  Publishing worker DISABLED (Redis not connected)');
    }

    console.log('🔧 Checking Phase 4 publishing system...');
    // PHASE 4: Start post publishing system with platform-specific queues and workers
    if (redisConnected) {
      try {
        // Initialize publishing router
        const { PublishingRouter } = await import('./services/PublishingRouter');
        const publishingRouter = new PublishingRouter();
        
        logger.info('✅ Publishing router initialized', {
          platforms: ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'],
        });
        
        // Start post scheduler service
        const { PostSchedulerService } = await import('./services/PostSchedulerService');
        const postSchedulerService = new PostSchedulerService(publishingRouter);
        postSchedulerService.start();
        
        logger.info('📅 Post scheduler service started');
        
        // Start platform-specific workers
        const { FacebookPublisherWorker } = await import('./workers/FacebookPublisherWorker');
        const { InstagramPublisherWorker } = await import('./workers/InstagramPublisherWorker');
        const { TwitterPublisherWorker } = await import('./workers/TwitterPublisherWorker');
        const { LinkedInPublisherWorker } = await import('./workers/LinkedInPublisherWorker');
        const { TikTokPublisherWorker } = await import('./workers/TikTokPublisherWorker');
        
        const facebookWorker = new FacebookPublisherWorker();
        const instagramWorker = new InstagramPublisherWorker();
        const twitterWorker = new TwitterPublisherWorker();
        const linkedinWorker = new LinkedInPublisherWorker();
        const tiktokWorker = new TikTokPublisherWorker();
        
        facebookWorker.start();
        instagramWorker.start();
        twitterWorker.start();
        linkedinWorker.start();
        tiktokWorker.start();
        
        logger.info('👷 Platform-specific workers started', {
          workers: ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'],
        });
        
        console.log('✅ Phase 4 publishing system started (platform-specific architecture)');
      } catch (error) {
        console.log('❌ Phase 4 publishing system failed to start:', error);
        logger.error('❌ Phase 4 publishing system failed to start:', error);
        logger.warn('Continuing without Phase 4 publishing system');
      }
    } else {
      console.log('⏸️  Phase 4 publishing system DISABLED (Redis not connected)');
      logger.warn('⏸️  Phase 4 publishing system DISABLED (Redis not connected)');
    }

    console.log('🔧 Checking Phase 5 media processing system...');
    // PHASE 5: Start media processing system
    if (redisConnected) {
      try {
        const { MediaProcessingWorker } = await import('./workers/MediaProcessingWorker');
        const mediaProcessingWorker = new MediaProcessingWorker();
        mediaProcessingWorker.start();
        
        logger.info('🎬 Media processing worker started');
        console.log('✅ Phase 5 media processing system started');
      } catch (error) {
        console.log('❌ Phase 5 media processing system failed to start:', error);
        logger.error('❌ Phase 5 media processing system failed to start:', error);
        logger.warn('Continuing without Phase 5 media processing system');
      }
    } else {
      console.log('⏸️  Phase 5 media processing system DISABLED (Redis not connected)');
      logger.warn('⏸️  Phase 5 media processing system DISABLED (Redis not connected)');
    }

    console.log('🔧 Checking Phase 6 connection health monitoring system...');
    // PHASE 6: Start connection health monitoring system
    if (redisConnected) {
      try {
        const { connectionHealthCheckWorker } = await import('./workers/ConnectionHealthCheckWorker');
        connectionHealthCheckWorker.start();
        
        logger.info('🏥 Connection health check worker started');
        console.log('✅ Phase 6 connection health monitoring system started');
      } catch (error) {
        console.log('❌ Phase 6 connection health monitoring system failed to start:', error);
        logger.error('❌ Phase 6 connection health monitoring system failed to start:', error);
        logger.warn('Continuing without Phase 6 connection health monitoring system');
      }
    } else {
      console.log('⏸️  Phase 6 connection health monitoring system DISABLED (Redis not connected)');
      logger.warn('⏸️  Phase 6 connection health monitoring system DISABLED (Redis not connected)');
    }

    console.log('🔧 Checking Phase 7 analytics collection system...');
    // PHASE 7: Start analytics collection system
    if (redisConnected) {
      try {
        const { analyticsCollectorWorker } = await import('./workers/AnalyticsCollectorWorker');
        const { analyticsSchedulerService } = await import('./services/AnalyticsSchedulerService');
        
        // FIX 2: Register analytics worker with WorkerManager for crash recovery and health monitoring
        try {
          const { WorkerManager } = await import('./services/WorkerManager');
          const workerManager = WorkerManager.getInstance();
          
          workerManager.registerWorker('analytics-collector', analyticsCollectorWorker, {
            enabled: true,
            maxRestarts: 5,
            restartDelay: 5000,
          });
          
          logger.info('📊 Analytics collector worker registered with WorkerManager');
        } catch (wmError: any) {
          logger.warn('Failed to register analytics worker with WorkerManager', {
            error: wmError.message,
          });
          // Fallback to direct start if WorkerManager registration fails
          analyticsCollectorWorker.start();
          logger.info('📊 Analytics collector worker started (direct)');
        }
        
        // Start analytics scheduler
        analyticsSchedulerService.start();
        logger.info('📅 Analytics scheduler started');
        
        console.log('✅ Phase 7 analytics collection system started');
      } catch (error) {
        console.log('❌ Phase 7 analytics collection system failed to start:', error);
        logger.error('❌ Phase 7 analytics collection system failed to start:', error);
        logger.warn('Continuing without Phase 7 analytics collection system');
      }
    } else {
      console.log('⏸️  Phase 7 analytics collection system DISABLED (Redis not connected)');
      logger.warn('⏸️  Phase 7 analytics collection system DISABLED (Redis not connected)');
    }

    console.log('🔧 Checking token refresh worker...');
    // Start token refresh worker if Redis is connected
    if (redisConnected) {
      try {
        const { distributedTokenRefreshWorker } = await import('./workers/DistributedTokenRefreshWorker');
        const { tokenRefreshScheduler } = await import('./workers/TokenRefreshScheduler');
        
        // Start worker
        distributedTokenRefreshWorker.start();
        tokenRefreshWorkerInstance = distributedTokenRefreshWorker;
        logger.info('🔄 Distributed token refresh worker started');
        
        // Start scheduler
        tokenRefreshScheduler.start();
        logger.info('📅 Token refresh scheduler started');
      } catch (error) {
        logger.error('❌ Token refresh system failed to start:', error);
        logger.warn('Continuing without token refresh');
      }
    }

    console.log('🔧 Checking missed post recovery service...');
    // TASK 1.2.3: Start missed post recovery service if Redis is connected
    if (redisConnected) {
      try {
        const { missedPostRecoveryService } = await import('./services/MissedPostRecoveryService');
        missedPostRecoveryService.start();
        console.log('🔄 Missed Post Recovery Service STARTED');
        logger.info('🔄 Missed post recovery service started');
      } catch (error) {
        console.log('❌ Missed post recovery service failed to start:', error);
        logger.error('❌ Missed post recovery service failed to start:', error);
        logger.warn('Continuing without missed post recovery');
      }
    } else {
      console.log('⏸️  Missed Post Recovery Service DISABLED (Redis not connected)');
      logger.warn('⏸️  Missed Post Recovery Service DISABLED (Redis not connected)');
    }


    console.log('🔧 Checking system monitor...');
    // Start system monitor if Redis is connected and alerting is enabled
    if (redisConnected && config.alerting.enabled) {
      try {
        const { AlertingService } = await import('./services/alerting/AlertingService');
        const { ConsoleAlertAdapter } = await import('./services/alerting/ConsoleAlertAdapter');
        const { WebhookAlertAdapter } = await import('./services/alerting/WebhookAlertAdapter');
        const { SystemMonitor } = await import('./services/alerting/SystemMonitor');
        
        // Create alert adapters
        const adapters: any[] = [new ConsoleAlertAdapter()];
        
        // Add webhook adapter if URL is configured
        if (config.alerting.webhookUrl) {
          adapters.push(new WebhookAlertAdapter({
            url: config.alerting.webhookUrl,
            format: config.alerting.webhookFormat,
          }));
        }
        
        // Create alerting service
        const alertingService = new AlertingService({
          enabled: config.alerting.enabled,
          cooldownMinutes: config.alerting.cooldownMinutes,
          adapters,
        });
        
        // Create and start system monitor
        systemMonitorInstance = new SystemMonitor(alertingService, {
          enabled: config.alerting.enabled,
          pollInterval: config.alerting.pollInterval,
          memoryThresholdPercent: config.alerting.memoryThreshold,
          queueFailureRateThreshold: config.alerting.queueFailureRateThreshold,
          deadLetterQueueThreshold: config.alerting.dlqThreshold,
        });
        
        systemMonitorInstance.start();
        logger.info('🔔 System monitor started');
      } catch (error) {
        logger.warn('System monitor failed to start - continuing without alerting');
      }
    } else if (!redisConnected) {
      logger.warn('⏸️  System monitor disabled (Redis not available)');
    } else {
      logger.info('⏸️  System monitor disabled (alerting not enabled)');
    }

    console.log('🔧 Checking backup verification worker...');
    console.log('🔧 config.backup.verifyEnabled:', config.backup.verifyEnabled);
    // Start backup verification worker if enabled
    if (config.backup.verifyEnabled) {
      console.log('🔧 INSIDE backup verification worker initialization');
      try {
        const { BackupVerificationWorker } = await import('./workers/BackupVerificationWorker');
        const { AlertingService } = await import('./services/alerting/AlertingService');
        const { ConsoleAlertAdapter } = await import('./services/alerting/ConsoleAlertAdapter');
        const { WebhookAlertAdapter } = await import('./services/alerting/WebhookAlertAdapter');
        
        // Create alerting service for backup verification (if alerting enabled)
        let alertingService = null;
        if (config.alerting.enabled && redisConnected) {
          const adapters: any[] = [new ConsoleAlertAdapter()];
          
          if (config.alerting.webhookUrl) {
            adapters.push(new WebhookAlertAdapter({
              url: config.alerting.webhookUrl,
              format: config.alerting.webhookFormat,
            }));
          }
          
          alertingService = new AlertingService({
            enabled: config.alerting.enabled,
            cooldownMinutes: config.alerting.cooldownMinutes,
            adapters,
          });
        }
        
        // Create and start backup verification worker
        backupVerificationWorkerInstance = new BackupVerificationWorker(
          {
            enabled: config.backup.verifyEnabled,
            backupPath: config.backup.path,
            mongoUri: config.database.uri,
            intervalHours: config.backup.verifyIntervalHours,
            timeoutMs: config.backup.verifyTimeoutMs,
            tempDbPrefix: config.backup.tempDbPrefix,
            maxBackupAgeHours: config.backup.maxAgeHours,
          },
          alertingService
        );
        
        backupVerificationWorkerInstance.start();
        logger.info('💾 Backup verification worker started');
      } catch (error) {
        logger.warn('Backup verification worker failed to start - continuing without backup verification');
      }
    } else {
      console.log('🔧 Backup verification worker disabled');
      logger.info('⏸️  Backup verification worker disabled');
    }

    console.log('🔧 Setting up metrics endpoint...');
    // Setup metrics endpoint
    try {
      console.log('🔧 Importing metrics modules...');
      const { MetricsCollector } = await import('./services/metrics/MetricsCollector');
      console.log('🔧 MetricsCollector imported');
      const { MetricsService } = await import('./services/metrics/MetricsService');
      console.log('🔧 MetricsService imported');
      const { MetricsController } = await import('./controllers/MetricsController');
      console.log('🔧 MetricsController imported');
      const { authMetricsTracker } = await import('./services/metrics/AuthMetricsTracker');
      console.log('🔧 AuthMetricsTracker imported');
      const { httpMetricsTracker } = await import('./middleware/httpMetrics');
      console.log('🔧 HttpMetricsTracker imported');
      const { publicApiMetricsTracker } = await import('./middleware/publicApiMetrics');
      console.log('🔧 PublicApiMetricsTracker imported');
      
      let queueManager = null;
      if (redisConnected) {
        console.log('🔧 Importing QueueManager...');
        const { QueueManager } = await import('./queue/QueueManager');
        console.log('🔧 QueueManager imported');
        queueManager = QueueManager.getInstance();
        console.log('🔧 QueueManager instance obtained');
      }
      
      console.log('🔧 Creating metrics collector...');
      // Create metrics collector with all available workers/services
      const collector = new MetricsCollector({
        publishingWorker: workerInstance,
        tokenRefreshWorker: tokenRefreshWorkerInstance,
        backupVerificationWorker: backupVerificationWorkerInstance,
        schedulerService: schedulerService,
        queueManager: queueManager,
        systemMonitor: systemMonitorInstance,
        authService: authMetricsTracker,
        httpMetrics: httpMetricsTracker,
        publicApiMetrics: publicApiMetricsTracker,
      });
      
      console.log('🔧 Creating metrics service...');
      // Create metrics service
      const metricsService = new MetricsService(collector);
      
      console.log('🔧 Creating metrics controller...');
      // Create metrics controller
      metricsControllerInstance = new MetricsController(metricsService);
      
      console.log('🔧 Adding /metrics endpoint...');
      // Set /metrics endpoint handler in app
      const { setMetricsHandler } = await import('./app');
      setMetricsHandler((req, res) => metricsControllerInstance.getMetrics(req, res));
      
      console.log('📊 Metrics endpoint enabled');
      logger.info('📊 Metrics endpoint enabled at /metrics');
    } catch (error) {
      console.log('⚠️  Metrics endpoint failed:', error);
      logger.warn('Metrics endpoint failed to initialize - continuing without metrics');
    }

    console.log('🔧 Checking Redis recovery service registration...');
    // Register services with Redis recovery service
    if (redisConnected) {
      console.log('🔧 INSIDE Redis recovery service registration');
      try {
        const recoveryService = getRecoveryService();
        if (recoveryService) {
          // Register scheduler service
          recoveryService.registerService({
            name: 'scheduler',
            isRunning: () => schedulerService.getStatus().isRunning,
            start: () => schedulerService.start(),
            stop: () => schedulerService.stop(),
            requiresRedis: true,
          });

          // Register publishing worker (if exists)
          if (workerInstance) {
            recoveryService.registerService({
              name: 'publishing-worker',
              isRunning: () => workerInstance.getStatus().isRunning,
              start: () => workerInstance.start(),
              stop: async () => await workerInstance.stop(),
              requiresRedis: true,
            });
          }

          // Register token refresh worker (if exists)
          if (tokenRefreshWorkerInstance) {
            recoveryService.registerService({
              name: 'token-refresh-worker',
              isRunning: () => tokenRefreshWorkerInstance.getStatus().isRunning,
              start: () => tokenRefreshWorkerInstance.start(),
              stop: async () => await tokenRefreshWorkerInstance.stop(),
              requiresRedis: true,
            });
            
            // Register token refresh scheduler
            try {
              const { tokenRefreshScheduler } = await import('./workers/TokenRefreshScheduler');
              recoveryService.registerService({
                name: 'token-refresh-scheduler',
                isRunning: () => tokenRefreshScheduler.getStatus().isRunning,
                start: () => tokenRefreshScheduler.start(),
                stop: () => tokenRefreshScheduler.stop(),
                requiresRedis: true,
              });
            } catch (error) {
              logger.debug('Token refresh scheduler not available for registration');
            }
          }

          // Register system monitor (if exists)
          if (systemMonitorInstance) {
            recoveryService.registerService({
              name: 'system-monitor',
              isRunning: () => systemMonitorInstance.getStatus().isRunning,
              start: () => systemMonitorInstance.start(),
              stop: () => systemMonitorInstance.stop(),
              requiresRedis: true,
            });
          }

          // Register WorkerManager for automatic worker restart
          try {
            const { WorkerManager } = await import('./services/WorkerManager');
            const workerManager = WorkerManager.getInstance();
            
            recoveryService.registerService({
              name: 'worker-manager',
              isRunning: () => workerManager.isRunning(),
              start: async () => {
                logger.info('WorkerManager restarting after Redis reconnect');
                await workerManager.startAll();
              },
              stop: async () => {
                logger.info('WorkerManager stopping due to Redis disconnect');
                await workerManager.stopAll();
              },
              requiresRedis: true,
            });
            
            logger.info('✅ WorkerManager registered with Redis recovery service');
          } catch (error: any) {
            logger.warn('Failed to register WorkerManager with recovery service', {
              error: error.message,
            });
          }

          // Register QueueMonitoringService for automatic monitoring restart
          try {
            const { queueMonitoringService } = await import('./services/QueueMonitoringService');
            
            recoveryService.registerService({
              name: 'queue-monitoring',
              isRunning: () => queueMonitoringService.isRunning(),
              start: () => {
                logger.info('QueueMonitoringService restarting after Redis reconnect');
                queueMonitoringService.startMonitoring();
              },
              stop: () => {
                logger.info('QueueMonitoringService stopping due to Redis disconnect');
                queueMonitoringService.stopMonitoring();
              },
              requiresRedis: true,
            });
            
            logger.info('✅ QueueMonitoringService registered with Redis recovery service');
          } catch (error: any) {
            logger.warn('Failed to register QueueMonitoringService with recovery service', {
              error: error.message,
            });
          }

          // FIX 3: Register AnalyticsCollectorWorker for automatic restart on Redis reconnect
          try {
            const { analyticsCollectorWorker } = await import('./workers/AnalyticsCollectorWorker');
            
            recoveryService.registerService({
              name: 'analytics-collector',
              isRunning: () => analyticsCollectorWorker.getStatus().isRunning,
              start: () => {
                logger.info('AnalyticsCollectorWorker restarting after Redis reconnect');
                analyticsCollectorWorker.start();
              },
              stop: async () => {
                logger.info('AnalyticsCollectorWorker stopping due to Redis disconnect');
                await analyticsCollectorWorker.stop();
              },
              requiresRedis: true,
            });
            
            logger.info('✅ AnalyticsCollectorWorker registered with Redis recovery service');
          } catch (error: any) {
            logger.warn('Failed to register AnalyticsCollectorWorker with recovery service', {
              error: error.message,
            });
          }

          logger.info('✅ Services registered with Redis recovery service', {
            servicesRegistered: [
              'scheduler',
              workerInstance ? 'publishing-worker' : null,
              tokenRefreshWorkerInstance ? 'token-refresh-worker' : null,
              systemMonitorInstance ? 'system-monitor' : null,
              'worker-manager',
              'queue-monitoring',
              'analytics-collector',
            ].filter(Boolean),
          });
        }
      } catch (error) {
        logger.warn('Failed to register services with recovery service - continuing without auto-recovery', {
          error: error.message,
        });
      }
    } else {
      console.log('🔧 Redis recovery service registration skipped (Redis not connected)');
    }

    console.log('🚀 Starting Express server on port', PORT);
    // Start Express server
    serverInstance = app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📍 Environment: ${config.env}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
      logger.info(`📊 Metrics: http://localhost:${PORT}/metrics`);
      logger.info(`📚 API v1: http://localhost:${PORT}/api/v1`);
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return serverInstance;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
console.log('🚀 server.ts: Calling startServer()...');
startServer();

export default app;
