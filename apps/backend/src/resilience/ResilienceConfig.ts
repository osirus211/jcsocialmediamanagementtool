import {
  PublishPacingConfig,
  RefreshThrottleConfig,
  AdmissionControlConfig,
  DegradedModeConfig,
} from './types';

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
    LOW_TO_ELEVATED_ENTER: parseFloat(process.env.LOAD_THRESHOLD_LOW_TO_ELEVATED_ENTER || '45'),
    ELEVATED_TO_HIGH_ENTER: parseFloat(process.env.LOAD_THRESHOLD_ELEVATED_TO_HIGH_ENTER || '65'),
    HIGH_TO_CRITICAL_ENTER: parseFloat(process.env.LOAD_THRESHOLD_HIGH_TO_CRITICAL_ENTER || '85'),
    
    // Exit thresholds (when load is decreasing)
    ELEVATED_TO_LOW_EXIT: parseFloat(process.env.LOAD_THRESHOLD_ELEVATED_TO_LOW_EXIT || '35'),
    HIGH_TO_ELEVATED_EXIT: parseFloat(process.env.LOAD_THRESHOLD_HIGH_TO_ELEVATED_EXIT || '55'),
    CRITICAL_TO_HIGH_EXIT: parseFloat(process.env.LOAD_THRESHOLD_CRITICAL_TO_HIGH_EXIT || '75'),
  };

  /**
   * Load score weights
   */
  static readonly LOAD_WEIGHTS = {
    queueDepth: parseFloat(process.env.LOAD_WEIGHT_QUEUE_DEPTH || '0.3'),
    retryRate: parseFloat(process.env.LOAD_WEIGHT_RETRY_RATE || '0.3'),
    rateLimitHits: parseFloat(process.env.LOAD_WEIGHT_RATE_LIMIT || '0.2'),
    refreshBacklog: parseFloat(process.env.LOAD_WEIGHT_REFRESH_BACKLOG || '0.2'),
  };

  /**
   * Publish pacing configuration
   */
  static readonly PUBLISH_PACING: PublishPacingConfig = {
    normalConcurrency: parseInt(process.env.PUBLISH_CONCURRENCY_NORMAL || '5', 10),
    elevatedConcurrency: parseInt(process.env.PUBLISH_CONCURRENCY_ELEVATED || '4', 10),
    highConcurrency: parseInt(process.env.PUBLISH_CONCURRENCY_HIGH || '2', 10),
    criticalConcurrency: parseInt(process.env.PUBLISH_CONCURRENCY_CRITICAL || '0', 10),
    delayNonCriticalMs: parseInt(process.env.PUBLISH_DELAY_NON_CRITICAL_MS || '5000', 10),
  };

  /**
   * Refresh throttle configuration
   */
  static readonly REFRESH_THROTTLE: RefreshThrottleConfig = {
    maxRefreshPerSecondPerPlatform: parseInt(process.env.REFRESH_MAX_PER_SEC_PER_PLATFORM || '10', 10),
    jitterMs: parseInt(process.env.REFRESH_JITTER_MS || '1000', 10),
    priorityThresholdHours: parseInt(process.env.REFRESH_PRIORITY_THRESHOLD_HOURS || '1', 10),
    highLoadThresholdMinutes: parseInt(process.env.REFRESH_HIGH_LOAD_THRESHOLD_MIN || '30', 10),
    criticalLoadThresholdMinutes: parseInt(process.env.REFRESH_CRITICAL_LOAD_THRESHOLD_MIN || '10', 10),
  };

  /**
   * Admission control configuration
   */
  static readonly ADMISSION_CONTROL: AdmissionControlConfig = {
    enableRejection: process.env.ADMISSION_ENABLE_REJECTION !== 'false',
    enableDelay: process.env.ADMISSION_ENABLE_DELAY !== 'false',
    retryAfterSeconds: parseInt(process.env.ADMISSION_RETRY_AFTER_SEC || '60', 10),
    delayMs: parseInt(process.env.ADMISSION_DELAY_MS || '2000', 10),
  };

  /**
   * Degraded mode configuration
   */
  static readonly DEGRADED_MODE: DegradedModeConfig = {
    p99LatencyThresholdMs: parseInt(process.env.DEGRADED_P99_LATENCY_THRESHOLD_MS || '5000', 10),
    p99LatencySustainedSeconds: parseInt(process.env.DEGRADED_P99_SUSTAINED_SEC || '120', 10),
    queueLagThresholdSeconds: parseInt(process.env.DEGRADED_QUEUE_LAG_THRESHOLD_SEC || '60', 10),
    queueLagSustainedSeconds: parseInt(process.env.DEGRADED_QUEUE_LAG_SUSTAINED_SEC || '120', 10),
    retryStormThreshold: parseInt(process.env.DEGRADED_RETRY_STORM_THRESHOLD || '100', 10),
    recoveryStableSeconds: parseInt(process.env.DEGRADED_RECOVERY_STABLE_SEC || '300', 10),
    disableAnalytics: process.env.DEGRADED_DISABLE_ANALYTICS !== 'false',
    pauseNonEssential: process.env.DEGRADED_PAUSE_NON_ESSENTIAL !== 'false',
    slowPublishPacing: process.env.DEGRADED_SLOW_PUBLISH_PACING !== 'false',
    aggressiveRateLimitBackoff: process.env.DEGRADED_AGGRESSIVE_BACKOFF !== 'false',
  };

  /**
   * Monitoring intervals
   */
  static readonly MONITORING = {
    backpressureCheckIntervalMs: parseInt(process.env.BACKPRESSURE_CHECK_INTERVAL_MS || '10000', 10),
    degradedModeCheckIntervalMs: parseInt(process.env.DEGRADED_MODE_CHECK_INTERVAL_MS || '30000', 10),
    metricsExportIntervalMs: parseInt(process.env.METRICS_EXPORT_INTERVAL_MS || '60000', 10),
  };

  /**
   * Control loop stability configuration
   */
  static readonly CONTROL_LOOP = {
    // EMA smoothing alpha (0.0 = no smoothing, 1.0 = no memory)
    emaAlpha: parseFloat(process.env.CONTROL_LOOP_EMA_ALPHA || '0.2'),
    
    // Minimum dwell time per state (milliseconds)
    dwellTimeLowMs: parseInt(process.env.CONTROL_LOOP_DWELL_TIME_LOW_MS || '10000', 10),
    dwellTimeElevatedMs: parseInt(process.env.CONTROL_LOOP_DWELL_TIME_ELEVATED_MS || '15000', 10),
    dwellTimeHighMs: parseInt(process.env.CONTROL_LOOP_DWELL_TIME_HIGH_MS || '20000', 10),
    dwellTimeCriticalMs: parseInt(process.env.CONTROL_LOOP_DWELL_TIME_CRITICAL_MS || '30000', 10),
    
    // Global transition cooldown (milliseconds)
    transitionCooldownMs: parseInt(process.env.CONTROL_LOOP_TRANSITION_COOLDOWN_MS || '10000', 10),
    
    // Oscillation detection
    oscillationWindowMs: parseInt(process.env.CONTROL_LOOP_OSCILLATION_WINDOW_MS || '60000', 10),
    oscillationThreshold: parseInt(process.env.CONTROL_LOOP_OSCILLATION_THRESHOLD || '5', 10),
    oscillationFreezeMs: parseInt(process.env.CONTROL_LOOP_OSCILLATION_FREEZE_MS || '30000', 10),
    
    // Concurrency ramping
    rampIntervalMs: parseInt(process.env.CONTROL_LOOP_RAMP_INTERVAL_MS || '5000', 10),
    rampStepSize: parseInt(process.env.CONTROL_LOOP_RAMP_STEP_SIZE || '1', 10),
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
