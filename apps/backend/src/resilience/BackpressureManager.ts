import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { LoadState, BackpressureMetrics, LoadStateChangeEvent, StateTransitionRecord } from './types';
import { ResilienceConfig } from './ResilienceConfig';
import { QueueManager } from '../queue/QueueManager';
import { retryStormProtectionService } from '../services/RetryStormProtectionService';
import { globalRateLimitManager } from '../services/GlobalRateLimitManager';

/**
 * Backpressure Manager
 * 
 * Monitors system load and emits state change events with stable control loop
 * 
 * Load calculation:
 * score = (queueDepth * 0.3) + (retryRate * 0.3) + (rateLimitHits * 0.2) + (refreshBacklog * 0.2)
 * 
 * Load states with hysteresis bands:
 * - LOW_LOAD → ELEVATED_LOAD: enter at 45, exit at 35
 * - ELEVATED_LOAD → HIGH_LOAD: enter at 65, exit at 55
 * - HIGH_LOAD → CRITICAL_LOAD: enter at 85, exit at 75
 * 
 * Stability features:
 * - EMA load smoothing (alpha=0.2)
 * - Hysteresis bands (enter/exit thresholds)
 * - Minimum dwell time per state
 * - Global transition cooldown
 * - Oscillation detection and freeze
 * - Event-driven state changes
 */

export class BackpressureManager extends EventEmitter {
  private static instance: BackpressureManager;
  
  private currentState: LoadState = LoadState.LOW_LOAD;
  private stateEnteredAt: number = Date.now();
  private lastTransitionAt: number = 0;
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastMetrics: BackpressureMetrics | null = null;
  
  // EMA smoothing
  private smoothedLoadScore: number = 0;
  private rawLoadScore: number = 0;
  
  // Oscillation detection
  private transitionHistory: StateTransitionRecord[] = [];
  private oscillationFreezeUntil: number = 0;
  private oscillationDetectedCount: number = 0;

  private constructor() {
    super();
    logger.info('BackpressureManager initialized with stable control loop', {
      emaAlpha: ResilienceConfig.CONTROL_LOOP.emaAlpha,
      transitionCooldownMs: ResilienceConfig.CONTROL_LOOP.transitionCooldownMs,
      oscillationThreshold: ResilienceConfig.CONTROL_LOOP.oscillationThreshold,
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): BackpressureManager {
    if (!BackpressureManager.instance) {
      BackpressureManager.instance = new BackpressureManager();
    }
    return BackpressureManager.instance;
  }

  /**
   * Start monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      logger.warn('BackpressureManager already monitoring');
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      await this.checkBackpressure();
    }, ResilienceConfig.MONITORING.backpressureCheckIntervalMs);

    logger.info('BackpressureManager monitoring started', {
      intervalMs: ResilienceConfig.MONITORING.backpressureCheckIntervalMs,
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('BackpressureManager monitoring stopped');
    }
  }

  /**
   * Check backpressure and update state
   */
  private async checkBackpressure(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();
      
      // Apply EMA smoothing to load score
      this.rawLoadScore = metrics.systemLoadScore;
      this.smoothedLoadScore = this.applyEMA(this.rawLoadScore, this.smoothedLoadScore);
      
      // Add smoothed scores to metrics
      metrics.rawLoadScore = this.rawLoadScore;
      metrics.smoothedLoadScore = this.smoothedLoadScore;
      metrics.stateDurationMs = Date.now() - this.stateEnteredAt;
      metrics.transitionsPastMinute = this.getTransitionCountInWindow(ResilienceConfig.CONTROL_LOOP.oscillationWindowMs);
      metrics.oscillationDetected = this.isOscillationFrozen();
      
      this.lastMetrics = metrics;
      
      // Check if we can transition (cooldown, dwell time, oscillation freeze)
      if (!this.canTransition()) {
        logger.debug('Transition blocked', {
          currentState: this.currentState,
          smoothedLoadScore: this.smoothedLoadScore,
          reason: this.getTransitionBlockReason(),
        });
        return;
      }
      
      // Calculate new state using smoothed load score and hysteresis
      const newState = this.calculateLoadStateWithHysteresis(this.smoothedLoadScore);
      
      if (newState !== this.currentState) {
        this.transitionToState(newState, metrics);
      }
      
      logger.debug('Backpressure check complete', {
        currentState: this.currentState,
        rawLoadScore: this.rawLoadScore,
        smoothedLoadScore: this.smoothedLoadScore,
        stateDurationMs: metrics.stateDurationMs,
        transitionsPastMinute: metrics.transitionsPastMinute,
        oscillationFrozen: this.isOscillationFrozen(),
      });
    } catch (error: any) {
      logger.error('Error checking backpressure', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Collect backpressure metrics
   */
  private async collectMetrics(): Promise<BackpressureMetrics> {
    const queueManager = QueueManager.getInstance();
    
    // Get queue stats
    const postingQueueStats = await queueManager.getQueueStats('posting-queue');
    const refreshQueueStats = await queueManager.getQueueStats('refresh-queue');
    
    // Queue depth (waiting + delayed jobs)
    const queueDepth = postingQueueStats.waiting + postingQueueStats.delayed;
    
    // Active workers (active jobs)
    const activeWorkers = postingQueueStats.active;
    
    // Worker capacity (assume 5 workers with 5 concurrency each = 25 total)
    const workerCapacity = 25;
    
    // Retry rate (from retry storm protection service)
    const retryStats = await retryStormProtectionService.getRetryStats();
    const retryRate = retryStats.global;
    
    // Rate limit hits (from global rate limit manager)
    const rateLimitStats = await globalRateLimitManager.getStats();
    const rateLimitHits = rateLimitStats.accountsLimited + rateLimitStats.platformsLimited;
    
    // Refresh backlog (waiting + delayed in refresh queue)
    const refreshBacklog = refreshQueueStats.waiting + refreshQueueStats.delayed;
    
    // Calculate system load score
    const systemLoadScore = this.calculateLoadScore({
      queueDepth,
      retryRate,
      rateLimitHits,
      refreshBacklog,
    });
    
    return {
      queueDepth,
      activeWorkers,
      workerCapacity,
      retryRate,
      rateLimitHits,
      refreshBacklog,
      systemLoadScore,
      loadState: this.currentState,
    };
  }

  /**
   * Calculate load score from metrics
   * 
   * Formula: score = (queueDepth * 0.3) + (retryRate * 0.3) + (rateLimitHits * 0.2) + (refreshBacklog * 0.2)
   * 
   * Normalized to 0-100 scale
   */
  private calculateLoadScore(metrics: {
    queueDepth: number;
    retryRate: number;
    rateLimitHits: number;
    refreshBacklog: number;
  }): number {
    const weights = ResilienceConfig.LOAD_WEIGHTS;
    
    // Normalize each metric to 0-100 scale
    const normalizedQueueDepth = Math.min(metrics.queueDepth / 100, 1) * 100;
    const normalizedRetryRate = Math.min(metrics.retryRate / 100, 1) * 100;
    const normalizedRateLimitHits = Math.min(metrics.rateLimitHits / 10, 1) * 100;
    const normalizedRefreshBacklog = Math.min(metrics.refreshBacklog / 50, 1) * 100;
    
    const score = 
      (normalizedQueueDepth * weights.queueDepth) +
      (normalizedRetryRate * weights.retryRate) +
      (normalizedRateLimitHits * weights.rateLimitHits) +
      (normalizedRefreshBacklog * weights.refreshBacklog);
    
    return Math.round(score);
  }

  /**
   * Calculate load state from score with hysteresis
   */
  private calculateLoadStateWithHysteresis(smoothedScore: number): LoadState {
    const thresholds = ResilienceConfig.LOAD_THRESHOLDS;
    
    switch (this.currentState) {
      case LoadState.LOW_LOAD:
        // Can only transition to ELEVATED
        if (smoothedScore >= thresholds.LOW_TO_ELEVATED_ENTER) {
          return LoadState.ELEVATED_LOAD;
        }
        return LoadState.LOW_LOAD;
        
      case LoadState.ELEVATED_LOAD:
        // Can transition to LOW or HIGH
        if (smoothedScore <= thresholds.ELEVATED_TO_LOW_EXIT) {
          return LoadState.LOW_LOAD;
        } else if (smoothedScore >= thresholds.ELEVATED_TO_HIGH_ENTER) {
          return LoadState.HIGH_LOAD;
        }
        return LoadState.ELEVATED_LOAD;
        
      case LoadState.HIGH_LOAD:
        // Can transition to ELEVATED or CRITICAL
        if (smoothedScore <= thresholds.HIGH_TO_ELEVATED_EXIT) {
          return LoadState.ELEVATED_LOAD;
        } else if (smoothedScore >= thresholds.HIGH_TO_CRITICAL_ENTER) {
          return LoadState.CRITICAL_LOAD;
        }
        return LoadState.HIGH_LOAD;
        
      case LoadState.CRITICAL_LOAD:
        // Can only transition to HIGH
        if (smoothedScore <= thresholds.CRITICAL_TO_HIGH_EXIT) {
          return LoadState.HIGH_LOAD;
        }
        return LoadState.CRITICAL_LOAD;
        
      default:
        return this.currentState;
    }
  }

  /**
   * Apply Exponential Moving Average (EMA) smoothing
   * 
   * Formula: smoothed = alpha * raw + (1 - alpha) * previousSmoothed
   */
  private applyEMA(rawValue: number, previousSmoothed: number): number {
    const alpha = ResilienceConfig.CONTROL_LOOP.emaAlpha;
    return alpha * rawValue + (1 - alpha) * previousSmoothed;
  }

  /**
   * Check if state transition is allowed
   */
  private canTransition(): boolean {
    const now = Date.now();
    
    // Check oscillation freeze
    if (this.isOscillationFrozen()) {
      return false;
    }
    
    // Check global cooldown
    const timeSinceLastTransition = now - this.lastTransitionAt;
    if (timeSinceLastTransition < ResilienceConfig.CONTROL_LOOP.transitionCooldownMs) {
      return false;
    }
    
    // Check minimum dwell time for current state
    const dwellTime = this.getMinimumDwellTime(this.currentState);
    const timeInCurrentState = now - this.stateEnteredAt;
    if (timeInCurrentState < dwellTime) {
      return false;
    }
    
    return true;
  }

  /**
   * Get minimum dwell time for a state
   */
  private getMinimumDwellTime(state: LoadState): number {
    const config = ResilienceConfig.CONTROL_LOOP;
    
    switch (state) {
      case LoadState.LOW_LOAD:
        return config.dwellTimeLowMs;
      case LoadState.ELEVATED_LOAD:
        return config.dwellTimeElevatedMs;
      case LoadState.HIGH_LOAD:
        return config.dwellTimeHighMs;
      case LoadState.CRITICAL_LOAD:
        return config.dwellTimeCriticalMs;
      default:
        return 0;
    }
  }

  /**
   * Check if oscillation freeze is active
   */
  private isOscillationFrozen(): boolean {
    return Date.now() < this.oscillationFreezeUntil;
  }

  /**
   * Get reason for transition block
   */
  private getTransitionBlockReason(): string {
    const now = Date.now();
    
    if (this.isOscillationFrozen()) {
      const remainingMs = this.oscillationFreezeUntil - now;
      return `Oscillation freeze active (${Math.round(remainingMs / 1000)}s remaining)`;
    }
    
    const timeSinceLastTransition = now - this.lastTransitionAt;
    const cooldown = ResilienceConfig.CONTROL_LOOP.transitionCooldownMs;
    if (timeSinceLastTransition < cooldown) {
      const remainingMs = cooldown - timeSinceLastTransition;
      return `Global cooldown active (${Math.round(remainingMs / 1000)}s remaining)`;
    }
    
    const dwellTime = this.getMinimumDwellTime(this.currentState);
    const timeInCurrentState = now - this.stateEnteredAt;
    if (timeInCurrentState < dwellTime) {
      const remainingMs = dwellTime - timeInCurrentState;
      return `Minimum dwell time not met (${Math.round(remainingMs / 1000)}s remaining)`;
    }
    
    return 'Unknown';
  }

  /**
   * Get transition count in time window
   */
  private getTransitionCountInWindow(windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    return this.transitionHistory.filter(t => t.timestamp.getTime() > cutoff).length;
  }

  /**
   * Detect oscillation pattern
   */
  private detectOscillation(): boolean {
    const windowMs = ResilienceConfig.CONTROL_LOOP.oscillationWindowMs;
    const threshold = ResilienceConfig.CONTROL_LOOP.oscillationThreshold;
    
    const recentTransitions = this.getTransitionCountInWindow(windowMs);
    
    if (recentTransitions >= threshold) {
      logger.warn('Oscillation detected', {
        transitionsInWindow: recentTransitions,
        windowMs,
        threshold,
        freezeDurationMs: ResilienceConfig.CONTROL_LOOP.oscillationFreezeMs,
      });
      
      this.oscillationDetectedCount++;
      this.oscillationFreezeUntil = Date.now() + ResilienceConfig.CONTROL_LOOP.oscillationFreezeMs;
      
      return true;
    }
    
    return false;
  }

  /**
   * Transition to new state
   */
  private transitionToState(newState: LoadState, metrics: BackpressureMetrics): void {
    const previousState = this.currentState;
    const now = Date.now();
    
    // Record transition
    const transition: StateTransitionRecord = {
      fromState: previousState,
      toState: newState,
      timestamp: new Date(),
      rawLoadScore: this.rawLoadScore,
      smoothedLoadScore: this.smoothedLoadScore,
      reason: this.getStateChangeReason(metrics),
    };
    
    this.transitionHistory.push(transition);
    
    // Trim history to last 100 transitions
    if (this.transitionHistory.length > 100) {
      this.transitionHistory = this.transitionHistory.slice(-100);
    }
    
    // Update state
    this.currentState = newState;
    this.stateEnteredAt = now;
    this.lastTransitionAt = now;
    
    // Detect oscillation
    this.detectOscillation();
    
    const event: LoadStateChangeEvent = {
      previousState,
      newState,
      timestamp: new Date(),
      metrics,
      reason: transition.reason,
      rawLoadScore: this.rawLoadScore,
      smoothedLoadScore: this.smoothedLoadScore,
    };
    
    logger.warn('Load state changed', {
      previousState,
      newState,
      rawLoadScore: this.rawLoadScore,
      smoothedLoadScore: this.smoothedLoadScore,
      queueDepth: metrics.queueDepth,
      retryRate: metrics.retryRate,
      rateLimitHits: metrics.rateLimitHits,
      refreshBacklog: metrics.refreshBacklog,
      reason: event.reason,
      transitionsPastMinute: this.getTransitionCountInWindow(60000),
    });
    
    // Emit event
    this.emit('loadStateChange', event);
  }

  /**
   * Get reason for state change
   */
  private getStateChangeReason(metrics: BackpressureMetrics): string {
    const reasons: string[] = [];
    
    if (metrics.queueDepth > 50) {
      reasons.push(`High queue depth: ${metrics.queueDepth}`);
    }
    
    if (metrics.retryRate > 50) {
      reasons.push(`High retry rate: ${metrics.retryRate}/min`);
    }
    
    if (metrics.rateLimitHits > 5) {
      reasons.push(`Rate limit hits: ${metrics.rateLimitHits}`);
    }
    
    if (metrics.refreshBacklog > 20) {
      reasons.push(`Refresh backlog: ${metrics.refreshBacklog}`);
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'System load score threshold exceeded';
  }

  /**
   * Get current state
   */
  getCurrentState(): LoadState {
    return this.currentState;
  }

  /**
   * Get last metrics
   */
  getLastMetrics(): BackpressureMetrics | null {
    return this.lastMetrics;
  }

  /**
   * Get raw load score
   */
  getRawLoadScore(): number {
    return this.rawLoadScore;
  }

  /**
   * Get smoothed load score
   */
  getSmoothedLoadScore(): number {
    return this.smoothedLoadScore;
  }

  /**
   * Get transition history
   */
  getTransitionHistory(): StateTransitionRecord[] {
    return [...this.transitionHistory];
  }

  /**
   * Get oscillation metrics
   */
  getOscillationMetrics() {
    return {
      oscillationDetectedCount: this.oscillationDetectedCount,
      oscillationFrozen: this.isOscillationFrozen(),
      oscillationFreezeUntil: this.oscillationFreezeUntil,
      transitionsPastMinute: this.getTransitionCountInWindow(60000),
    };
  }

  /**
   * Get state duration
   */
  getStateDurationMs(): number {
    return Date.now() - this.stateEnteredAt;
  }

  /**
   * Force state change (for testing)
   */
  forceState(state: LoadState): void {
    const previousState = this.currentState;
    this.currentState = state;
    
    logger.warn('Load state forced', {
      previousState,
      newState: state,
    });
    
    if (this.lastMetrics) {
      const event: LoadStateChangeEvent = {
        previousState,
        newState: state,
        timestamp: new Date(),
        metrics: { ...this.lastMetrics, loadState: state },
        reason: 'Forced state change',
      };
      
      this.emit('loadStateChange', event);
    }
  }

  /**
   * Shutdown manager
   */
  shutdown(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    logger.info('BackpressureManager shutdown');
  }
}

// Export singleton instance
export const backpressureManager = BackpressureManager.getInstance();
