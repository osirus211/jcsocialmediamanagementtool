/**
 * Plan Limit Error
 * 
 * Thrown when workspace exceeds plan limits
 * Used for hard stops (no queue entry, no retry)
 */

export class PlanLimitError extends Error {
  public readonly statusCode: number = 403;
  public readonly code: string = 'PLAN_LIMIT_EXCEEDED';
  public readonly limitType: string;
  public readonly currentUsage: number;
  public readonly limit: number;

  constructor(
    message: string,
    limitType: string,
    currentUsage: number,
    limit: number
  ) {
    super(message);
    this.name = 'PlanLimitError';
    this.limitType = limitType;
    this.currentUsage = currentUsage;
    this.limit = limit;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}
