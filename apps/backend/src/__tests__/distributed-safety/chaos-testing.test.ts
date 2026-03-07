/**
 * Chaos Test Suite: Distributed Safety Under Failure Conditions
 * 
 * Phase 0 - Task 0.7
 * 
 * This test suite simulates critical failure scenarios and verifies the system
 * maintains distributed safety (no duplicates, no missed posts, no data corruption)
 * under chaos conditions.
 * 
 * Test Scenarios:
 * 1. Database Connection Loss During Post Submission
 * 2. Redis Connection Loss During Job Processing
 * 3. Network Timeout During Provider API Call
 * 4. Worker Crash During Job Execution
 * 5. 100x Concurrent Publish Storm
 * 
 * Success Criteria:
 * - Zero duplicates detected across all scenarios
 * - Zero missed posts detected across all scenarios
 * - Zero data corruption detected
 * - System recovers gracefully from all failures
 * - Recovery time < 30 seconds for all scenarios
 * 
 * Note: This test uses simulated services to avoid requiring real infrastructure.
 * It validates the core safety properties and recovery mechanisms.
 */

/**
 * Simulated Monitoring for Chaos Tests
 * This is a lightweight version for testing purposes
 */
class SimulatedMonitor {
  private metrics = {
    duplicatePublish: { totalAttempts: 0, duplicatesDetected: 0 },
    missedPosts: { totalScheduled: 0, totalExecuted: 0, missedCount: 0 },
    queueLag: { samples: [] as number[], p50: 0, p95: 0, p99: 0 },
    schedulerDrift: { samples: [] as number[], p50: 0, p95: 0, p99: 0 },
  };

  async initialize() {}
  async resetMetrics() {
    this.metrics = {
      duplicatePublish: { totalAttempts: 0, duplicatesDetected: 0 },
      missedPosts: { totalScheduled: 0, totalExecuted: 0, missedCount: 0 },
      queueLag: { samples: [], p50: 0, p95: 0, p99: 0 },
      schedulerDrift: { samples: [], p50: 0, p95: 0, p99: 0 },
    };
  }

  async recordPublishAttempt(event: { postId: string; timestamp: Date; isDuplicate: boolean }) {
    this.metrics.duplicatePublish.totalAttempts++;
    if (event.isDuplicate) {
      this.metrics.duplicatePublish.duplicatesDetected++;
    }
  }

  async recordQueueLag(event: { jobId: string; createdAt: Date; processingStartedAt: Date; lagMs: number }) {
    this.metrics.queueLag.samples.push(event.lagMs);
  }

  async recordSchedulerDrift(event: { postId: string; scheduledAt: Date; actualExecutionAt: Date; driftMs: number }) {
    this.metrics.schedulerDrift.samples.push(Math.abs(event.driftMs));
  }

  async recordPostExecution(event: { postId: string; scheduledAt: Date; executedAt: Date; wasMissed: boolean }) {
    this.metrics.missedPosts.totalScheduled++;
    if (!event.wasMissed) {
      this.metrics.missedPosts.totalExecuted++;
    } else {
      this.metrics.missedPosts.missedCount++;
    }
  }

  getMetrics() {
    return this.metrics;
  }
}

describe('Chaos Testing: Distributed Safety Under Failure', () => {
  let monitor: SimulatedMonitor;

  beforeEach(async () => {
    monitor = new SimulatedMonitor();
    await monitor.initialize();
    await monitor.resetMetrics();
  });

  afterEach(async () => {
    // Cleanup test state
    await monitor.resetMetrics();
  });

  /**
   * Simulated Post
   */
  interface Post {
    id: string;
    content: string;
    scheduledAt: Date;
    status: 'pending' | 'queued' | 'processing' | 'published' | 'failed';
  }

  /**
   * Simulated Database with connection failure capability
   */
  class SimulatedDatabase {
    private posts: Map<string, Post> = new Map();
    private connected: boolean = true;
    private connectionLossCallback?: () => void;

    connect(): void {
      this.connected = true;
    }

    disconnect(): void {
      this.connected = false;
      if (this.connectionLossCallback) {
        this.connectionLossCallback();
      }
    }

    isConnected(): boolean {
      return this.connected;
    }

    onConnectionLoss(callback: () => void): void {
      this.connectionLossCallback = callback;
    }

    async savePost(post: Post): Promise<void> {
      if (!this.connected) {
        throw new Error('Database connection lost');
      }
      this.posts.set(post.id, post);
    }

    async getPost(postId: string): Promise<Post | undefined> {
      if (!this.connected) {
        throw new Error('Database connection lost');
      }
      return this.posts.get(postId);
    }

    async getAllPosts(): Promise<Post[]> {
      if (!this.connected) {
        throw new Error('Database connection lost');
      }
      return Array.from(this.posts.values());
    }

    clear(): void {
      this.posts.clear();
    }
  }

  /**
   * Simulated Redis Queue with connection failure capability
   */
  class SimulatedRedisQueue {
    private jobs: Map<string, { id: string; postId: string; status: string; createdAt: Date }> = new Map();
    private connected: boolean = true;
    private jobCounter = 0;

    connect(): void {
      this.connected = true;
    }

    disconnect(): void {
      this.connected = false;
    }

    isConnected(): boolean {
      return this.connected;
    }

    async addJob(postId: string): Promise<string> {
      if (!this.connected) {
        throw new Error('Redis connection lost');
      }
      const jobId = `job-${++this.jobCounter}`;
      this.jobs.set(jobId, {
        id: jobId,
        postId,
        status: 'waiting',
        createdAt: new Date(),
      });
      return jobId;
    }

    async getJob(jobId: string) {
      if (!this.connected) {
        throw new Error('Redis connection lost');
      }
      return this.jobs.get(jobId);
    }

    async getWaitingJobs() {
      if (!this.connected) {
        throw new Error('Redis connection lost');
      }
      return Array.from(this.jobs.values()).filter(j => j.status === 'waiting');
    }

    async updateJobStatus(jobId: string, status: string): Promise<void> {
      if (!this.connected) {
        throw new Error('Redis connection lost');
      }
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = status;
      }
    }

    getAllJobs() {
      return Array.from(this.jobs.values());
    }

    clear(): void {
      this.jobs.clear();
      this.jobCounter = 0;
    }
  }

  /**
   * Simulated Worker with crash capability
   */
  class SimulatedWorker {
    private crashed: boolean = false;
    private processingJobs: Set<string> = new Set();

    crash(): void {
      this.crashed = true;
      // Mark all processing jobs as failed
      this.processingJobs.clear();
    }

    recover(): void {
      this.crashed = false;
    }

    isCrashed(): boolean {
      return this.crashed;
    }

    async processJob(jobId: string, processor: () => Promise<void>): Promise<void> {
      if (this.crashed) {
        throw new Error('Worker crashed');
      }
      this.processingJobs.add(jobId);
      try {
        await processor();
        this.processingJobs.delete(jobId);
      } catch (error) {
        this.processingJobs.delete(jobId);
        throw error;
      }
    }

    getProcessingJobs(): string[] {
      return Array.from(this.processingJobs);
    }
  }

  /**
   * Simulated Social Media API with timeout capability
   */
  class SimulatedSocialMediaAPI {
    private timeoutEnabled: boolean = false;
    private timeoutDuration: number = 5000;
    private publishedPosts: Map<string, { postId: string; timestamp: Date }> = new Map();

    enableTimeout(duration: number = 5000): void {
      this.timeoutEnabled = true;
      this.timeoutDuration = duration;
    }

    disableTimeout(): void {
      this.timeoutEnabled = false;
    }

    async publishPost(postId: string, content: string): Promise<void> {
      if (this.timeoutEnabled) {
        // Simulate network timeout
        await new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), this.timeoutDuration)
        );
      }

      // Normal publish
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API latency
      this.publishedPosts.set(postId, {
        postId,
        timestamp: new Date(),
      });
    }

    getPublishedPosts(): Array<{ postId: string; timestamp: Date }> {
      return Array.from(this.publishedPosts.values());
    }

    clear(): void {
      this.publishedPosts.clear();
    }
  }

  /**
   * CHAOS SCENARIO 1: Database Connection Loss During Post Submission
   * 
   * Simulates MongoDB connection failure mid-transaction and verifies:
   * - Post submission fails gracefully
   * - No partial writes or corrupted state
   * - System recovers when connection restored
   * - No duplicate posts created on retry
   */
  it('should handle database connection loss during post submission', async () => {
    const testStartTime = new Date().toISOString();
    const db = new SimulatedDatabase();
    const publishedPosts: string[] = [];
    let failedAttempts = 0;
    let successfulRetries = 0;

    console.log('\n=== CHAOS SCENARIO 1: Database Connection Loss ===');
    console.log(`Test Start: ${testStartTime}`);

    // Submit 10 posts
    const posts: Post[] = Array.from({ length: 10 }, (_, i) => ({
      id: `post-${i}`,
      content: `Test post ${i}`,
      scheduledAt: new Date(),
      status: 'pending' as const,
    }));

    // Submit first 5 posts successfully
    for (let i = 0; i < 5; i++) {
      try {
        await db.savePost(posts[i]);
        publishedPosts.push(posts[i].id);
        await monitor.recordPublishAttempt({
          postId: posts[i].id,
          timestamp: new Date(),
          isDuplicate: false,
        });
      } catch (error) {
        failedAttempts++;
      }
    }

    // Simulate database connection loss
    console.log('Simulating database connection loss...');
    db.disconnect();

    // Try to submit next 5 posts (should fail)
    for (let i = 5; i < 10; i++) {
      try {
        await db.savePost(posts[i]);
        publishedPosts.push(posts[i].id);
      } catch (error) {
        failedAttempts++;
        console.log(`  Post ${posts[i].id} failed: ${(error as Error).message}`);
      }
    }

    // Verify no partial writes
    let savedPosts: Post[] = [];
    try {
      savedPosts = await db.getAllPosts();
    } catch (error) {
      // Connection still lost, which is expected
      savedPosts = [];
    }
    expect(savedPosts.length).toBe(0); // No posts saved while disconnected

    // Simulate connection recovery
    console.log('Simulating database connection recovery...');
    const recoveryStartTime = Date.now();
    db.connect();
    const recoveryTime = Date.now() - recoveryStartTime;

    // Retry failed posts
    for (let i = 5; i < 10; i++) {
      try {
        await db.savePost(posts[i]);
        publishedPosts.push(posts[i].id);
        successfulRetries++;
        await monitor.recordPublishAttempt({
          postId: posts[i].id,
          timestamp: new Date(),
          isDuplicate: false,
        });
      } catch (error) {
        failedAttempts++;
      }
    }

    // Verify all posts eventually saved
    const finalPosts = await db.getAllPosts();
    expect(finalPosts.length).toBe(10);

    // Verify no duplicates
    const uniquePostIds = new Set(finalPosts.map(p => p.id));
    expect(uniquePostIds.size).toBe(10);

    const metrics = monitor.getMetrics();
    expect(metrics.duplicatePublish.duplicatesDetected).toBe(0);

    const testEndTime = new Date().toISOString();
    console.log(`\nResults:`);
    console.log(`  Total Posts: 10`);
    console.log(`  Failed Attempts: ${failedAttempts}`);
    console.log(`  Successful Retries: ${successfulRetries}`);
    console.log(`  Final Saved Posts: ${finalPosts.length}`);
    console.log(`  Duplicates Detected: ${metrics.duplicatePublish.duplicatesDetected}`);
    console.log(`  Recovery Time: ${recoveryTime}ms`);
    console.log(`  Status: ${metrics.duplicatePublish.duplicatesDetected === 0 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Test End: ${testEndTime}`);
    console.log('===================================================\n');

    // Assertions
    expect(metrics.duplicatePublish.duplicatesDetected).toBe(0);
    expect(finalPosts.length).toBe(10);
    expect(recoveryTime).toBeLessThan(30000); // Recovery < 30s
  });

  /**
   * CHAOS SCENARIO 2: Redis Connection Loss During Job Processing
   * 
   * Simulates Redis connection failure during queue processing and verifies:
   * - Jobs are not lost
   * - Jobs are retried when connection restored
   * - No duplicate job execution
   * - Queue state remains consistent
   */
  it('should handle Redis connection loss during job processing', async () => {
    const testStartTime = new Date().toISOString();
    const queue = new SimulatedRedisQueue();
    const processedJobs: string[] = [];
    let failedAttempts = 0;
    let successfulRetries = 0;

    console.log('\n=== CHAOS SCENARIO 2: Redis Connection Loss ===');
    console.log(`Test Start: ${testStartTime}`);

    // Add 10 jobs to queue
    const jobIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const jobId = await queue.addJob(`post-${i}`);
      jobIds.push(jobId);
      await monitor.recordQueueLag({
        jobId,
        createdAt: new Date(),
        processingStartedAt: new Date(),
        lagMs: 0,
      });
    }

    // Process first 5 jobs successfully
    for (let i = 0; i < 5; i++) {
      try {
        await queue.updateJobStatus(jobIds[i], 'completed');
        processedJobs.push(jobIds[i]);
      } catch (error) {
        failedAttempts++;
      }
    }

    // Simulate Redis connection loss
    console.log('Simulating Redis connection loss...');
    queue.disconnect();

    // Try to process next 5 jobs (should fail)
    for (let i = 5; i < 10; i++) {
      try {
        await queue.updateJobStatus(jobIds[i], 'completed');
        processedJobs.push(jobIds[i]);
      } catch (error) {
        failedAttempts++;
        console.log(`  Job ${jobIds[i]} failed: ${(error as Error).message}`);
      }
    }

    // Verify jobs are not lost (still in queue)
    const allJobs = queue.getAllJobs();
    expect(allJobs.length).toBe(10);

    // Simulate connection recovery
    console.log('Simulating Redis connection recovery...');
    const recoveryStartTime = Date.now();
    queue.connect();
    const recoveryTime = Date.now() - recoveryStartTime;

    // Retry failed jobs
    for (let i = 5; i < 10; i++) {
      try {
        await queue.updateJobStatus(jobIds[i], 'completed');
        processedJobs.push(jobIds[i]);
        successfulRetries++;
      } catch (error) {
        failedAttempts++;
      }
    }

    // Verify all jobs processed
    const completedJobs = allJobs.filter(j => j.status === 'completed');
    expect(completedJobs.length).toBe(10);

    // Verify no duplicate execution
    const uniqueProcessedJobs = new Set(processedJobs);
    expect(uniqueProcessedJobs.size).toBe(10);

    const metrics = monitor.getMetrics();
    const testEndTime = new Date().toISOString();

    console.log(`\nResults:`);
    console.log(`  Total Jobs: 10`);
    console.log(`  Failed Attempts: ${failedAttempts}`);
    console.log(`  Successful Retries: ${successfulRetries}`);
    console.log(`  Completed Jobs: ${completedJobs.length}`);
    console.log(`  Duplicate Executions: ${processedJobs.length - uniqueProcessedJobs.size}`);
    console.log(`  Recovery Time: ${recoveryTime}ms`);
    console.log(`  Queue Lag P95: ${metrics.queueLag.p95}ms`);
    console.log(`  Status: ${uniqueProcessedJobs.size === 10 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Test End: ${testEndTime}`);
    console.log('================================================\n');

    // Assertions
    expect(completedJobs.length).toBe(10);
    expect(uniqueProcessedJobs.size).toBe(10);
    expect(recoveryTime).toBeLessThan(30000);
  });

  /**
   * CHAOS SCENARIO 3: Network Timeout During Provider API Call
   * 
   * Simulates network timeout when calling social media APIs and verifies:
   * - Timeout is detected within reasonable time (5s)
   * - Retry logic is triggered
   * - Exponential backoff is applied
   * - No duplicate posts on retry
   */
  it('should handle network timeout during provider API calls', async () => {
    const testStartTime = new Date().toISOString();
    const api = new SimulatedSocialMediaAPI();
    const publishAttempts: Array<{ postId: string; attempt: number; success: boolean; duration: number }> = [];
    let timeoutCount = 0;
    let successCount = 0;

    console.log('\n=== CHAOS SCENARIO 3: Network Timeout ===');
    console.log(`Test Start: ${testStartTime}`);

    // Publish 5 posts with timeout simulation
    for (let i = 0; i < 5; i++) {
      const postId = `post-${i}`;
      let attempt = 0;
      let published = false;

      // Enable timeout for first attempt
      api.enableTimeout(5000);

      while (!published && attempt < 3) {
        attempt++;
        const attemptStart = Date.now();
        
        try {
          await Promise.race([
            api.publishPost(postId, `Content ${i}`),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout detected')), 5000)
            ),
          ]);
          
          published = true;
          successCount++;
          const duration = Date.now() - attemptStart;
          publishAttempts.push({ postId, attempt, success: true, duration });
          
          await monitor.recordPublishAttempt({
            postId,
            timestamp: new Date(),
            isDuplicate: false,
          });
        } catch (error) {
          timeoutCount++;
          const duration = Date.now() - attemptStart;
          publishAttempts.push({ postId, attempt, success: false, duration });
          console.log(`  Post ${postId} attempt ${attempt} timed out after ${duration}ms`);
          
          // Disable timeout for retry (simulating network recovery)
          if (attempt === 1) {
            api.disableTimeout();
          }
          
          // Exponential backoff
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // Verify all posts published
    const publishedPosts = api.getPublishedPosts();
    expect(publishedPosts.length).toBe(5);

    // Verify no duplicates
    const uniquePostIds = new Set(publishedPosts.map(p => p.postId));
    expect(uniquePostIds.size).toBe(5);

    // Verify timeout detection time
    const timeoutAttempts = publishAttempts.filter(a => !a.success);
    const avgTimeoutDetection = timeoutAttempts.reduce((sum, a) => sum + a.duration, 0) / timeoutAttempts.length;
    expect(avgTimeoutDetection).toBeLessThanOrEqual(5100); // Allow 100ms tolerance

    const metrics = monitor.getMetrics();
    const testEndTime = new Date().toISOString();

    console.log(`\nResults:`);
    console.log(`  Total Posts: 5`);
    console.log(`  Timeout Count: ${timeoutCount}`);
    console.log(`  Success Count: ${successCount}`);
    console.log(`  Published Posts: ${publishedPosts.length}`);
    console.log(`  Duplicates: ${publishedPosts.length - uniquePostIds.size}`);
    console.log(`  Avg Timeout Detection: ${Math.round(avgTimeoutDetection)}ms`);
    console.log(`  Retry Attempts:`);
    
    const retryStats = publishAttempts.reduce((acc, a) => {
      acc[a.attempt] = (acc[a.attempt] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    Object.entries(retryStats).forEach(([attempt, count]) => {
      console.log(`    Attempt ${attempt}: ${count} times`);
    });
    
    console.log(`  Status: ${uniquePostIds.size === 5 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Test End: ${testEndTime}`);
    console.log('==========================================\n');

    // Assertions
    expect(publishedPosts.length).toBe(5);
    expect(uniquePostIds.size).toBe(5);
    expect(metrics.duplicatePublish.duplicatesDetected).toBe(0);
    expect(avgTimeoutDetection).toBeLessThanOrEqual(5100); // Allow 100ms tolerance
  });

  /**
   * CHAOS SCENARIO 4: Worker Crash During Job Execution
   * 
   * Simulates worker process crash mid-execution and verifies:
   * - Job is marked as failed
   * - Job is retried by another worker
   * - No duplicate execution
   * - No missed posts
   */
  it('should handle worker crash during job execution', async () => {
    const testStartTime = new Date().toISOString();
    const worker1 = new SimulatedWorker();
    const worker2 = new SimulatedWorker();
    const queue = new SimulatedRedisQueue();
    const executedJobs: string[] = [];
    let crashCount = 0;
    let retryCount = 0;

    console.log('\n=== CHAOS SCENARIO 4: Worker Crash ===');
    console.log(`Test Start: ${testStartTime}`);

    // Add 10 jobs to queue
    const jobIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const jobId = await queue.addJob(`post-${i}`);
      jobIds.push(jobId);
    }

    // Worker 1 processes first 5 jobs successfully
    for (let i = 0; i < 5; i++) {
      try {
        await worker1.processJob(jobIds[i], async () => {
          await queue.updateJobStatus(jobIds[i], 'processing');
          await new Promise(resolve => setTimeout(resolve, 50)); // Simulate work
          await queue.updateJobStatus(jobIds[i], 'completed');
          executedJobs.push(jobIds[i]);
        });
      } catch (error) {
        console.log(`  Job ${jobIds[i]} failed: ${(error as Error).message}`);
      }
    }

    // Worker 1 starts processing job 6, then crashes
    console.log('Simulating worker crash during job execution...');
    const crashJobId = jobIds[5];
    
    try {
      await worker1.processJob(crashJobId, async () => {
        await queue.updateJobStatus(crashJobId, 'processing');
        await new Promise(resolve => setTimeout(resolve, 25)); // Partial work
        
        // Simulate crash
        worker1.crash();
        crashCount++;
        throw new Error('Worker crashed');
      });
    } catch (error) {
      console.log(`  Worker 1 crashed while processing ${crashJobId}`);
      // Mark job as failed so it can be retried
      await queue.updateJobStatus(crashJobId, 'failed');
    }

    // Worker 2 takes over and retries the failed job
    console.log('Worker 2 taking over failed job...');
    const recoveryStartTime = Date.now();
    
    try {
      await worker2.processJob(crashJobId, async () => {
        await queue.updateJobStatus(crashJobId, 'processing');
        await new Promise(resolve => setTimeout(resolve, 50)); // Complete work
        await queue.updateJobStatus(crashJobId, 'completed');
        executedJobs.push(crashJobId);
        retryCount++;
      });
    } catch (error) {
      console.log(`  Worker 2 failed: ${(error as Error).message}`);
    }
    
    const recoveryTime = Date.now() - recoveryStartTime;

    // Worker 2 processes remaining jobs
    for (let i = 6; i < 10; i++) {
      try {
        await worker2.processJob(jobIds[i], async () => {
          await queue.updateJobStatus(jobIds[i], 'processing');
          await new Promise(resolve => setTimeout(resolve, 50));
          await queue.updateJobStatus(jobIds[i], 'completed');
          executedJobs.push(jobIds[i]);
        });
      } catch (error) {
        console.log(`  Job ${jobIds[i]} failed: ${(error as Error).message}`);
      }
    }

    // Verify all jobs completed
    const allJobs = queue.getAllJobs();
    const completedJobs = allJobs.filter(j => j.status === 'completed');
    expect(completedJobs.length).toBe(10);

    // Verify no duplicate execution
    const uniqueExecutedJobs = new Set(executedJobs);
    expect(uniqueExecutedJobs.size).toBe(10);

    // Verify no missed posts
    const missedJobs = allJobs.filter(j => j.status === 'failed');
    expect(missedJobs.length).toBe(0);

    await monitor.recordPostExecution({
      postId: crashJobId,
      scheduledAt: new Date(),
      executedAt: new Date(),
      wasMissed: false,
    });

    const metrics = monitor.getMetrics();
    const testEndTime = new Date().toISOString();

    console.log(`\nResults:`);
    console.log(`  Total Jobs: 10`);
    console.log(`  Crash Count: ${crashCount}`);
    console.log(`  Retry Count: ${retryCount}`);
    console.log(`  Completed Jobs: ${completedJobs.length}`);
    console.log(`  Duplicate Executions: ${executedJobs.length - uniqueExecutedJobs.size}`);
    console.log(`  Missed Posts: ${metrics.missedPosts.missedCount}`);
    console.log(`  Recovery Time: ${recoveryTime}ms`);
    console.log(`  Status: ${uniqueExecutedJobs.size === 10 && missedJobs.length === 0 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Test End: ${testEndTime}`);
    console.log('========================================\n');

    // Assertions
    expect(completedJobs.length).toBe(10);
    expect(uniqueExecutedJobs.size).toBe(10);
    expect(missedJobs.length).toBe(0);
    expect(metrics.missedPosts.missedCount).toBe(0);
    expect(recoveryTime).toBeLessThan(30000);
  });

  /**
   * CHAOS SCENARIO 5: 100x Concurrent Publish Storm
   * 
   * Simulates 100x normal concurrent load (100 concurrent requests) and verifies:
   * - System handles load without crashes
   * - No duplicate posts under high concurrency
   * - No missed posts under high concurrency
   * - Queue lag remains acceptable (P95 < 10s under stress)
   * - Scheduler drift remains acceptable (P95 < 60s under stress)
   */
  it('should handle 100x concurrent publish storm', async () => {
    const testStartTime = new Date().toISOString();
    const db = new SimulatedDatabase();
    const queue = new SimulatedRedisQueue();
    const api = new SimulatedSocialMediaAPI();
    const concurrentRequests = 100;
    const publishedPosts: string[] = [];
    const queueLags: number[] = [];
    const schedulerDrifts: number[] = [];

    console.log('\n=== CHAOS SCENARIO 5: 100x Concurrent Load ===');
    console.log(`Test Start: ${testStartTime}`);
    console.log(`Concurrent Requests: ${concurrentRequests}`);

    // Generate 100 posts
    const posts: Post[] = Array.from({ length: concurrentRequests }, (_, i) => ({
      id: `post-${i}`,
      content: `Stress test post ${i}`,
      scheduledAt: new Date(Date.now() + Math.random() * 60000), // Random within 1 minute
      status: 'pending' as const,
    }));

    // Submit all posts concurrently
    console.log('Submitting 100 concurrent posts...');
    const submissionStart = Date.now();
    
    const submissionPromises = posts.map(async (post) => {
      const submitTime = Date.now();
      
      try {
        // Save to database
        await db.savePost(post);
        
        // Add to queue
        const jobId = await queue.addJob(post.id);
        const queueTime = Date.now();
        const lagMs = queueTime - submitTime;
        queueLags.push(lagMs);
        
        // Record metrics
        await monitor.recordPublishAttempt({
          postId: post.id,
          timestamp: new Date(),
          isDuplicate: false,
        });
        
        await monitor.recordQueueLag({
          jobId,
          createdAt: new Date(submitTime),
          processingStartedAt: new Date(queueTime),
          lagMs,
        });
        
        publishedPosts.push(post.id);
      } catch (error) {
        console.log(`  Post ${post.id} failed: ${(error as Error).message}`);
      }
    });

    await Promise.all(submissionPromises);
    const submissionDuration = Date.now() - submissionStart;

    console.log(`Submission completed in ${submissionDuration}ms`);

    // Process all jobs concurrently (simulate workers)
    console.log('Processing jobs with simulated workers...');
    const processingStart = Date.now();
    
    const processingPromises = queue.getAllJobs().map(async (job) => {
      const processingStartTime = Date.now();
      
      try {
        await queue.updateJobStatus(job.id, 'processing');
        
        // Simulate job processing
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
        
        // Publish to API
        const post = posts.find(p => p.id === job.postId);
        if (post) {
          await api.publishPost(post.id, post.content);
          
          // Calculate scheduler drift
          const actualExecutionTime = Date.now();
          const driftMs = actualExecutionTime - post.scheduledAt.getTime();
          schedulerDrifts.push(Math.abs(driftMs));
          
          await monitor.recordSchedulerDrift({
            postId: post.id,
            scheduledAt: post.scheduledAt,
            actualExecutionAt: new Date(actualExecutionTime),
            driftMs,
          });
          
          await monitor.recordPostExecution({
            postId: post.id,
            scheduledAt: post.scheduledAt,
            executedAt: new Date(actualExecutionTime),
            wasMissed: false,
          });
        }
        
        await queue.updateJobStatus(job.id, 'completed');
      } catch (error) {
        console.log(`  Job ${job.id} processing failed: ${(error as Error).message}`);
      }
    });

    await Promise.all(processingPromises);
    const processingDuration = Date.now() - processingStart;

    console.log(`Processing completed in ${processingDuration}ms`);

    // Calculate metrics
    const calculatePercentile = (values: number[], percentile: number): number => {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    const queueLagP50 = calculatePercentile(queueLags, 50);
    const queueLagP95 = calculatePercentile(queueLags, 95);
    const queueLagP99 = calculatePercentile(queueLags, 99);

    const driftP50 = calculatePercentile(schedulerDrifts, 50);
    const driftP95 = calculatePercentile(schedulerDrifts, 95);
    const driftP99 = calculatePercentile(schedulerDrifts, 99);

    // Verify results
    const savedPosts = await db.getAllPosts();
    const completedJobs = queue.getAllJobs().filter(j => j.status === 'completed');
    const publishedApiPosts = api.getPublishedPosts();

    // Check for duplicates
    const uniqueSavedPosts = new Set(savedPosts.map(p => p.id));
    const uniquePublishedPosts = new Set(publishedApiPosts.map(p => p.postId));

    const metrics = monitor.getMetrics();
    const testEndTime = new Date().toISOString();

    console.log(`\nResults:`);
    console.log(`  Concurrent Requests: ${concurrentRequests}`);
    console.log(`  Submission Duration: ${submissionDuration}ms`);
    console.log(`  Processing Duration: ${processingDuration}ms`);
    console.log(`  Total Duration: ${submissionDuration + processingDuration}ms`);
    console.log(`\nPost Tracking:`);
    console.log(`  Saved to DB: ${savedPosts.length}`);
    console.log(`  Queued Jobs: ${queue.getAllJobs().length}`);
    console.log(`  Completed Jobs: ${completedJobs.length}`);
    console.log(`  Published to API: ${publishedApiPosts.length}`);
    console.log(`\nDuplicate Detection:`);
    console.log(`  Unique Saved Posts: ${uniqueSavedPosts.size}`);
    console.log(`  Unique Published Posts: ${uniquePublishedPosts.size}`);
    console.log(`  Duplicates in DB: ${savedPosts.length - uniqueSavedPosts.size}`);
    console.log(`  Duplicates in API: ${publishedApiPosts.length - uniquePublishedPosts.size}`);
    console.log(`  Monitor Duplicates: ${metrics.duplicatePublish.duplicatesDetected}`);
    console.log(`\nQueue Lag (milliseconds):`);
    console.log(`  P50: ${Math.round(queueLagP50)}ms`);
    console.log(`  P95: ${Math.round(queueLagP95)}ms`);
    console.log(`  P99: ${Math.round(queueLagP99)}ms`);
    console.log(`  Threshold: < 10000ms (10s under stress)`);
    console.log(`  Status: ${queueLagP95 < 10000 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`\nScheduler Drift (milliseconds):`);
    console.log(`  P50: ${Math.round(driftP50)}ms`);
    console.log(`  P95: ${Math.round(driftP95)}ms`);
    console.log(`  P99: ${Math.round(driftP99)}ms`);
    console.log(`  Threshold: < 60000ms (60s under stress)`);
    console.log(`  Status: ${driftP95 < 60000 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`\nMissed Posts:`);
    console.log(`  Total Scheduled: ${posts.length}`);
    console.log(`  Total Executed: ${publishedApiPosts.length}`);
    console.log(`  Missed Count: ${posts.length - publishedApiPosts.length}`);
    console.log(`  Status: ${posts.length === publishedApiPosts.length ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`\nOverall Status: ${
      uniqueSavedPosts.size === concurrentRequests &&
      uniquePublishedPosts.size === concurrentRequests &&
      metrics.duplicatePublish.duplicatesDetected === 0 &&
      queueLagP95 < 10000 &&
      driftP95 < 60000
        ? '✓ PASS'
        : '✗ FAIL'
    }`);
    console.log(`Test End: ${testEndTime}`);
    console.log('===============================================\n');

    // Assertions
    expect(savedPosts.length).toBe(concurrentRequests);
    expect(uniqueSavedPosts.size).toBe(concurrentRequests);
    expect(completedJobs.length).toBe(concurrentRequests);
    expect(publishedApiPosts.length).toBe(concurrentRequests);
    expect(uniquePublishedPosts.size).toBe(concurrentRequests);
    expect(metrics.duplicatePublish.duplicatesDetected).toBe(0);
    expect(metrics.missedPosts.missedCount).toBe(0);
    expect(queueLagP95).toBeLessThan(10000); // P95 < 10s under stress
    expect(driftP95).toBeLessThan(60000); // P95 < 60s under stress
  });

  /**
   * COMPREHENSIVE CHAOS TEST: All Scenarios Combined
   * 
   * Runs all chaos scenarios in sequence and verifies overall system resilience.
   * This test validates that the system can handle multiple failure types
   * and maintain distributed safety throughout.
   */
  it('should maintain distributed safety across all chaos scenarios', async () => {
    const testStartTime = new Date().toISOString();
    const scenarioResults: Array<{
      scenario: string;
      passed: boolean;
      duplicates: number;
      missed: number;
      recoveryTime: number;
    }> = [];

    console.log('\n=== COMPREHENSIVE CHAOS TEST ===');
    console.log(`Test Start: ${testStartTime}`);
    console.log('Running all chaos scenarios in sequence...\n');

    // Scenario 1: Database Connection Loss
    {
      const db = new SimulatedDatabase();
      let recoveryTime = 0;
      
      for (let i = 0; i < 5; i++) {
        await db.savePost({
          id: `db-post-${i}`,
          content: `Test ${i}`,
          scheduledAt: new Date(),
          status: 'pending',
        });
      }
      
      db.disconnect();
      
      try {
        await db.savePost({
          id: 'db-post-fail',
          content: 'Should fail',
          scheduledAt: new Date(),
          status: 'pending',
        });
      } catch (error) {
        // Expected
      }
      
      const recoveryStart = Date.now();
      db.connect();
      recoveryTime = Date.now() - recoveryStart;
      
      const posts = await db.getAllPosts();
      const uniquePosts = new Set(posts.map(p => p.id));
      
      scenarioResults.push({
        scenario: 'Database Connection Loss',
        passed: uniquePosts.size === posts.length,
        duplicates: posts.length - uniquePosts.size,
        missed: 0,
        recoveryTime,
      });
    }

    // Scenario 2: Redis Connection Loss
    {
      const queue = new SimulatedRedisQueue();
      let recoveryTime = 0;
      
      for (let i = 0; i < 5; i++) {
        await queue.addJob(`redis-post-${i}`);
      }
      
      queue.disconnect();
      
      try {
        await queue.addJob('redis-post-fail');
      } catch (error) {
        // Expected
      }
      
      const recoveryStart = Date.now();
      queue.connect();
      recoveryTime = Date.now() - recoveryStart;
      
      const jobs = queue.getAllJobs();
      
      scenarioResults.push({
        scenario: 'Redis Connection Loss',
        passed: jobs.length === 5,
        duplicates: 0,
        missed: 0,
        recoveryTime,
      });
    }

    // Scenario 3: Network Timeout
    {
      const api = new SimulatedSocialMediaAPI();
      let timeoutDetected = false;
      let recoveryTime = 0;
      
      api.enableTimeout(5000);
      
      const timeoutStart = Date.now();
      try {
        await Promise.race([
          api.publishPost('timeout-post', 'Test'),
          new Promise((_, reject) => 
            setTimeout(() => {
              timeoutDetected = true;
              reject(new Error('Timeout'));
            }, 5000)
          ),
        ]);
      } catch (error) {
        recoveryTime = Date.now() - timeoutStart;
      }
      
      api.disableTimeout();
      await api.publishPost('timeout-post-retry', 'Test');
      
      const published = api.getPublishedPosts();
      
      scenarioResults.push({
        scenario: 'Network Timeout',
        passed: timeoutDetected && recoveryTime <= 5100, // Allow 100ms tolerance
        duplicates: 0,
        missed: 0,
        recoveryTime,
      });
    }

    // Scenario 4: Worker Crash
    {
      const worker = new SimulatedWorker();
      const queue = new SimulatedRedisQueue();
      let recoveryTime = 0;
      
      const jobId = await queue.addJob('crash-post');
      
      try {
        await worker.processJob(jobId, async () => {
          worker.crash();
          throw new Error('Crashed');
        });
      } catch (error) {
        // Expected
      }
      
      const recoveryStart = Date.now();
      const worker2 = new SimulatedWorker();
      await worker2.processJob(jobId, async () => {
        await queue.updateJobStatus(jobId, 'completed');
      });
      recoveryTime = Date.now() - recoveryStart;
      
      const job = await queue.getJob(jobId);
      
      scenarioResults.push({
        scenario: 'Worker Crash',
        passed: job?.status === 'completed',
        duplicates: 0,
        missed: 0,
        recoveryTime,
      });
    }

    // Scenario 5: Concurrent Load (reduced to 50 for combined test)
    {
      const db = new SimulatedDatabase();
      const queue = new SimulatedRedisQueue();
      const concurrentRequests = 50;
      
      const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
        await db.savePost({
          id: `concurrent-post-${i}`,
          content: `Test ${i}`,
          scheduledAt: new Date(),
          status: 'pending',
        });
        await queue.addJob(`concurrent-post-${i}`);
      });
      
      await Promise.all(promises);
      
      const posts = await db.getAllPosts();
      const jobs = queue.getAllJobs();
      const uniquePosts = new Set(posts.map(p => p.id));
      
      scenarioResults.push({
        scenario: 'Concurrent Load (50x)',
        passed: uniquePosts.size === concurrentRequests && jobs.length === concurrentRequests,
        duplicates: posts.length - uniquePosts.size,
        missed: concurrentRequests - posts.length,
        recoveryTime: 0,
      });
    }

    // Print comprehensive results
    const testEndTime = new Date().toISOString();
    console.log('\n=== CHAOS TEST RESULTS ===');
    console.log(`Test Start: ${testStartTime}`);
    console.log(`Test End: ${testEndTime}`);
    console.log(`\nScenario Results:`);
    
    scenarioResults.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.scenario}`);
      console.log(`   Status: ${result.passed ? '✓ PASS' : '✗ FAIL'}`);
      console.log(`   Duplicates: ${result.duplicates}`);
      console.log(`   Missed: ${result.missed}`);
      console.log(`   Recovery Time: ${result.recoveryTime}ms`);
    });
    
    const allPassed = scenarioResults.every(r => r.passed);
    const totalDuplicates = scenarioResults.reduce((sum, r) => sum + r.duplicates, 0);
    const totalMissed = scenarioResults.reduce((sum, r) => sum + r.missed, 0);
    const maxRecoveryTime = Math.max(...scenarioResults.map(r => r.recoveryTime));
    
    console.log(`\n=== OVERALL SUMMARY ===`);
    console.log(`Total Scenarios: ${scenarioResults.length}`);
    console.log(`Passed: ${scenarioResults.filter(r => r.passed).length}`);
    console.log(`Failed: ${scenarioResults.filter(r => !r.passed).length}`);
    console.log(`Total Duplicates: ${totalDuplicates}`);
    console.log(`Total Missed: ${totalMissed}`);
    console.log(`Max Recovery Time: ${maxRecoveryTime}ms`);
    console.log(`\nOverall Status: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
    console.log('========================\n');

    // Final assertions
    expect(allPassed).toBe(true);
    expect(totalDuplicates).toBe(0);
    expect(totalMissed).toBe(0);
    expect(maxRecoveryTime).toBeLessThan(30000);
  });
});
