import pLimit from 'p-limit';

/**
 * Promise Pool for controlled concurrency
 */
export class PromisePool {
  private limit: ReturnType<typeof pLimit>;

  constructor(concurrency: number) {
    this.limit = pLimit(concurrency);
  }

  /**
   * Execute tasks with controlled concurrency
   */
  async execute<T>(tasks: (() => Promise<T>)[]): Promise<T[]> {
    return Promise.all(tasks.map(task => this.limit(task)));
  }

  /**
   * Execute tasks in batches
   */
  async executeBatches<T>(
    tasks: (() => Promise<T>)[],
    batchSize: number,
    delayBetweenBatches: number = 0
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchResults = await this.execute(batch);
      results.push(...batchResults);
      
      if (delayBetweenBatches > 0 && i + batchSize < tasks.length) {
        await this.delay(delayBetweenBatches);
      }
    }
    
    return results;
  }

  /**
   * Execute tasks at a specific rate (tasks per second)
   */
  async executeAtRate<T>(
    tasks: (() => Promise<T>)[],
    ratePerSecond: number
  ): Promise<T[]> {
    const delayMs = 1000 / ratePerSecond;
    const results: T[] = [];
    
    for (const task of tasks) {
      const result = await this.limit(task);
      results.push(result);
      await this.delay(delayMs);
    }
    
    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current active count
   */
  get activeCount(): number {
    return this.limit.activeCount;
  }

  /**
   * Get pending count
   */
  get pendingCount(): number {
    return this.limit.pendingCount;
  }
}

/**
 * Rate limiter for controlling request rate
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Wait until a token is available
   */
  async acquire(): Promise<void> {
    while (true) {
      this.refill();
      
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      
      // Wait for next refill
      const waitTime = (1 / this.refillRate) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}
