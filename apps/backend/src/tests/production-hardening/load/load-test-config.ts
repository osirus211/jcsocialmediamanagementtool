/**
 * Load Test Configuration and Metrics Interfaces
 * 
 * This module defines TypeScript interfaces for configuring and measuring
 * load tests across all queue systems in the platform.
 * 
 * @module load-test-config
 */

/**
 * Configuration for a load test execution
 * 
 * Defines parameters for running a load test against a specific queue,
 * including job count, concurrency limits, timing constraints, and
 * payload generation.
 */
export interface LoadTestConfig {
  /**
   * Name of the queue to test
   * Valid values: WorkflowQueue, RSSQueue, EvergreenQueue, AIProcessingQueue, SocialListeningQueue
   */
  queueName: string;

  /**
   * Total number of jobs to add to the queue during the test
   * Recommended range: 100-10000 depending on test scenario
   */
  jobCount: number;

  /**
   * Maximum number of jobs that can be processed simultaneously
   * Should match or test the worker's concurrency configuration
   * Typical values: 1-20
   */
  concurrency: number;

  /**
   * Optional time limit for the test in milliseconds
   * If specified, the test will stop after this duration even if not all jobs are complete
   * Useful for time-bounded performance testing
   */
  duration?: number;

  /**
   * Optional ramp-up time in milliseconds for gradual load increase
   * Jobs will be added gradually over this period rather than all at once
   * Useful for simulating realistic traffic patterns
   */
  rampUpTime?: number;

  /**
   * Function that generates a job payload for each test job
   * Should return a valid payload object for the target queue
   * Must generate unique identifiers to prevent conflicts
   * 
   * @returns Job payload object appropriate for the queue being tested
   */
  jobPayloadGenerator: () => any;
}

/**
 * Metrics collected during a load test execution
 * 
 * Captures comprehensive performance data including throughput,
 * latency percentiles, queue lag, and error rates.
 */
export interface LoadTestMetrics {
  /**
   * Total number of jobs added to the queue during the test
   */
  totalJobs: number;

  /**
   * Number of jobs that completed successfully
   */
  completedJobs: number;

  /**
   * Number of jobs that failed (moved to DeadLetterQueue or errored)
   */
  failedJobs: number;

  /**
   * Average throughput in jobs per second
   * Calculated as: completedJobs / duration
   */
  throughput: number;

  /**
   * Latency measurements in milliseconds
   * Tracks time from job creation to job completion
   */
  latency: {
    /**
     * Average latency across all completed jobs
     */
    avg: number;

    /**
     * 50th percentile (median) latency
     * Half of jobs completed faster than this value
     */
    p50: number;

    /**
     * 95th percentile latency
     * 95% of jobs completed faster than this value
     */
    p95: number;

    /**
     * 99th percentile latency
     * 99% of jobs completed faster than this value
     */
    p99: number;

    /**
     * Maximum latency observed
     */
    max: number;
  };

  /**
   * Queue lag measurements in milliseconds
   * Tracks time from job creation to job processing start (not completion)
   */
  queueLag: {
    /**
     * Average queue lag across all jobs
     */
    avg: number;

    /**
     * Maximum queue lag observed
     */
    max: number;

    /**
     * Array of individual lag samples collected during the test
     * Useful for analyzing lag trends over time
     */
    samples: number[];
  };

  /**
   * Error rate as a percentage (0-100)
   * Calculated as: (failedJobs / totalJobs) * 100
   */
  errorRate: number;

  /**
   * Total duration of the test in milliseconds
   * Measured from first job added to last job completed (or timeout)
   */
  duration: number;
}
