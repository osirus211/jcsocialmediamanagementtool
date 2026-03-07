/**
 * Resilience System Types
 * 
 * Type definitions for adaptive resilience, backpressure control, and degraded mode
 */

export enum LoadState {
  LOW_LOAD = 'LOW_LOAD',
  ELEVATED_LOAD = 'ELEVATED_LOAD',
  HIGH_LOAD = 'HIGH_LOAD',
  CRITICAL_LOAD = 'CRITICAL_LOAD',
}

export enum DegradedModeState {
  NORMAL = 'NORMAL',
  DEGRADED = 'DEGRADED',
  RECOVERING = 'RECOVERING',
}

export interface LatencyHistogram {
  p50: number;
  p95: number;
  p99: number;
  max: number;
  count: number;
  sum: number;
  avg: number;
}

export interface LatencyMetrics {
  publish: LatencyHistogram;
  refresh: LatencyHistogram;
  queueLag: LatencyHistogram;
  lockAcquisition: LatencyHistogram;
}

export interface BackpressureMetrics {
  queueDepth: number;
  activeWorkers: number;
  workerCapacity: number;
  retryRate: number;
  rateLimitHits: number;
  refreshBacklog: number;
  systemLoadScore: number;
  rawLoadScore?: number;
  smoothedLoadScore?: number;
  loadState: LoadState;
  stateDurationMs?: number;
  transitionsPastMinute?: number;
  oscillationDetected?: boolean;
}

export interface AdmissionControlMetrics {
  totalRequests: number;
  acceptedRequests: number;
  rejectedRequests: number;
  delayedRequests: number;
  rejectionRate: number;
}

export interface DegradedModeMetrics {
  state: DegradedModeState;
  enteredAt?: Date;
  exitedAt?: Date;
  duration?: number;
  triggers: string[];
  recoveryProgress: number;
}

export interface ResilienceMetrics {
  timestamp: Date;
  latency: LatencyMetrics;
  backpressure: BackpressureMetrics;
  admissionControl: AdmissionControlMetrics;
  degradedMode: DegradedModeMetrics;
}

export interface LoadStateChangeEvent {
  previousState: LoadState;
  newState: LoadState;
  timestamp: Date;
  metrics: BackpressureMetrics;
  reason: string;
  rawLoadScore?: number;
  smoothedLoadScore?: number;
}

export interface StateTransitionRecord {
  fromState: LoadState;
  toState: LoadState;
  timestamp: Date;
  rawLoadScore: number;
  smoothedLoadScore: number;
  reason: string;
}

export interface DegradedModeChangeEvent {
  previousState: DegradedModeState;
  newState: DegradedModeState;
  timestamp: Date;
  triggers: string[];
  reason: string;
}

export interface PublishPacingConfig {
  normalConcurrency: number;
  elevatedConcurrency: number;
  highConcurrency: number;
  criticalConcurrency: number;
  delayNonCriticalMs: number;
}

export interface RefreshThrottleConfig {
  maxRefreshPerSecondPerPlatform: number;
  jitterMs: number;
  priorityThresholdHours: number;
  highLoadThresholdMinutes: number;
  criticalLoadThresholdMinutes: number;
}

export interface AdmissionControlConfig {
  enableRejection: boolean;
  enableDelay: boolean;
  retryAfterSeconds: number;
  delayMs: number;
}

export interface DegradedModeConfig {
  p99LatencyThresholdMs: number;
  p99LatencySustainedSeconds: number;
  queueLagThresholdSeconds: number;
  queueLagSustainedSeconds: number;
  retryStormThreshold: number;
  recoveryStableSeconds: number;
  disableAnalytics: boolean;
  pauseNonEssential: boolean;
  slowPublishPacing: boolean;
  aggressiveRateLimitBackoff: boolean;
}

export interface JobPriority {
  postId: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  scheduledAt: Date;
  deadline?: Date;
}
