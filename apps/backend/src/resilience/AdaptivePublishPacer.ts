import { logger } from '../utils/logger';
import { LoadState, JobPriority } from './types';
import { ResilienceConfig } from './ResilienceConfig';
import { backpressureManager } from './BackpressureManager';

/**
 * Adaptive Publish Pacer
 * 
 * Dynamically adjusts worker concurrency based on system load with gradual ramping
 * 
 * Concurrency levels:
 * - LOW_LOAD: 5 concurrent jobs (normal)
 * - ELEVATED_LOAD: 4 concurrent jobs (-20%)
 * - HIGH_LOAD: 2 concurrent jobs (-50%)
 * - CRITICAL_LOAD: 0 concurrent jobs (pause)
 * 
 * Stability features:
 * - Gradual concurrency ramping (no instant jumps)
 * - Configurable ramp interval (default 5s)
 * - Configurable ramp step size (default 1 worker)
 * - Event-driven updates
 * - Job prioritization
 * - Admission control for non-critical jobs
 */

export class AdaptivePublishPacer {
  private static instance: AdaptivePublishPacer;
  
  private currentConcurrency: number;
  private targetConcurrency: number;
  private currentLoadState: LoadState = LoadState.LOW_LOAD;
  
  private rampInterval: NodeJS.Timeout | null = null;
  private concurrencyRampCount: number = 0;

  private constructor() {
    // Initialize with normal concurrency
    this.currentConcurrency = ResilienceConfig.PUBLISH_PACING.normalConcurrency;
    this.targetConcurrency = this.currentConcurrency;
    
    // Listen to load state changes
    backpressureManager.on('loadStateChange', (event) => {
      this.handleLoadStateChange(event.newState);
    });
    
    // Start concurrency ramping
    this.startConcurrencyRamping();
    
    logger.info('AdaptivePublishPacer initialized with concurrency ramping', {
      initialConcurrency: this.currentConcurrency,
      rampIntervalMs: ResilienceConfig.CONTROL_LOOP.rampIntervalMs,
      rampStepSize: ResilienceConfig.CONTROL_LOOP.rampStepSize,
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AdaptivePublishPacer {
    if (!AdaptivePublishPacer.instance) {
      AdaptivePublishPacer.instance = new AdaptivePublishPacer();
    }
    return AdaptivePublishPacer.instance;
  }

  /**
   * Handle load state change
   */
  private handleLoadStateChange(newState: LoadState): void {
    const previousTarget = this.targetConcurrency;
    this.currentLoadState = newState;
    
    // Update target concurrency based on load state
    switch (newState) {
      case LoadState.LOW_LOAD:
        this.targetConcurrency = ResilienceConfig.PUBLISH_PACING.normalConcurrency;
        break;
      case LoadState.ELEVATED_LOAD:
        this.targetConcurrency = ResilienceConfig.PUBLISH_PACING.elevatedConcurrency;
        break;
      case LoadState.HIGH_LOAD:
        this.targetConcurrency = ResilienceConfig.PUBLISH_PACING.highConcurrency;
        break;
      case LoadState.CRITICAL_LOAD:
        this.targetConcurrency = ResilienceConfig.PUBLISH_PACING.criticalConcurrency;
        break;
    }
    
    if (previousTarget !== this.targetConcurrency) {
      logger.info('Target concurrency updated', {
        loadState: newState,
        previousTarget,
        newTarget: this.targetConcurrency,
        currentConcurrency: this.currentConcurrency,
      });
    }
  }

  /**
   * Start concurrency ramping
   */
  private startConcurrencyRamping(): void {
    if (this.rampInterval) {
      return;
    }
    
    this.rampInterval = setInterval(() => {
      this.rampConcurrency();
    }, ResilienceConfig.CONTROL_LOOP.rampIntervalMs);
    
    logger.info('Concurrency ramping started', {
      intervalMs: ResilienceConfig.CONTROL_LOOP.rampIntervalMs,
    });
  }

  /**
   * Stop concurrency ramping
   */
  private stopConcurrencyRamping(): void {
    if (this.rampInterval) {
      clearInterval(this.rampInterval);
      this.rampInterval = null;
      logger.info('Concurrency ramping stopped');
    }
  }

  /**
   * Ramp concurrency towards target
   */
  private rampConcurrency(): void {
    if (this.currentConcurrency === this.targetConcurrency) {
      return;
    }
    
    const previousConcurrency = this.currentConcurrency;
    const stepSize = ResilienceConfig.CONTROL_LOOP.rampStepSize;
    
    if (this.currentConcurrency < this.targetConcurrency) {
      // Ramp up
      this.currentConcurrency = Math.min(
        this.currentConcurrency + stepSize,
        this.targetConcurrency
      );
    } else {
      // Ramp down
      this.currentConcurrency = Math.max(
        this.currentConcurrency - stepSize,
        this.targetConcurrency
      );
    }
    
    if (previousConcurrency !== this.currentConcurrency) {
      this.concurrencyRampCount++;
      
      logger.info('Concurrency ramped', {
        previousConcurrency,
        newConcurrency: this.currentConcurrency,
        targetConcurrency: this.targetConcurrency,
        loadState: this.currentLoadState,
        rampCount: this.concurrencyRampCount,
      });
    }
  }

  /**
   * Get current concurrency
   */
  getCurrentConcurrency(): number {
    return this.currentConcurrency;
  }

  /**
   * Get target concurrency
   */
  getTargetConcurrency(): number {
    return this.targetConcurrency;
  }

  /**
   * Get current load state
   */
  getCurrentLoadState(): LoadState {
    return this.currentLoadState;
  }

  /**
   * Check if job should be admitted
   * 
   * Returns:
   * - admitted: true if job should be processed
   * - reason: reason if not admitted
   * - delayMs: suggested delay if job should be delayed
   */
  shouldAdmitJob(priority: 'low' | 'normal' | 'high' | 'critical'): {
    admitted: boolean;
    reason?: string;
    delayMs?: number;
  } {
    // Always admit critical jobs
    if (priority === 'critical') {
      return { admitted: true };
    }
    
    // Check load state
    switch (this.currentLoadState) {
      case LoadState.LOW_LOAD:
        // Admit all jobs
        return { admitted: true };
        
      case LoadState.ELEVATED_LOAD:
        // Delay low priority jobs
        if (priority === 'low') {
          return {
            admitted: false,
            reason: 'Low priority job delayed due to elevated load',
            delayMs: ResilienceConfig.PUBLISH_PACING.delayNonCriticalMs,
          };
        }
        return { admitted: true };
        
      case LoadState.HIGH_LOAD:
        // Delay low and normal priority jobs
        if (priority === 'low' || priority === 'normal') {
          return {
            admitted: false,
            reason: 'Non-critical job delayed due to high load',
            delayMs: ResilienceConfig.PUBLISH_PACING.delayNonCriticalMs * 2,
          };
        }
        return { admitted: true };
        
      case LoadState.CRITICAL_LOAD:
        // Only admit critical and high priority jobs
        if (priority === 'low' || priority === 'normal') {
          return {
            admitted: false,
            reason: 'Non-critical job rejected due to critical load',
            delayMs: ResilienceConfig.PUBLISH_PACING.delayNonCriticalMs * 4,
          };
        }
        return { admitted: true };
        
      default:
        return { admitted: true };
    }
  }

  /**
   * Determine job priority
   * 
   * Priority rules:
   * - critical: Scheduled within 5 minutes
   * - high: Scheduled within 30 minutes
   * - normal: Scheduled within 24 hours
   * - low: Scheduled > 24 hours
   */
  determineJobPriority(scheduledAt: Date): 'low' | 'normal' | 'high' | 'critical' {
    const now = Date.now();
    const scheduledTime = scheduledAt.getTime();
    const minutesUntilScheduled = (scheduledTime - now) / (1000 * 60);
    
    if (minutesUntilScheduled <= 5) {
      return 'critical';
    } else if (minutesUntilScheduled <= 30) {
      return 'high';
    } else if (minutesUntilScheduled <= 24 * 60) {
      return 'normal';
    } else {
      return 'low';
    }
  }

  /**
   * Check if system is paused
   */
  isPaused(): boolean {
    return this.currentConcurrency === 0;
  }

  /**
   * Get pacing metrics
   */
  getMetrics() {
    return {
      currentConcurrency: this.currentConcurrency,
      targetConcurrency: this.targetConcurrency,
      currentLoadState: this.currentLoadState,
      isPaused: this.isPaused(),
      concurrencyRampCount: this.concurrencyRampCount,
      normalConcurrency: ResilienceConfig.PUBLISH_PACING.normalConcurrency,
      elevatedConcurrency: ResilienceConfig.PUBLISH_PACING.elevatedConcurrency,
      highConcurrency: ResilienceConfig.PUBLISH_PACING.highConcurrency,
      criticalConcurrency: ResilienceConfig.PUBLISH_PACING.criticalConcurrency,
    };
  }

  /**
   * Shutdown pacer
   */
  shutdown(): void {
    this.stopConcurrencyRamping();
    backpressureManager.removeAllListeners('loadStateChange');
    logger.info('AdaptivePublishPacer shutdown');
  }
}

// Export singleton instance
export const adaptivePublishPacer = AdaptivePublishPacer.getInstance();
