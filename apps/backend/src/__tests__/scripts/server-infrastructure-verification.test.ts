/**
 * Server Infrastructure Verification Tests
 * 
 * Tests for the infrastructure verification script
 */

import { ServerInfrastructureVerifier } from '../../scripts/server-infrastructure-verification';

describe('ServerInfrastructureVerifier', () => {
  let verifier: ServerInfrastructureVerifier;

  beforeEach(() => {
    verifier = new ServerInfrastructureVerifier();
  });

  describe('MongoDB Verification', () => {
    it('should verify MongoDB connectivity', async () => {
      const result = await verifier.verifyMongoDB();
      
      expect(result).toHaveProperty('component', 'MongoDB');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('responseTime');
      expect(typeof result.responseTime).toBe('number');
    });
  });

  describe('Redis Verification', () => {
    it('should verify Redis connectivity', async () => {
      const result = await verifier.verifyRedis();
      
      expect(result).toHaveProperty('component', 'Redis');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('responseTime');
      expect(typeof result.responseTime).toBe('number');
    });
  });

  describe('Backend API Verification', () => {
    it('should verify Backend API connectivity', async () => {
      const result = await verifier.verifyBackendAPI();
      
      expect(result).toHaveProperty('component', 'Backend API');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('responseTime');
      expect(typeof result.responseTime).toBe('number');
    });
  });

  describe('Frontend Verification', () => {
    it('should verify Frontend connectivity', async () => {
      const result = await verifier.verifyFrontend();
      
      expect(result).toHaveProperty('component', 'Frontend');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('responseTime');
      expect(typeof result.responseTime).toBe('number');
    });
  });

  describe('Full Verification', () => {
    it('should run all checks and generate report', async () => {
      const report = await verifier.runAllChecks();
      
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('overallStatus');
      expect(report).toHaveProperty('results');
      expect(report).toHaveProperty('summary');
      
      expect(report.results).toHaveLength(4);
      expect(report.summary.total).toBe(4);
      expect(report.summary.passed + report.summary.failed + report.summary.warnings).toBe(4);
      
      // Check that all components are present
      const components = report.results.map(r => r.component);
      expect(components).toContain('MongoDB');
      expect(components).toContain('Redis');
      expect(components).toContain('Backend API');
      expect(components).toContain('Frontend');
    });

    it('should determine correct overall status', async () => {
      const report = await verifier.runAllChecks();
      
      const hasFailures = report.results.some(r => r.status === 'FAIL');
      const hasWarnings = report.results.some(r => r.status === 'WARNING');
      
      if (hasFailures) {
        expect(report.overallStatus).toBe('FAIL');
      } else if (hasWarnings) {
        expect(report.overallStatus).toBe('WARNING');
      } else {
        expect(report.overallStatus).toBe('PASS');
      }
    });
  });

  describe('Report Generation', () => {
    it('should print report without errors', async () => {
      const report = await verifier.runAllChecks();
      
      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      expect(() => verifier.printReport(report)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});