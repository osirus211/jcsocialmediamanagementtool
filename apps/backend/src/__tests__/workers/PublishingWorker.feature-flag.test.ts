/**
 * Feature Flag Tests for PublishingWorker
 * 
 * Tests that the GRACEFUL_DEGRADATION_ENABLED feature flag correctly controls
 * whether graceful degradation wrappers are active or inactive.
 * 
 * When flag OFF: Original behavior (direct service calls)
 * When flag ON: Graceful degradation enabled (circuit breakers, fallbacks, metrics)
 * 
 * Requirements: 2.1
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('PublishingWorker Feature Flag', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original env value
    originalEnv = process.env.GRACEFUL_DEGRADATION_ENABLED;
  });

  afterEach(() => {
    // Restore original env value
    if (originalEnv !== undefined) {
      process.env.GRACEFUL_DEGRADATION_ENABLED = originalEnv;
    } else {
      delete process.env.GRACEFUL_DEGRADATION_ENABLED;
    }
  });

  describe('Feature Flag OFF (default)', () => {
    it('should initialize with graceful degradation disabled when flag is false', () => {
      // Set flag to false
      process.env.GRACEFUL_DEGRADATION_ENABLED = 'false';
      
      // Import PublishingWorker with new env
      const { PublishingWorker } = require('../../workers/PublishingWorker');
      const worker = new PublishingWorker();
      
      // Verify gracefulDegradationEnabled is false
      expect((worker as any).gracefulDegradationEnabled).toBe(false);
    });

    it('should initialize with graceful degradation disabled when flag is not set', () => {
      // Remove flag
      delete process.env.GRACEFUL_DEGRADATION_ENABLED;
      
      // Import PublishingWorker with new env
      const { PublishingWorker } = require('../../workers/PublishingWorker');
      const worker = new PublishingWorker();
      
      // Verify gracefulDegradationEnabled is false (default)
      expect((worker as any).gracefulDegradationEnabled).toBe(false);
    });
  });

  describe('Feature Flag ON', () => {
    it('should initialize with graceful degradation enabled when flag is true', () => {
      // Set flag to true
      process.env.GRACEFUL_DEGRADATION_ENABLED = 'true';
      
      // Import PublishingWorker with new env
      const { PublishingWorker } = require('../../workers/PublishingWorker');
      const worker = new PublishingWorker();
      
      // Verify gracefulDegradationEnabled is true
      expect((worker as any).gracefulDegradationEnabled).toBe(true);
    });
  });
});
