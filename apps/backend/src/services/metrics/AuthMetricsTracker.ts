/**
 * Auth Metrics Tracker
 * 
 * Tracks authentication-related metrics
 */

export class AuthMetricsTracker {
  private metrics = {
    login_success_total: 0,
    register_success_total: 0,
  };

  incrementLoginSuccess(): void {
    this.metrics.login_success_total++;
  }

  incrementRegisterSuccess(): void {
    this.metrics.register_success_total++;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

// Singleton instance
export const authMetricsTracker = new AuthMetricsTracker();
