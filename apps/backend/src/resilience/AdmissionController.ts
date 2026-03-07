import { logger } from '../utils/logger';
import { LoadState, AdmissionControlMetrics } from './types';
import { ResilienceConfig } from './ResilienceConfig';
import { backpressureManager } from './BackpressureManager';
import { globalRateLimitManager } from '../services/GlobalRateLimitManager';
import { degradedModeManager } from './DegradedModeManager';
import { adaptivePublishPacer } from './AdaptivePublishPacer';

/**
 * Admission Controller
 * 
 * Controls admission of new schedule requests based on system load and publish budgets
 * 
 * Admission rules (RFC-005 evaluation order):
 * 1. Overload freeze check
 * 2. Degraded mode check
 * 3. Backpressure state check (CRITICAL_LOAD)
 * 4. Publish budget check (global, workspace, platform)
 * 5. Priority-based admission
 * 
 * Features:
 * - Load-based admission control
 * - Atomic publish budget enforcement
 * - Priority-based admission
 * - Configurable rejection/delay
 * - Metrics tracking
 * - Event-driven updates
 */

export interface AdmissionContext {
  workspaceId: string;
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram';
  tier: 'free' | 'pro' | 'enterprise';
  priority: 'low' | 'normal' | 'high' | 'critical';
  correlationId: string;
  scheduledAt: Date;
}

export interface AdmissionDecision {
  allowed: boolean;
  reason: string;
  retryAfterSeconds?: number;
  delayMs?: number;
  loadState: LoadState;
  budgetRemaining?: {
    global: number;
    workspace: number;
    platform?: number;
  };
}

export class AdmissionController {
  private static instance: AdmissionController;
  
  private currentLoadState: LoadState = LoadState.LOW_LOAD;
  
  // Metrics
  private metrics: AdmissionControlMetrics = {
    totalRequests: 0,
    acceptedRequests: 0,
    rejectedRequests: 0,
    delayedRequests: 0,
    rejectionRate: 0,
  };
  
  // Extended metrics for RFC-005
  private rejectionReasons: Record<string, number> = {
    OVERLOAD_FREEZE: 0,
    DEGRADED_MODE: 0,
    CRITICAL_LOAD: 0,
    GLOBAL_BUDGET: 0,
    WORKSPACE_BUDGET: 0,
    PLATFORM_BUDGET: 0,
    PRIORITY_REJECTED: 0,
  };

  private constructor() {
    // Listen to load state changes
    backpressureManager.on('loadStateChange', (event) => {
      this.handleLoadStateChange(event.newState);
    });
    
    logger.info('AdmissionController initialized with RFC-005 publish budget enforcement');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AdmissionController {
    if (!AdmissionController.instance) {
      AdmissionController.instance = new AdmissionController();
    }
    return AdmissionController.instance;
  }

  /**
   * Handle load state change
   */
  private handleLoadStateChange(newState: LoadState): void {
    this.currentLoadState = newState;
    
    logger.info('Admission controller load state updated', {
      loadState: newState,
    });
  }

  /**
   * Check if request should be admitted (RFC-005 unified admission)
   * 
   * Evaluation order (MANDATORY):
   * 1. Overload freeze check
   * 2. Degraded mode check
   * 3. Backpressure state check (CRITICAL_LOAD)
   * 4. Publish budget check (global, workspace, platform)
   * 5. Priority-based admission
   * 
   * @param context - Admission context with workspace, tier, priority, etc.
   * @returns Admission decision with reason and retry-after
   */
  async checkAdmission(context: AdmissionContext): Promise<AdmissionDecision> {
    this.metrics.totalRequests++;
    
    const config = ResilienceConfig.ADMISSION_CONTROL;
    
    // 1. Check overload freeze (via freeze key in Redis - checked by Lua script)
    // Note: Freeze check is performed atomically in the Lua script
    
    // 2. Check degraded mode
    if (degradedModeManager.isDegraded() && context.priority !== 'critical') {
      this.metrics.rejectedRequests++;
      this.rejectionReasons.DEGRADED_MODE++;
      this.updateRejectionRate();
      
      logger.warn('Request rejected due to degraded mode', {
        workspaceId: context.workspaceId,
        priority: context.priority,
      });
      
      return {
        allowed: false,
        reason: 'DEGRADED_MODE',
        retryAfterSeconds: 60,
        loadState: this.currentLoadState,
      };
    }
    
    // 3. Check backpressure state (CRITICAL_LOAD)
    if (this.currentLoadState === LoadState.CRITICAL_LOAD) {
      if (config.enableRejection) {
        this.metrics.rejectedRequests++;
        this.rejectionReasons.CRITICAL_LOAD++;
        this.updateRejectionRate();
        
        logger.error('Request rejected due to critical load', {
          loadState: this.currentLoadState,
          retryAfter: config.retryAfterSeconds,
          workspaceId: context.workspaceId,
        });
        
        return {
          allowed: false,
          reason: 'CRITICAL_LOAD',
          retryAfterSeconds: config.retryAfterSeconds,
          loadState: this.currentLoadState,
        };
      }
    }
    
    // 4. Check publish budget (RFC-005 atomic enforcement)
    try {
      const budgetResult = await globalRateLimitManager.checkPublishBudget({
        workspaceId: context.workspaceId,
        platform: context.platform,
        tier: context.tier,
        correlationId: context.correlationId,
        shouldIncrement: true,
      });
      
      if (!budgetResult.allowed) {
        this.metrics.rejectedRequests++;
        this.rejectionReasons[budgetResult.reason]++;
        this.updateRejectionRate();
        
        logger.warn('Request rejected due to budget exhaustion', {
          workspaceId: context.workspaceId,
          tier: context.tier,
          platform: context.platform,
          reason: budgetResult.reason,
          retryAfter: budgetResult.retryAfterSeconds,
          budgetRemaining: budgetResult.budgetRemaining,
        });
        
        return {
          allowed: false,
          reason: budgetResult.reason,
          retryAfterSeconds: budgetResult.retryAfterSeconds,
          loadState: this.currentLoadState,
          budgetRemaining: budgetResult.budgetRemaining,
        };
      }
    } catch (error: any) {
      // Budget check failed, but we fail-open (already handled in GlobalRateLimitManager)
      logger.error('Budget check error, continuing with admission', {
        error: error.message,
        workspaceId: context.workspaceId,
      });
    }
    
    // 5. Priority-based admission (via AdaptivePublishPacer)
    const priorityDecision = adaptivePublishPacer.shouldAdmitJob(context.priority);
    
    if (!priorityDecision.admitted) {
      this.metrics.rejectedRequests++;
      this.rejectionReasons.PRIORITY_REJECTED++;
      this.updateRejectionRate();
      
      logger.warn('Request rejected due to priority', {
        workspaceId: context.workspaceId,
        priority: context.priority,
        reason: priorityDecision.reason,
      });
      
      return {
        allowed: false,
        reason: 'PRIORITY_REJECTED',
        retryAfterSeconds: 30,
        loadState: this.currentLoadState,
      };
    }
    
    // All checks passed - admit request
    this.metrics.acceptedRequests++;
    this.updateRejectionRate();
    
    return {
      allowed: true,
      reason: 'ADMITTED',
      loadState: this.currentLoadState,
    };
  }

  /**
   * Legacy checkAdmission() without context (backward compatibility)
   * 
   * @deprecated Use checkAdmission(context) instead
   */
  checkAdmissionLegacy(): {
    admitted: boolean;
    rejected: boolean;
    delayed: boolean;
    retryAfter?: number;
    delayMs?: number;
    reason?: string;
  } {
    this.metrics.totalRequests++;
    
    const config = ResilienceConfig.ADMISSION_CONTROL;
    
    switch (this.currentLoadState) {
      case LoadState.LOW_LOAD:
      case LoadState.ELEVATED_LOAD:
        // Accept all requests
        this.metrics.acceptedRequests++;
        this.updateRejectionRate();
        
        return {
          admitted: true,
          rejected: false,
          delayed: false,
        };
        
      case LoadState.HIGH_LOAD:
        // Delay requests if enabled
        if (config.enableDelay) {
          this.metrics.delayedRequests++;
          this.updateRejectionRate();
          
          logger.warn('Request delayed due to high load', {
            loadState: this.currentLoadState,
            delayMs: config.delayMs,
          });
          
          return {
            admitted: false,
            rejected: false,
            delayed: true,
            delayMs: config.delayMs,
            reason: 'System under high load - request delayed',
          };
        } else {
          // Accept if delay disabled
          this.metrics.acceptedRequests++;
          this.updateRejectionRate();
          
          return {
            admitted: true,
            rejected: false,
            delayed: false,
          };
        }
        
      case LoadState.CRITICAL_LOAD:
        // Reject requests if enabled
        if (config.enableRejection) {
          this.metrics.rejectedRequests++;
          this.updateRejectionRate();
          
          logger.error('Request rejected due to critical load', {
            loadState: this.currentLoadState,
            retryAfter: config.retryAfterSeconds,
          });
          
          return {
            admitted: false,
            rejected: true,
            delayed: false,
            retryAfter: config.retryAfterSeconds,
            reason: 'System under critical load - request rejected',
          };
        } else {
          // Accept if rejection disabled
          this.metrics.acceptedRequests++;
          this.updateRejectionRate();
          
          return {
            admitted: true,
            rejected: false,
            delayed: false,
          };
        }
        
      default:
        this.metrics.acceptedRequests++;
        this.updateRejectionRate();
        
        return {
          admitted: true,
          rejected: false,
          delayed: false,
        };
    }
  }

  /**
   * Update rejection rate
   */
  private updateRejectionRate(): void {
    if (this.metrics.totalRequests > 0) {
      this.metrics.rejectionRate = 
        (this.metrics.rejectedRequests / this.metrics.totalRequests) * 100;
    }
  }

  /**
   * Get admission metrics
   */
  getMetrics(): AdmissionControlMetrics & { rejectionReasons: Record<string, number> } {
    return {
      ...this.metrics,
      rejectionReasons: { ...this.rejectionReasons },
    };
  }

  /**
   * Get current load state
   */
  getCurrentLoadState(): LoadState {
    return this.currentLoadState;
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      acceptedRequests: 0,
      rejectedRequests: 0,
      delayedRequests: 0,
      rejectionRate: 0,
    };
    
    this.rejectionReasons = {
      OVERLOAD_FREEZE: 0,
      DEGRADED_MODE: 0,
      CRITICAL_LOAD: 0,
      GLOBAL_BUDGET: 0,
      WORKSPACE_BUDGET: 0,
      PLATFORM_BUDGET: 0,
      PRIORITY_REJECTED: 0,
    };
    
    logger.info('AdmissionController metrics reset');
  }

  /**
   * Shutdown controller
   */
  shutdown(): void {
    backpressureManager.removeAllListeners('loadStateChange');
    logger.info('AdmissionController shutdown');
  }
}

// Export singleton instance
export const admissionController = AdmissionController.getInstance();
