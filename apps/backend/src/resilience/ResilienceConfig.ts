import {
  PublishPacingConfig,
  RefreshThrottleConfig,
  AdmissionControlConfig,
  DegradedModeConfig,
} from './types';
import { config } from '../config';

/**
 * Resilience Configuration
 * 
 * Centralized configuration for adaptive resilience system
 * 
 * All values are configurable via environment variables with sensible defaults
 */

export class ResilienceConfig {
  /**
   * Load state thresholds with hysteresis bands
   * 
   * System load score is calculated as weighted sum:
   * score = (queueDepth * 0.3) + (retryRate * 0.3) + (rateLimitHits * 0.2) + (refreshBacklog * 0.2)
   * 
   * Hysteresis prevents rapid state oscillation by using different thresholds for entering vs exiting states
   */
  static readonly LOAD_THRESHOLDS = {
    // Enter thresholds (when load is increasing)
    LOW_TO_ELEVATED_ENTER: config.resilience.loadThresholds.lowToElevatedEnter,
    ELEVATED_TO_HIGH_ENTER: config.resilience.loadThresholds.elevatedToHighEnter,
    HIGH_TO_CRITICAL_ENTER: config.resilience.loadThresholds.highToCriticalEnter,
    
    // Exit thresholds (when load is decreasing)
    ELEVATED_TO_LOW_EXIT: config.resilience.loadThresholds.elevatedToLowExit,
    HIGH_TO_ELEVATED_EXIT: config.resilience.loadThresholds.highToElevatedExit,
    CRITICAL_TO_HIGH_EXIT: config.resilience.loadThresholds.criticalToHighExit,
  };

  /**
   * Load score weights
   */
  static readonly LOAD_WEIGHTS = {
    queueDepth: config.resilience.loadWeights.queueDepth,
    retryRate: config.resilience.loadWeights.retryRate,
    rateLimitHits: config.resilience.loadWeights.rateLimitHits,
    refreshBacklog: config.resilience.loadWeights.refreshBacklog,
  };

  /**
   * Publish pacing configuration
   */
  static readonly PUBLISH_PACING: PublishPacingConfig = {
    normalConcurrency: config.resilience.publishPacing.normalConcurrency,
    elevatedConcurrency: config.resilience.publishPacing.elevatedConcurrency,
    highConcurrency: config.resilience.publishPacing.highConcurrency,
    criticalConcurrency: config.resilience.publishPacing.criticalConcurrency,
    delayNonCriticalMs: config.resilience.publishPacing.delayNonCriticalMs,
  };

  /**
   * Refresh throttle configuration
   */
  static readonly REFRESH_THROTTLE: RefreshThrottleConfig = {
    maxRefreshPerSecondPerPlatform: config.resilience.refreshThrottle.maxRefreshPerSecondPerPlatform,
    jitterMs: config.resilience.refreshThrottle.jitterMs,
    priorityThresholdHours: config.resilience.refreshThrottle.priorityThresholdHours,
    highLoadThresholdMinutes: config.resilience.refreshThrottle.highLoadThresholdMinutes,
    criticalLoadThresholdMinutes: config.resilience.refreshThrottle.criticalLoadThresholdMinutes,
  };

  /**
   * Admission control configuration
   */
  static readonly ADMISSION_CONTROL: AdmissionControlConfig = {
    enableRejection: config.resilience.admissionControl.enableRejection,
    enableDelay: config.resilience.admissionControl.enableDelay,
    retryAfterSeconds: config.resilience.admissionControl.retryAfterSeconds,
    delayMs: config.resilience.admissionControl.delayMs,
  };

  /**
   * Degraded mode configuration
   */
  static readonly DEGRADED_MODE: DegradedModeConfig = {
    p99LatencyThresholdMs: config.resilience.degradedMode.p99LatencyThresholdMs,
    p99LatencySustainedSeconds: config.resilience.degradedMode.p99LatencySustainedSeconds,
    queueLagThresholdSeconds: config.resilience.degradedMode.queueLagThresholdSeconds,
    queueLagSustainedSeconds: config.resilience.degradedMode.queueLagSustainedSeconds,
    retryStormThreshold: config.resilience.degradedMode.retryStormThreshold,
    recoveryStableSeconds: config.resilience.degradedMode.recoveryStableSeconds,
    disableAnalytics: config.resilience.degradedMode.disableAnalytics,
    pauseNonEssential: config.resilience.degradedMode.pauseNonEssential,
    slowPublishPacing: config.resilience.degradedMode.slowPublishPacing,
    aggressiveRateLimitBackoff: config.resilience.degradedMode.aggressiveRateLimitBackoff,
  };

  /**
   * Monitoring intervals
   */
  static readonly MONITORING = {
    backpressureCheckIntervalMs: config.resilience.monitoring.backpressureCheckIntervalMs,
    degradedModeCheckIntervalMs: config.resilience.monitoring.degradedModeCheckIntervalMs,
    metricsExportIntervalMs: config.resilience.monitoring.metricsExportIntervalMs,
  };

  /**
   * Control loop stability configuration
   */
  static readonly CONTROL_LOOP = {
    // EMA smoothing alpha (0.0 = no smoothing, 1.0 = no memory)
    emaAlpha: config.resilience.controlLoop.emaAlpha,
    
    // Minimum dwell time per state (milliseconds)
    dwellTimeLowMs: config.resilience.controlLoop.dwellTimeLowMs,
    dwellTimeElevatedMs: config.resilience.controlLoop.dwellTimeElevatedMs,
    dwellTimeHighMs: config.resilience.controlLoop.dwellTimeHighMs,
    dwellTimeCriticalMs: config.resilience.controlLoop.dwellTimeCriticalMs,
    
    // Global transition cooldown (milliseconds)
    transitionCooldownMs: config.resilience.controlLoop.transitionCooldownMs,
    
    // Oscillation detection
    oscillationWindowMs: config.resilience.controlLoop.oscillationWindowMs,
    oscillationThreshold: config.resilience.controlLoop.oscillationThreshold,
    oscillationFreezeMs: config.resilience.controlLoop.oscillationFreezeMs,
    
    // Concurrency ramping
    rampIntervalMs: config.resilience.controlLoop.rampIntervalMs,
    rampStepSize: config.resilience.controlLoop.rampStepSize,
  };

  /**
   * Validate configuration
   */
  static validate(): void {
    // Validate hysteresis thresholds
    const {
      LOW_TO_ELEVATED_ENTER,
      ELEVATED_TO_LOW_EXIT,
      ELEVATED_TO_HIGH_ENTER,
      HIGH_TO_ELEVATED_EXIT,
      HIGH_TO_CRITICAL_ENTER,
      CRITICAL_TO_HIGH_EXIT,
    } = this.LOAD_THRESHOLDS;
    
    // Validate hysteresis bands (exit < enter for each transition)
    if (!(ELEVATED_TO_LOW_EXIT < LOW_TO_ELEVATED_ENTER)) {
      throw new Error('Hysteresis violation: ELEVATED_TO_LOW_EXIT must be < LOW_TO_ELEVATED_ENTER');
    }
    if (!(HIGH_TO_ELEVATED_EXIT < ELEVATED_TO_HIGH_ENTER)) {
      throw new Error('Hysteresis violation: HIGH_TO_ELEVATED_EXIT must be < ELEVATED_TO_HIGH_ENTER');
    }
    if (!(CRITICAL_TO_HIGH_EXIT < HIGH_TO_CRITICAL_ENTER)) {
      throw new Error('Hysteresis violation: CRITICAL_TO_HIGH_EXIT must be < HIGH_TO_CRITICAL_ENTER');
    }
    
    // Validate ascending order
    if (!(ELEVATED_TO_LOW_EXIT < LOW_TO_ELEVATED_ENTER && 
          LOW_TO_ELEVATED_ENTER < HIGH_TO_ELEVATED_EXIT &&
          HIGH_TO_ELEVATED_EXIT < ELEVATED_TO_HIGH_ENTER &&
          ELEVATED_TO_HIGH_ENTER < CRITICAL_TO_HIGH_EXIT &&
          CRITICAL_TO_HIGH_EXIT < HIGH_TO_CRITICAL_ENTER)) {
      throw new Error('Load thresholds must be in ascending order with proper hysteresis bands');
    }

    // Validate concurrency is in descending order
    const { normalConcurrency, elevatedConcurrency, highConcurrency, criticalConcurrency } = this.PUBLISH_PACING;
    
    if (!(normalConcurrency >= elevatedConcurrency && elevatedConcurrency >= highConcurrency && highConcurrency >= criticalConcurrency)) {
      throw new Error('Publish concurrency must be in descending order: NORMAL >= ELEVATED >= HIGH >= CRITICAL');
    }

    // Validate weights sum to 1.0
    const { queueDepth, retryRate, rateLimitHits, refreshBacklog } = this.LOAD_WEIGHTS;
    const sum = queueDepth + retryRate + rateLimitHits + refreshBacklog;
    
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(`Load weights must sum to 1.0, got ${sum}`);
    }
    
    // Validate EMA alpha
    const { emaAlpha } = this.CONTROL_LOOP;
    if (emaAlpha < 0 || emaAlpha > 1) {
      throw new Error('EMA alpha must be between 0 and 1');
    }
  }
}

// Validate on module load
ResilienceConfig.validate();
