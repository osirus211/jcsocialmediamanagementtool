/**
 * HTTP Metrics Middleware
 * 
 * Tracks HTTP request metrics for monitoring
 */

import { Request, Response, NextFunction } from 'express';

export class HttpMetricsTracker {
  private metrics = {
    requests_total: 0,
  };

  incrementRequest(): void {
    this.metrics.requests_total++;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

// Singleton instance
export const httpMetricsTracker = new HttpMetricsTracker();

/**
 * Middleware to track HTTP requests
 */
export const httpMetricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  httpMetricsTracker.incrementRequest();
  next();
};
