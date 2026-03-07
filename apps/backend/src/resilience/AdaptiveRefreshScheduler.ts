import { logger } from '../utils/logger';
import { LoadState } from './types';
import { ResilienceConfig } from './ResilienceConfig';
import { backpressureManager } from './BackpressureManager';

/**
 * Adaptive Refresh Scheduler
 * 
 * Dynamically throttles token refresh operations based on system load
 * 
 * Throttling rules:
 * - LOW_LOAD: Max 10 refresh/sec per platform, prioritize tokens expiring <1hr
 * - ELEVATED_LOAD: Max 10 refresh/sec per platform, prioritize tokens expiring <1hr
 * - HIGH_LOAD: Max 10 refresh/sec per platform, only refresh tokens expiring <30min
 * - CRITICAL_LOAD: Max 10 refresh/sec per platform, only refresh tokens expiring <10min
 * 
 * Features:
 * - Per-platform rate limiting
 * - Priority-based scheduling
 * - Jitter to prevent thundering herd
 * - Event-driven updates
 */

export class AdaptiveRefreshScheduler {
  private static instance: AdaptiveRefreshScheduler;
  
  private currentLoadState: LoadState = LoadState.LOW_LOAD;
  
  // Track last refresh time per platform
  private lastRefreshTime: Map<string, number> = new Map();
  
  // Track refresh count per platform per second
  private refreshCountPerSecond: Map<string, { count: number; windowStart: number }> = new Map();

  private constructor() {
    // Listen to load state changes
    backpressureManager.on('loadStateChange', (event) => {
      this.handleLoadStateChange(event.newState);
    });
    
    logger.info('AdaptiveRefreshScheduler initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AdaptiveRefreshScheduler {
    if (!AdaptiveRefreshScheduler.instance) {
      AdaptiveRefreshScheduler.instance = new AdaptiveRefreshScheduler();
    }
    return AdaptiveRefreshScheduler.instance;
  }

  /**
   * Handle load state change
   */
  private handleLoadStateChange(newState: LoadState): void {
    this.currentLoadState = newState;
    
    logger.info('Refresh scheduler load state updated', {
      loadState: newState,
    });
  }

  /**
   * Check if refresh should be allowed
   * 
   * Returns:
   * - allowed: true if refresh should proceed
   * - reason: reason if not allowed
   * - delayMs: suggested delay if refresh should be delayed
   */
  shouldAllowRefresh(platform: string, expiresAt: Date): {
    allowed: boolean;
    reason?: string;
    delayMs?: number;
  } {
    const now = Date.now();
    const expiresAtTime = expiresAt.getTime();
    const minutesUntilExpiry = (expiresAtTime - now) / (1000 * 60);
    
    // Check priority based on load state
    const priorityCheck = this.checkPriority(minutesUntilExpiry);
    if (!priorityCheck.allowed) {
      return priorityCheck;
    }
    
    // Check rate limit
    const rateLimitCheck = this.checkRateLimit(platform);
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck;
    }
    
    return { allowed: true };
  }

  /**
   * Check priority based on load state
   */
  private checkPriority(minutesUntilExpiry: number): {
    allowed: boolean;
    reason?: string;
    delayMs?: number;
  } {
    const config = ResilienceConfig.REFRESH_THROTTLE;
    
    switch (this.currentLoadState) {
      case LoadState.LOW_LOAD:
      case LoadState.ELEVATED_LOAD:
        // Prioritize tokens expiring <1hr
        if (minutesUntilExpiry > config.priorityThresholdHours * 60) {
          return {
            allowed: false,
            reason: 'Token not expiring soon enough',
            delayMs: 60000, // 1 minute
          };
        }
        return { allowed: true };
        
      case LoadState.HIGH_LOAD:
        // Only refresh tokens expiring <30min
        if (minutesUntilExpiry > config.highLoadThresholdMinutes) {
          return {
            allowed: false,
            reason: 'High load - only refreshing tokens expiring soon',
            delayMs: 120000, // 2 minutes
          };
        }
        return { allowed: true };
        
      case LoadState.CRITICAL_LOAD:
        // Only refresh tokens expiring <10min
        if (minutesUntilExpiry > config.criticalLoadThresholdMinutes) {
          return {
            allowed: false,
            reason: 'Critical load - only refreshing tokens expiring very soon',
            delayMs: 300000, // 5 minutes
          };
        }
        return { allowed: true };
        
      default:
        return { allowed: true };
    }
  }

  /**
   * Check rate limit per platform
   */
  private checkRateLimit(platform: string): {
    allowed: boolean;
    reason?: string;
    delayMs?: number;
  } {
    const now = Date.now();
    const config = ResilienceConfig.REFRESH_THROTTLE;
    const maxPerSecond = config.maxRefreshPerSecondPerPlatform;
    
    // Get or initialize counter for this platform
    let counter = this.refreshCountPerSecond.get(platform);
    
    if (!counter || now - counter.windowStart >= 1000) {
      // New window
      counter = { count: 0, windowStart: now };
      this.refreshCountPerSecond.set(platform, counter);
    }
    
    // Check if rate limit exceeded
    if (counter.count >= maxPerSecond) {
      const delayMs = 1000 - (now - counter.windowStart) + config.jitterMs * Math.random();
      
      return {
        allowed: false,
        reason: `Rate limit exceeded for platform ${platform}`,
        delayMs: Math.ceil(delayMs),
      };
    }
    
    return { allowed: true };
  }

  /**
   * Record refresh attempt
   */
  recordRefresh(platform: string): void {
    const now = Date.now();
    
    // Update last refresh time
    this.lastRefreshTime.set(platform, now);
    
    // Increment counter
    let counter = this.refreshCountPerSecond.get(platform);
    
    if (!counter || now - counter.windowStart >= 1000) {
      counter = { count: 1, windowStart: now };
    } else {
      counter.count++;
    }
    
    this.refreshCountPerSecond.set(platform, counter);
    
    logger.debug('Refresh recorded', {
      platform,
      count: counter.count,
      windowStart: new Date(counter.windowStart).toISOString(),
    });
  }

  /**
   * Calculate delay with jitter
   */
  calculateDelayWithJitter(baseDelayMs: number): number {
    const jitter = ResilienceConfig.REFRESH_THROTTLE.jitterMs * Math.random();
    return Math.ceil(baseDelayMs + jitter);
  }

  /**
   * Get refresh priority
   */
  getRefreshPriority(expiresAt: Date): 'urgent' | 'high' | 'normal' | 'low' {
    const now = Date.now();
    const expiresAtTime = expiresAt.getTime();
    const minutesUntilExpiry = (expiresAtTime - now) / (1000 * 60);
    
    if (minutesUntilExpiry <= 10) {
      return 'urgent';
    } else if (minutesUntilExpiry <= 30) {
      return 'high';
    } else if (minutesUntilExpiry <= 60) {
      return 'normal';
    } else {
      return 'low';
    }
  }

  /**
   * Get scheduler metrics
   */
  getMetrics() {
    const platformMetrics: Record<string, any> = {};
    
    for (const [platform, counter] of this.refreshCountPerSecond.entries()) {
      platformMetrics[platform] = {
        refreshCount: counter.count,
        windowStart: new Date(counter.windowStart).toISOString(),
        lastRefresh: this.lastRefreshTime.get(platform) 
          ? new Date(this.lastRefreshTime.get(platform)!).toISOString()
          : null,
      };
    }
    
    return {
      currentLoadState: this.currentLoadState,
      maxRefreshPerSecond: ResilienceConfig.REFRESH_THROTTLE.maxRefreshPerSecondPerPlatform,
      platformMetrics,
    };
  }

  /**
   * Reset metrics (for testing)
   */
  reset(): void {
    this.lastRefreshTime.clear();
    this.refreshCountPerSecond.clear();
    logger.info('AdaptiveRefreshScheduler reset');
  }

  /**
   * Shutdown scheduler
   */
  shutdown(): void {
    backpressureManager.removeAllListeners('loadStateChange');
    logger.info('AdaptiveRefreshScheduler shutdown');
  }
}

// Export singleton instance
export const adaptiveRefreshScheduler = AdaptiveRefreshScheduler.getInstance();
