import { MongoClient, Db, ObjectId } from 'mongodb';
import { logger, logEvent } from './utils/logger';
import { config, validateConfig } from './config';
import { PromisePool, RateLimiter } from './utils/promisePool';
import { getRedisClient } from './utils/redisClient';
import { chaosInjector } from './chaosModules';
import { duplicateDetector } from './duplicateDetector';
import { refreshStormValidator } from './refreshStormValidator';
import { rateLimitValidator } from './rateLimitValidator';
import { ReportGenerator } from './reportGenerator';

/**
 * Load Simulation Script
 * 
 * Generates load and chaos to validate system reliability:
 * 1. Create workspaces and accounts
 * 2. Schedule posts
 * 3. Inject chaos (failures, crashes, rate limits)
 * 4. Monitor for violations
 * 5. Generate report
 */

export class LoadSimulator {
  private db: Db | null = null;
  private workspaceIds: ObjectId[] = [];
  private accountIds: ObjectId[] = [];
  private postIds: ObjectId[] = [];
  private startTime: number = 0;
  private endTime: number = 0;

  /**
   * Run simulation
   */
  async run(): Promise<void> {
    try {
      logger.info('Starting chaos load simulation', { config });

      // Validate configuration
      validateConfig(config);

      // Connect to databases
      await this.connect();

      // Start chaos injection
      if (config.chaosEnabled) {
        await chaosInjector.start();
      }

      // Record start time
      this.startTime = Date.now();

      // Phase 1: Setup
      await this.setupPhase();

      // Phase 2: Load generation
      await this.loadGenerationPhase();

      // Phase 3: Chaos injection
      if (config.chaosEnabled) {
        await this.chaosPhase();
      }

      // Phase 4: Monitoring
      await this.monitoringPhase();

      // Record end time
      this.endTime = Date.now();

      // Phase 5: Validation
      await this.validationPhase();

      // Phase 6: Report generation
      await this.reportPhase();

      logger.info('Chaos load simulation completed successfully');
    } catch (error: any) {
      logger.error('Chaos load simulation failed', { error: error.message, stack: error.stack });
      throw error;
    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  /**
   * Connect to databases
   */
  private async connect(): Promise<void> {
    logger.info('Connecting to databases');

    // MongoDB
    const client = await MongoClient.connect(config.mongodbUri);
    this.db = client.db();
    logger.info('Connected to MongoDB');

    // Redis
    await getRedisClient();
    logger.info('Connected to Redis');

    // Connect validators
    await duplicateDetector.connect();
    logger.info('Duplicate detector connected');
  }

  /**
   * Phase 1: Setup
   */
  private async setupPhase(): Promise<void> {
    logger.info('Phase 1: Setup - Creating workspaces and accounts');

    const workspacesPerBatch = 100;
    const accountsPerWorkspace = Math.ceil(config.accounts / (config.accounts / 10));

    // Create workspaces
    const workspacePool = new PromisePool(10);
    const workspaceTasks = [];

    for (let i = 0; i < config.accounts / accountsPerWorkspace; i++) {
      workspaceTasks.push(() => this.createWorkspace(i));
    }

    this.workspaceIds = await workspacePool.executeBatches(
      workspaceTasks,
      workspacesPerBatch,
      100
    );

    logger.info('Workspaces created', { count: this.workspaceIds.length });

    // Create accounts
    const accountPool = new PromisePool(20);
    const accountTasks = [];

    for (const workspaceId of this.workspaceIds) {
      for (let i = 0; i < accountsPerWorkspace; i++) {
        accountTasks.push(() => this.createAccount(workspaceId, i));
      }
    }

    this.accountIds = await accountPool.executeBatches(
      accountTasks,
      100,
      50
    );

    logger.info('Accounts created', { count: this.accountIds.length });

    logEvent('setup_complete', {
      workspaces: this.workspaceIds.length,
      accounts: this.accountIds.length,
    });
  }

  /**
   * Phase 2: Load generation
   */
  private async loadGenerationPhase(): Promise<void> {
    logger.info('Phase 2: Load Generation - Scheduling posts');

    const postPool = new PromisePool(50);
    const rateLimiter = new RateLimiter(config.publishRate, config.publishRate);
    const postTasks = [];

    // Schedule posts randomly across next 10 minutes
    const now = Date.now();
    const scheduleWindow = 10 * 60 * 1000; // 10 minutes

    for (let i = 0; i < config.posts; i++) {
      const accountId = this.accountIds[Math.floor(Math.random() * this.accountIds.length)];
      const scheduledAt = new Date(now + Math.random() * scheduleWindow);

      postTasks.push(async () => {
        await rateLimiter.acquire();
        return this.createPost(accountId, scheduledAt, i);
      });
    }

    this.postIds = await postPool.execute(postTasks);

    logger.info('Posts scheduled', { count: this.postIds.length });

    logEvent('load_generation_complete', {
      posts: this.postIds.length,
    });
  }

  /**
   * Phase 3: Chaos injection
   */
  private async chaosPhase(): Promise<void> {
    logger.info('Phase 3: Chaos Injection - Injecting failures');

    // Randomly trigger token expiry burst
    if (config.refreshExpiryBurst > 0) {
      await this.triggerTokenExpiryBurst();
    }

    // Simulate rate limit period (30 seconds)
    await rateLimitValidator.simulateRateLimitPeriod(30);

    logEvent('chaos_injection_complete');
  }

  /**
   * Phase 4: Monitoring
   */
  private async monitoringPhase(): Promise<void> {
    logger.info('Phase 4: Monitoring - Waiting for completion');

    const durationMs = config.durationMinutes * 60 * 1000;
    const checkInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < durationMs) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));

      // Check progress
      const stats = await this.getProgress();
      logger.info('Progress update', stats);

      // Check for violations
      await this.checkViolations();
    }

    logger.info('Monitoring phase complete');
  }

  /**
   * Phase 5: Validation
   */
  private async validationPhase(): Promise<void> {
    logger.info('Phase 5: Validation - Checking for violations');

    // Check for duplicates in database
    const dbDuplicates = await duplicateDetector.checkDatabaseDuplicates();

    // Get final statistics
    const duplicateStats = await duplicateDetector.getStatistics();
    const refreshStats = refreshStormValidator.getStatistics();
    const rateLimitStats = await rateLimitValidator.getStatistics();

    logger.info('Validation complete', {
      duplicates: duplicateStats,
      refreshStorm: refreshStats,
      rateLimit: rateLimitStats,
    });

    // Check for failures
    const failures = [];

    if (duplicateStats.duplicatesDetected > 0) {
      failures.push(`Duplicate publishes detected: ${duplicateStats.duplicatesDetected}`);
    }

    if (refreshStats.peakRefreshRate > config.maxRefreshPerSecond) {
      failures.push(`Peak refresh rate exceeded: ${refreshStats.peakRefreshRate} > ${config.maxRefreshPerSecond}`);
    }

    if (refreshStats.concurrentRefreshViolations > 0) {
      failures.push(`Concurrent refresh violations: ${refreshStats.concurrentRefreshViolations}`);
    }

    if (refreshStats.retryStormEvents > 0) {
      failures.push(`Retry storm events: ${refreshStats.retryStormEvents}`);
    }

    if (rateLimitStats.jobExplosionDetected) {
      failures.push('Job explosion detected');
    }

    if (failures.length > 0) {
      logger.error('VALIDATION FAILED', { failures });
      throw new Error(`Validation failed: ${failures.join(', ')}`);
    }

    logger.info('VALIDATION PASSED - No violations detected');
  }

  /**
   * Phase 6: Report generation
   */
  private async reportPhase(): Promise<void> {
    logger.info('Phase 6: Report Generation');

    const reportGenerator = new ReportGenerator();
    await reportGenerator.generate({
      startTime: this.startTime,
      endTime: this.endTime,
      config,
      workspaces: this.workspaceIds.length,
      accounts: this.accountIds.length,
      posts: this.postIds.length,
    });

    logger.info('Report generated');
  }

  /**
   * Create workspace
   */
  private async createWorkspace(index: number): Promise<ObjectId> {
    if (!this.db) throw new Error('Database not connected');

    const workspace = {
      _id: new ObjectId(),
      name: `Chaos Workspace ${index}`,
      ownerId: new ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.collection('workspaces').insertOne(workspace);
    return workspace._id;
  }

  /**
   * Create account
   */
  private async createAccount(workspaceId: ObjectId, index: number): Promise<ObjectId> {
    if (!this.db) throw new Error('Database not connected');

    const expiresAt = new Date(Date.now() + Math.random() * 3600000); // Random expiry within 1 hour

    const account = {
      _id: new ObjectId(),
      workspaceId,
      provider: 'twitter',
      accountName: `chaos_account_${index}`,
      status: 'active',
      accessToken: `encrypted_token_${index}`,
      refreshToken: `encrypted_refresh_${index}`,
      tokenExpiresAt: expiresAt,
      metadata: {
        username: `@chaos${index}`,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.collection('socialaccounts').insertOne(account);
    return account._id;
  }

  /**
   * Create post
   */
  private async createPost(accountId: ObjectId, scheduledAt: Date, index: number): Promise<ObjectId> {
    if (!this.db) throw new Error('Database not connected');

    const account = await this.db.collection('socialaccounts').findOne({ _id: accountId });
    if (!account) throw new Error('Account not found');

    const post = {
      _id: new ObjectId(),
      workspaceId: account.workspaceId,
      socialAccountId: accountId,
      content: `Chaos test post ${index} - ${Date.now()}`,
      status: 'scheduled',
      scheduledAt,
      mediaUrls: [],
      metadata: {},
      version: 0,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.collection('posts').insertOne(post);
    return post._id;
  }

  /**
   * Trigger token expiry burst
   */
  private async triggerTokenExpiryBurst(): Promise<void> {
    logger.info('Triggering token expiry burst', { count: config.refreshExpiryBurst });

    const accountsToExpire = this.accountIds.slice(0, config.refreshExpiryBurst);
    const expiryTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    const pool = new PromisePool(50);
    const tasks = accountsToExpire.map(accountId => async () => {
      await this.db!.collection('socialaccounts').updateOne(
        { _id: accountId },
        { $set: { tokenExpiresAt: expiryTime } }
      );
    });

    await pool.execute(tasks);

    logger.info('Token expiry burst triggered');
    logEvent('token_expiry_burst', { count: accountsToExpire.length });
  }

  /**
   * Get progress
   */
  private async getProgress(): Promise<any> {
    if (!this.db) return {};

    const [total, published, failed, publishing] = await Promise.all([
      this.db.collection('posts').countDocuments(),
      this.db.collection('posts').countDocuments({ status: 'published' }),
      this.db.collection('posts').countDocuments({ status: 'failed' }),
      this.db.collection('posts').countDocuments({ status: 'publishing' }),
    ]);

    return {
      total,
      published,
      failed,
      publishing,
      remaining: total - published - failed,
    };
  }

  /**
   * Check for violations
   */
  private async checkViolations(): Promise<void> {
    // Check memory growth
    const memUsage = process.memoryUsage();
    const memoryGrowth = memUsage.heapUsed / (100 * 1024 * 1024); // Baseline 100MB

    if (memoryGrowth > config.maxMemoryGrowthMultiplier) {
      logger.warn('Memory growth threshold exceeded', {
        growth: memoryGrowth.toFixed(2),
        threshold: config.maxMemoryGrowthMultiplier,
      });
    }

    // Check refresh rate
    const isRefreshStorm = await refreshStormValidator.isRefreshStorm();
    if (isRefreshStorm) {
      logger.warn('Refresh storm detected');
    }

    // Check for duplicates
    const duplicateCount = duplicateDetector.getDuplicateCount();
    if (duplicateCount > 0) {
      logger.error('Duplicates detected during monitoring', { count: duplicateCount });
    }
  }

  /**
   * Cleanup
   */
  private async cleanup(): Promise<void> {
    logger.info('Cleaning up');

    // Stop chaos injection
    chaosInjector.stop();

    logger.info('Cleanup complete');
  }
}

// Run if executed directly
if (require.main === module) {
  const simulator = new LoadSimulator();
  simulator.run()
    .then(() => {
      logger.info('Simulation completed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Simulation failed', { error: error.message });
      process.exit(1);
    });
}
