import { AdmissionController, AdmissionContext } from '../AdmissionController';
import { LoadState } from '../types';
import { backpressureManager } from '../BackpressureManager';
import { degradedModeManager } from '../DegradedModeManager';
import { adaptivePublishPacer } from '../AdaptivePublishPacer';
import { globalRateLimitManager } from '../../services/GlobalRateLimitManager';

jest.mock('../BackpressureManager');
jest.mock('../DegradedModeManager');
jest.mock('../AdaptivePublishPacer');
jest.mock('../../services/GlobalRateLimitManager');
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AdmissionController - RFC-005 Publish Budget Integration', () => {
  let controller: AdmissionController;
  
  const mockContext: AdmissionContext = {
    workspaceId: 'ws_test',
    platform: 'twitter',
    tier: 'pro',
    priority: 'normal',
    correlationId: 'corr_123',
    scheduledAt: new Date(),
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton
    (AdmissionController as any).instance = null;
    
    // Mock BackpressureManager
    (backpressureManager.on as jest.Mock) = jest.fn();
    (backpressureManager.getCurrentState as jest.Mock) = jest.fn().mockReturnValue(LoadState.LOW_LOAD);
    
    // Mock DegradedModeManager
    (degradedModeManager.isDegraded as jest.Mock) = jest.fn().mockReturnValue(false);
    
    // Mock AdaptivePublishPacer
    (adaptivePublishPacer.shouldAdmitJob as jest.Mock) = jest.fn().mockReturnValue({
      admitted: true,
      reason: undefined,
    });
    
    // Mock GlobalRateLimitManager
    (globalRateLimitManager.checkPublishBudget as jest.Mock) = jest.fn().mockResolvedValue({
      allowed: true,
      reason: 'ADMITTED',
      retryAfterSeconds: 0,
      budgetRemaining: {
        global: 999,
        workspace: 49,
      },
    });
    
    controller = AdmissionController.getInstance();
    controller.resetMetrics();
  });
  
  describe('RFC-005 Evaluation Order', () => {
    test('degraded mode check happens before budget check', async () => {
      (degradedModeManager.isDegraded as jest.Mock).mockReturnValue(true);
      
      const result = await controller.checkAdmission(mockContext);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('DEGRADED_MODE');
      expect(globalRateLimitManager.checkPublishBudget).not.toHaveBeenCalled();
    });
    
    test('critical load check happens before budget check', async () => {
      (backpressureManager.getCurrentState as jest.Mock).mockReturnValue(LoadState.CRITICAL_LOAD);
      (controller as any).currentLoadState = LoadState.CRITICAL_LOAD;
      
      const result = await controller.checkAdmission(mockContext);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('CRITICAL_LOAD');
      expect(globalRateLimitManager.checkPublishBudget).not.toHaveBeenCalled();
    });
    
    test('budget check happens before priority check', async () => {
      (globalRateLimitManager.checkPublishBudget as jest.Mock).mockResolvedValue({
        allowed: false,
        reason: 'GLOBAL_BUDGET',
        retryAfterSeconds: 30,
        budgetRemaining: {
          global: 0,
          workspace: 10,
        },
      });
      
      const result = await controller.checkAdmission(mockContext);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('GLOBAL_BUDGET');
      expect(adaptivePublishPacer.shouldAdmitJob).not.toHaveBeenCalled();
    });
    
    test('priority check happens after budget passes', async () => {
      (adaptivePublishPacer.shouldAdmitJob as jest.Mock).mockReturnValue({
        admitted: false,
        reason: 'Concurrency limit reached',
      });
      
      const result = await controller.checkAdmission(mockContext);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('PRIORITY_REJECTED');
      expect(globalRateLimitManager.checkPublishBudget).toHaveBeenCalled();
      expect(adaptivePublishPacer.shouldAdmitJob).toHaveBeenCalledWith('normal');
    });
    
    test('all checks pass - request admitted', async () => {
      const result = await controller.checkAdmission(mockContext);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('ADMITTED');
      expect(globalRateLimitManager.checkPublishBudget).toHaveBeenCalled();
      expect(adaptivePublishPacer.shouldAdmitJob).toHaveBeenCalled();
    });
  });
  
  describe('Budget Rejection Scenarios', () => {
    test('global budget exhaustion blocks request', async () => {
      (globalRateLimitManager.checkPublishBudget as jest.Mock).mockResolvedValue({
        allowed: false,
        reason: 'GLOBAL_BUDGET',
        retryAfterSeconds: 30,
        budgetRemaining: {
          global: 0,
          workspace: 49,
        },
      });
      
      const result = await controller.checkAdmission(mockContext);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('GLOBAL_BUDGET');
      expect(result.retryAfterSeconds).toBe(30);
      expect(result.budgetRemaining?.global).toBe(0);
    });
    
    test('workspace budget exhaustion blocks request', async () => {
      (globalRateLimitManager.checkPublishBudget as jest.Mock).mockResolvedValue({
        allowed: false,
        reason: 'WORKSPACE_BUDGET',
        retryAfterSeconds: 45,
        budgetRemaining: {
          global: 500,
          workspace: 0,
        },
      });
      
      const result = await controller.checkAdmission(mockContext);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('WORKSPACE_BUDGET');
      expect(result.retryAfterSeconds).toBe(45);
      expect(result.budgetRemaining?.workspace).toBe(0);
    });
    
    test('platform budget exhaustion blocks request', async () => {
      (globalRateLimitManager.checkPublishBudget as jest.Mock).mockResolvedValue({
        allowed: false,
        reason: 'PLATFORM_BUDGET',
        retryAfterSeconds: 20,
        budgetRemaining: {
          global: 500,
          workspace: 30,
          platform: 0,
        },
      });
      
      const result = await controller.checkAdmission(mockContext);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('PLATFORM_BUDGET');
      expect(result.retryAfterSeconds).toBe(20);
      expect(result.budgetRemaining?.platform).toBe(0);
    });
    
    test('overload freeze blocks request', async () => {
      (globalRateLimitManager.checkPublishBudget as jest.Mock).mockResolvedValue({
        allowed: false,
        reason: 'OVERLOAD_FREEZE',
        retryAfterSeconds: 60,
        budgetRemaining: {
          global: 0,
          workspace: 0,
        },
      });
      
      const result = await controller.checkAdmission(mockContext);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('OVERLOAD_FREEZE');
      expect(result.retryAfterSeconds).toBe(60);
    });
  });
  
  describe('Budget Pass and Priority Scenarios', () => {
    test('budget passes but priority rejects', async () => {
      (adaptivePublishPacer.shouldAdmitJob as jest.Mock).mockReturnValue({
        admitted: false,
        reason: 'Concurrency limit reached',
      });
      
      const result = await controller.checkAdmission(mockContext);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('PRIORITY_REJECTED');
      expect(globalRateLimitManager.checkPublishBudget).toHaveBeenCalled();
    });
    
    test('budget passes and priority admits', async () => {
      const result = await controller.checkAdmission(mockContext);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('ADMITTED');
      expect(globalRateLimitManager.checkPublishBudget).toHaveBeenCalled();
      expect(adaptivePublishPacer.shouldAdmitJob).toHaveBeenCalled();
    });
  });
  
  describe('Override Scenarios', () => {
    test('degraded mode overrides budget check', async () => {
      (degradedModeManager.isDegraded as jest.Mock).mockReturnValue(true);
      
      const result = await controller.checkAdmission(mockContext);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('DEGRADED_MODE');
      expect(globalRateLimitManager.checkPublishBudget).not.toHaveBeenCalled();
    });
    
    test('critical priority bypasses degraded mode', async () => {
      (degradedModeManager.isDegraded as jest.Mock).mockReturnValue(true);
      
      const criticalContext: AdmissionContext = {
        ...mockContext,
        priority: 'critical',
      };
      
      const result = await controller.checkAdmission(criticalContext);
      
      expect(result.allowed).toBe(true);
      expect(globalRateLimitManager.checkPublishBudget).toHaveBeenCalled();
    });
    
    test('critical load overrides budget check', async () => {
      (backpressureManager.getCurrentState as jest.Mock).mockReturnValue(LoadState.CRITICAL_LOAD);
      (controller as any).currentLoadState = LoadState.CRITICAL_LOAD;
      
      const result = await controller.checkAdmission(mockContext);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('CRITICAL_LOAD');
      expect(globalRateLimitManager.checkPublishBudget).not.toHaveBeenCalled();
    });
  });
  
  describe('Correlation ID Forwarding', () => {
    test('correlation ID passed to budget check', async () => {
      const contextWithCorrelation: AdmissionContext = {
        ...mockContext,
        correlationId: 'unique_corr_456',
      };
      
      await controller.checkAdmission(contextWithCorrelation);
      
      expect(globalRateLimitManager.checkPublishBudget).toHaveBeenCalledWith({
        workspaceId: 'ws_test',
        platform: 'twitter',
        tier: 'pro',
        correlationId: 'unique_corr_456',
        shouldIncrement: true,
      });
    });
  });
  
  describe('Metrics Tracking', () => {
    test('tracks global budget rejections', async () => {
      (globalRateLimitManager.checkPublishBudget as jest.Mock).mockResolvedValue({
        allowed: false,
        reason: 'GLOBAL_BUDGET',
        retryAfterSeconds: 30,
        budgetRemaining: { global: 0, workspace: 10 },
      });
      
      await controller.checkAdmission(mockContext);
      
      const metrics = controller.getMetrics();
      expect(metrics.rejectionReasons.GLOBAL_BUDGET).toBe(1);
      expect(metrics.rejectedRequests).toBe(1);
    });
    
    test('tracks workspace budget rejections', async () => {
      (globalRateLimitManager.checkPublishBudget as jest.Mock).mockResolvedValue({
        allowed: false,
        reason: 'WORKSPACE_BUDGET',
        retryAfterSeconds: 45,
        budgetRemaining: { global: 500, workspace: 0 },
      });
      
      await controller.checkAdmission(mockContext);
      
      const metrics = controller.getMetrics();
      expect(metrics.rejectionReasons.WORKSPACE_BUDGET).toBe(1);
    });
    
    test('tracks platform budget rejections', async () => {
      (globalRateLimitManager.checkPublishBudget as jest.Mock).mockResolvedValue({
        allowed: false,
        reason: 'PLATFORM_BUDGET',
        retryAfterSeconds: 20,
        budgetRemaining: { global: 500, workspace: 30, platform: 0 },
      });
      
      await controller.checkAdmission(mockContext);
      
      const metrics = controller.getMetrics();
      expect(metrics.rejectionReasons.PLATFORM_BUDGET).toBe(1);
    });
    
    test('tracks overload freeze rejections', async () => {
      (globalRateLimitManager.checkPublishBudget as jest.Mock).mockResolvedValue({
        allowed: false,
        reason: 'OVERLOAD_FREEZE',
        retryAfterSeconds: 60,
        budgetRemaining: { global: 0, workspace: 0 },
      });
      
      await controller.checkAdmission(mockContext);
      
      const metrics = controller.getMetrics();
      expect(metrics.rejectionReasons.OVERLOAD_FREEZE).toBe(1);
    });
    
    test('tracks degraded mode rejections', async () => {
      (degradedModeManager.isDegraded as jest.Mock).mockReturnValue(true);
      
      await controller.checkAdmission(mockContext);
      
      const metrics = controller.getMetrics();
      expect(metrics.rejectionReasons.DEGRADED_MODE).toBe(1);
    });
    
    test('tracks critical load rejections', async () => {
      (backpressureManager.getCurrentState as jest.Mock).mockReturnValue(LoadState.CRITICAL_LOAD);
      (controller as any).currentLoadState = LoadState.CRITICAL_LOAD;
      
      await controller.checkAdmission(mockContext);
      
      const metrics = controller.getMetrics();
      expect(metrics.rejectionReasons.CRITICAL_LOAD).toBe(1);
    });
    
    test('tracks priority rejections', async () => {
      (adaptivePublishPacer.shouldAdmitJob as jest.Mock).mockReturnValue({
        admitted: false,
        reason: 'Concurrency limit',
      });
      
      await controller.checkAdmission(mockContext);
      
      const metrics = controller.getMetrics();
      expect(metrics.rejectionReasons.PRIORITY_REJECTED).toBe(1);
    });
    
    test('tracks accepted requests', async () => {
      await controller.checkAdmission(mockContext);
      
      const metrics = controller.getMetrics();
      expect(metrics.acceptedRequests).toBe(1);
      expect(metrics.totalRequests).toBe(1);
    });
  });
  
  describe('Error Handling', () => {
    test('continues on budget check error (fail-open)', async () => {
      (globalRateLimitManager.checkPublishBudget as jest.Mock).mockRejectedValue(
        new Error('Redis connection failed')
      );
      
      const result = await controller.checkAdmission(mockContext);
      
      // Should continue to priority check despite error
      expect(adaptivePublishPacer.shouldAdmitJob).toHaveBeenCalled();
      expect(result.allowed).toBe(true);
    });
  });
  
  describe('Tier and Platform Forwarding', () => {
    test('forwards tier correctly', async () => {
      const contexts: AdmissionContext[] = [
        { ...mockContext, tier: 'free' },
        { ...mockContext, tier: 'pro' },
        { ...mockContext, tier: 'enterprise' },
      ];
      
      for (const ctx of contexts) {
        await controller.checkAdmission(ctx);
      }
      
      expect(globalRateLimitManager.checkPublishBudget).toHaveBeenNthCalledWith(1, {
        workspaceId: 'ws_test',
        platform: 'twitter',
        tier: 'free',
        correlationId: expect.any(String),
        shouldIncrement: true,
      });
      
      expect(globalRateLimitManager.checkPublishBudget).toHaveBeenNthCalledWith(2, {
        workspaceId: 'ws_test',
        platform: 'twitter',
        tier: 'pro',
        correlationId: expect.any(String),
        shouldIncrement: true,
      });
      
      expect(globalRateLimitManager.checkPublishBudget).toHaveBeenNthCalledWith(3, {
        workspaceId: 'ws_test',
        platform: 'twitter',
        tier: 'enterprise',
        correlationId: expect.any(String),
        shouldIncrement: true,
      });
    });
    
    test('forwards platform correctly', async () => {
      const platforms: Array<'twitter' | 'linkedin' | 'facebook'> = ['twitter', 'linkedin', 'facebook'];
      
      for (const platform of platforms) {
        await controller.checkAdmission({ ...mockContext, platform });
      }
      
      expect(globalRateLimitManager.checkPublishBudget).toHaveBeenCalledTimes(3);
      expect(globalRateLimitManager.checkPublishBudget).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'twitter' })
      );
      expect(globalRateLimitManager.checkPublishBudget).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'linkedin' })
      );
      expect(globalRateLimitManager.checkPublishBudget).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'facebook' })
      );
    });
  });
});
