import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { DegradedModeState, DegradedModeMetrics, DegradedModeChangeEvent, LoadState } from './types';
import { ResilienceConfig } from './ResilienceConfig';
import { latencyTracker } from './LatencyTracker';
import { backpressureManager } from './BackpressureManager';
import { retryStormProtectionService } from '../services/RetryStormProtectionService';
import { getRedisClient } from '../config/redis';

/**
 * Degraded Mode Manager
 * 
 * Triggers degraded mode when system is under extreme stress
 * 
 * Trigger conditions:
 * - P99 latency >5s sustained for 2 minutes
 * - Queue lag >60s sustained for 2 minutes
 * - Retry storm exceeded threshold
 * 
 * Overload Freeze (RFC-005):
 * - Activates when BOTH high rejection rate AND system stress (load_state >= HIGH_LOAD)
 * - OR when oscillation detected under load
 * - Budget exhaustion alone does NOT trigger freeze
 * - Governance vs stability separation enforced
 * 
 * Degraded mode actions:
 * - Disable analytics recording
 * - Pause non-essential operations
 * - Slow publish pacing
 * - Aggressive rate-limit backoff
 * 
 * Recovery:
 * - Auto-exit after stable 5 minutes
 * 
 * Features:
 * - Event-driven state changes
 * - Configurable triggers
 * - Automatic recovery
 * - Metrics tracking
 * - Overload freeze with Redis key
 */

export interface OverloadFreezeMetrics {
  active: boolean;
  activatedAt: number | null;
  expiresAt: number | null;
  reason: string | null;
  activationCount: number;
  totalDurationMs: number;
  currentDurationMs: number;
}

export class DegradedModeManager extends EventEmitter {
  private static instance: DegradedModeManager;
  
  private currentState: DegradedModeState = DegradedModeState.NORMAL;
  private enteredAt: Date | null = null;
  private exitedAt: Date | null = null;
  private triggers: string[] = [];
  
  // Monitoring
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  // Sustained condition tracking
  private p99LatencyHighSince: Date | null = null;
  private queueLagHighSince: Date | null = null;
  
  // Recovery tracking
  private stableSince: Date | null = null;
  
  // Overload freeze state (RFC-005)
  private overloadFreezeActive: boolean = false;
  private overloadFreezeActivatedAt: number | null = null;
  private overloadFreezeExpiresAt: number | null = null;
  private lastFreezeDeactivatedAt: number | null = null;
  private overloadFreezeReason: string | null = null;
  
  // Overload freeze metrics
  private freezeActivationCount: number = 0;
  private freezeTotalDurationMs: number = 0;
  
  // Redis client for freeze key
  private redis: ReturnType<typeof getRedisClient>;
  
  // Freeze configuration
  private readonly FREEZE_KEY = 'publish:freeze:overload';
  private readonly FREEZE_REJECTION_THRESHOLD = 0.3; // 30%
  private readonly FREEZE_MINIMUM_DURATION_MS = 30000; // 30 seconds
  private readonly FREEZE_MAXIMUM_DURATION_MS = 300000; // 5 minutes
  private readonly FREEZE_COOLDOWN_MS = 60000; // 1 minute

  private constructor() {
    super();
    this.redis = getRedisClient();
    logger.info('DegradedModeManager initialized with RFC-005 overload freeze');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DegradedModeManager {
    if (!DegradedModeManager.instance) {
      DegradedModeManager.instance = new DegradedModeManager();
    }
    return DegradedModeManager.instance;
  }

  /**
   * Start monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      logger.warn('DegradedModeManager already monitoring');
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      await this.checkDegradedMode();
    }, ResilienceConfig.MONITORING.degradedModeCheckIntervalMs);

    logger.info('DegradedModeManager monitoring started', {
      intervalMs: ResilienceConfig.MONITORING.degradedModeCheckIntervalMs,
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('DegradedModeManager monitoring stopped');
    }
  }

  /**
   * Check degraded mode conditions
   */
  private async checkDegradedMode(): Promise<void> {
    try {
      const config = ResilienceConfig.DEGRADED_MODE;
      const now = new Date();
      
      // Get metrics
      const latencyMetrics = latencyTracker.getMetrics();
      const backpressureMetrics = backpressureManager.getLastMetrics();
      const retryStats = await retryStormProtectionService.getRetryStats();
      
      // Check triggers
      const newTriggers: string[] = [];
      
      // 1. Check P99 latency
      const p99PublishLatency = latencyMetrics.publish.p99;
      if (p99PublishLatency > config.p99LatencyThresholdMs) {
        if (!this.p99LatencyHighSince) {
          this.p99LatencyHighSince = now;
        } else {
          const durationMs = now.getTime() - this.p99LatencyHighSince.getTime();
          const sustainedSeconds = durationMs / 1000;
          
          if (sustainedSeconds >= config.p99LatencySustainedSeconds) {
            newTriggers.push(`P99 latency ${p99PublishLatency}ms sustained for ${Math.round(sustainedSeconds)}s`);
          }
        }
      } else {
        this.p99LatencyHighSince = null;
      }
      
      // 2. Check queue lag
      const queueLag = latencyMetrics.queueLag.p99 / 1000; // Convert to seconds
      if (queueLag > config.queueLagThresholdSeconds) {
        if (!this.queueLagHighSince) {
          this.queueLagHighSince = now;
        } else {
          const durationMs = now.getTime() - this.queueLagHighSince.getTime();
          const sustainedSeconds = durationMs / 1000;
          
          if (sustainedSeconds >= config.queueLagSustainedSeconds) {
            newTriggers.push(`Queue lag ${Math.round(queueLag)}s sustained for ${Math.round(sustainedSeconds)}s`);
          }
        }
      } else {
        this.queueLagHighSince = null;
      }
      
      // 3. Check retry storm
      const globalRetries = retryStats.global;
      if (globalRetries > config.retryStormThreshold) {
        newTriggers.push(`Retry storm detected: ${globalRetries} retries/min`);
      }
      
      // State machine
      switch (this.currentState) {
        case DegradedModeState.NORMAL:
          if (newTriggers.length > 0) {
            // Enter degraded mode
            this.enterDegradedMode(newTriggers);
          }
          break;
          
        case DegradedModeState.DEGRADED:
          if (newTriggers.length > 0) {
            // Still degraded, update triggers
            this.triggers = newTriggers;
            this.stableSince = null;
          } else {
            // Conditions cleared, start recovery
            this.startRecovery();
          }
          break;
          
        case DegradedModeState.RECOVERING:
          if (newTriggers.length > 0) {
            // Conditions returned, back to degraded
            this.enterDegradedMode(newTriggers);
          } else {
            // Check if stable long enough
            if (!this.stableSince) {
              this.stableSince = now;
            } else {
              const stableDurationMs = now.getTime() - this.stableSince.getTime();
              const stableSeconds = stableDurationMs / 1000;
              
              if (stableSeconds >= config.recoveryStableSeconds) {
                // Exit degraded mode
                this.exitDegradedMode();
              }
            }
          }
          break;
      }
      
      logger.debug('Degraded mode check complete', {
        currentState: this.currentState,
        p99PublishLatency,
        queueLag: Math.round(queueLag),
        globalRetries,
        triggers: newTriggers,
        stableSince: this.stableSince?.toISOString(),
      });
    } catch (error: any) {
      logger.error('Error checking degraded mode', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Enter degraded mode
   */
  private enterDegradedMode(triggers: string[]): void {
    const previousState = this.currentState;
    this.currentState = DegradedModeState.DEGRADED;
    this.enteredAt = new Date();
    this.triggers = triggers;
    this.stableSince = null;
    
    const event: DegradedModeChangeEvent = {
      previousState,
      newState: DegradedModeState.DEGRADED,
      timestamp: this.enteredAt,
      triggers,
      reason: triggers.join(', '),
    };
    
    logger.error('DEGRADED MODE ACTIVATED', {
      previousState,
      triggers,
      enteredAt: this.enteredAt.toISOString(),
    });
    
    // Emit event
    this.emit('degradedModeChange', event);
  }

  /**
   * Start recovery
   */
  private startRecovery(): void {
    const previousState = this.currentState;
    this.currentState = DegradedModeState.RECOVERING;
    this.stableSince = new Date();
    
    const event: DegradedModeChangeEvent = {
      previousState,
      newState: DegradedModeState.RECOVERING,
      timestamp: this.stableSince,
      triggers: [],
      reason: 'Degraded mode conditions cleared, starting recovery',
    };
    
    logger.warn('Degraded mode recovery started', {
      previousState,
      stableSince: this.stableSince.toISOString(),
    });
    
    // Emit event
    this.emit('degradedModeChange', event);
  }

  /**
   * Exit degraded mode
   */
  private exitDegradedMode(): void {
    const previousState = this.currentState;
    this.currentState = DegradedModeState.NORMAL;
    this.exitedAt = new Date();
    
    const duration = this.enteredAt && this.exitedAt
      ? this.exitedAt.getTime() - this.enteredAt.getTime()
      : 0;
    
    const event: DegradedModeChangeEvent = {
      previousState,
      newState: DegradedModeState.NORMAL,
      timestamp: this.exitedAt,
      triggers: [],
      reason: 'System stable, exiting degraded mode',
    };
    
    logger.warn('DEGRADED MODE EXITED', {
      previousState,
      exitedAt: this.exitedAt.toISOString(),
      durationMs: duration,
      durationMinutes: Math.round(duration / 1000 / 60),
    });
    
    // Reset tracking
    this.enteredAt = null;
    this.triggers = [];
    this.stableSince = null;
    this.p99LatencyHighSince = null;
    this.queueLagHighSince = null;
    
    // Emit event
    this.emit('degradedModeChange', event);
  }

  /**
   * Get current state
   */
  getCurrentState(): DegradedModeState {
    return this.currentState;
  }

  /**
   * Check if in degraded mode
   */
  isDegraded(): boolean {
    return this.currentState === DegradedModeState.DEGRADED;
  }

  /**
   * Check if recovering
   */
  isRecovering(): boolean {
    return this.currentState === DegradedModeState.RECOVERING;
  }

  /**
   * Get degraded mode metrics
   */
  getMetrics(): DegradedModeMetrics {
    const duration = this.enteredAt && this.currentState !== DegradedModeState.NORMAL
      ? Date.now() - this.enteredAt.getTime()
      : this.enteredAt && this.exitedAt
      ? this.exitedAt.getTime() - this.enteredAt.getTime()
      : undefined;
    
    const recoveryProgress = this.stableSince && this.currentState === DegradedModeState.RECOVERING
      ? Math.min(
          ((Date.now() - this.stableSince.getTime()) / 1000) / ResilienceConfig.DEGRADED_MODE.recoveryStableSeconds,
          1.0
        )
      : 0;
    
    return {
      state: this.currentState,
      enteredAt: this.enteredAt || undefined,
      exitedAt: this.exitedAt || undefined,
      duration,
      triggers: [...this.triggers],
      recoveryProgress,
    };
  }

  /**
   * Force degraded mode (for testing)
   */
  forceDegradedMode(triggers: string[]): void {
    this.enterDegradedMode(triggers);
  }

  /**
   * Force normal mode (for testing)
   */
  forceNormalMode(): void {
    this.exitDegradedMode();
  }

  /**
   * Shutdown manager
   */
  shutdown(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    logger.info('DegradedModeManager shutdown');
  }
  
  /**
   * Evaluate overload freeze conditions (RFC-005)
   * 
   * Freeze activates ONLY if:
   * - (rejectionRate > threshold AND loadState >= HIGH_LOAD)
   * - OR (oscillationDetected AND loadState >= HIGH_LOAD)
   * 
   * Budget exhaustion alone does NOT trigger freeze
   * 
   * @param rejectionRate - Current rejection rate (0.0 to 1.0)
   * @param loadState - Current system load state
   * @param oscillationDetected - Whether oscillation is detected
   */
  async evaluateOverloadFreeze(
    rejectionRate: number,
    loadState: LoadState,
    oscillationDetected: boolean
  ): Promise<void> {
    const now = Date.now();
    
    try {
      // 1. If already frozen, check expiration
      if (this.overloadFreezeActive) {
        if (this.overloadFreezeExpiresAt && now > this.overloadFreezeExpiresAt) {
          await this.deactivateOverloadFreeze();
        }
        return;
      }
      
      // 2. Enforce cooldown
      if (this.lastFreezeDeactivatedAt) {
        const timeSinceDeactivation = now - this.lastFreezeDeactivatedAt;
        if (timeSinceDeactivation < this.FREEZE_COOLDOWN_MS) {
          logger.debug('Overload freeze cooldown active', {
            remainingMs: this.FREEZE_COOLDOWN_MS - timeSinceDeactivation,
          });
          return;
        }
      }
      
      // 3. Check activation conditions
      // Load state must be HIGH_LOAD or CRITICAL_LOAD
      if (loadState !== LoadState.HIGH_LOAD && loadState !== LoadState.CRITICAL_LOAD) {
        return;
      }
      
      // Condition A: High rejection rate under load
      if (rejectionRate > this.FREEZE_REJECTION_THRESHOLD) {
        await this.activateOverloadFreeze('HIGH_REJECTION_RATE');
        return;
      }
      
      // Condition B: Oscillation under load
      if (oscillationDetected) {
        await this.activateOverloadFreeze('OSCILLATION_UNDER_LOAD');
        return;
      }
    } catch (error: any) {
      logger.error('Error evaluating overload freeze', {
        error: error.message,
        stack: error.stack,
      });
    }
  }
  
  /**
   * Activate overload freeze
   * 
   * Sets Redis freeze key with TTL
   * 
   * @param reason - Reason for freeze activation
   */
  async activateOverloadFreeze(reason: string): Promise<void> {
    const now = Date.now();
    
    try {
      this.overloadFreezeActive = true;
      this.overloadFreezeActivatedAt = now;
      this.overloadFreezeExpiresAt = now + this.FREEZE_MAXIMUM_DURATION_MS;
      this.overloadFreezeReason = reason;
      this.freezeActivationCount++;
      
      // Set Redis freeze key with TTL
      const ttlSeconds = Math.ceil(this.FREEZE_MAXIMUM_DURATION_MS / 1000);
      await this.redis.setex(this.FREEZE_KEY, ttlSeconds, '1');
      
      logger.error('OVERLOAD FREEZE ACTIVATED', {
        reason,
        activatedAt: new Date(now).toISOString(),
        expiresAt: new Date(this.overloadFreezeExpiresAt).toISOString(),
        maximumDurationMs: this.FREEZE_MAXIMUM_DURATION_MS,
        activationCount: this.freezeActivationCount,
      });
      
      this.emit('overloadFreezeActivated', {
        reason,
        activatedAt: now,
        expiresAt: this.overloadFreezeExpiresAt,
      });
    } catch (error: any) {
      logger.error('Failed to activate overload freeze', {
        error: error.message,
        stack: error.stack,
      });
      
      // Reset state on failure
      this.overloadFreezeActive = false;
      this.overloadFreezeActivatedAt = null;
      this.overloadFreezeExpiresAt = null;
      this.overloadFreezeReason = null;
    }
  }
  
  /**
   * Deactivate overload freeze
   * 
   * Removes Redis freeze key
   */
  async deactivateOverloadFreeze(): Promise<void> {
    if (!this.overloadFreezeActive) {
      return;
    }
    
    const now = Date.now();
    
    try {
      // Check minimum duration
      if (this.overloadFreezeActivatedAt) {
        const duration = now - this.overloadFreezeActivatedAt;
        if (duration < this.FREEZE_MINIMUM_DURATION_MS) {
          logger.debug('Overload freeze minimum duration not met', {
            durationMs: duration,
            minimumMs: this.FREEZE_MINIMUM_DURATION_MS,
          });
          return;
        }
        
        // Track total duration
        this.freezeTotalDurationMs += duration;
      }
      
      // Remove Redis freeze key
      await this.redis.del(this.FREEZE_KEY);
      
      const previousReason = this.overloadFreezeReason;
      const duration = this.overloadFreezeActivatedAt
        ? now - this.overloadFreezeActivatedAt
        : 0;
      
      this.overloadFreezeActive = false;
      this.overloadFreezeActivatedAt = null;
      this.overloadFreezeExpiresAt = null;
      this.overloadFreezeReason = null;
      this.lastFreezeDeactivatedAt = now;
      
      logger.warn('OVERLOAD FREEZE DEACTIVATED', {
        previousReason,
        durationMs: duration,
        durationSeconds: Math.round(duration / 1000),
        deactivatedAt: new Date(now).toISOString(),
      });
      
      this.emit('overloadFreezeDeactivated', {
        reason: previousReason,
        durationMs: duration,
        deactivatedAt: now,
      });
    } catch (error: any) {
      logger.error('Failed to deactivate overload freeze', {
        error: error.message,
        stack: error.stack,
      });
    }
  }
  
  /**
   * Check if overload freeze is active
   * 
   * @returns True if freeze is active
   */
  isOverloadFrozen(): boolean {
    return this.overloadFreezeActive;
  }
  
  /**
   * Get overload freeze metrics
   * 
   * @returns Freeze metrics
   */
  getOverloadFreezeMetrics(): OverloadFreezeMetrics {
    const currentDurationMs = this.overloadFreezeActive && this.overloadFreezeActivatedAt
      ? Date.now() - this.overloadFreezeActivatedAt
      : 0;
    
    return {
      active: this.overloadFreezeActive,
      activatedAt: this.overloadFreezeActivatedAt,
      expiresAt: this.overloadFreezeExpiresAt,
      reason: this.overloadFreezeReason,
      activationCount: this.freezeActivationCount,
      totalDurationMs: this.freezeTotalDurationMs,
      currentDurationMs,
    };
  }
}

// Export singleton instance
export const degradedModeManager = DegradedModeManager.getInstance();
