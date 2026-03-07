/**
 * API Response Utilities
 * 
 * Standard response format for all API endpoints
 */

import { Response } from 'express';

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    timestamp?: string;
    requestId?: string;
    [key: string]: any;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp?: string;
    requestId?: string;
    [key: string]: any;
  };
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Send success response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: Record<string, any>
): void {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (res.locals.requestId || res.req.headers['x-request-id']) as string,
      ...meta,
    },
  };

  res.status(statusCode).json(response);
}

/**
 * Send error response
 */
export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any
): void {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (res.locals.requestId || res.req.headers['x-request-id']) as string,
    },
  };

  res.status(statusCode).json(response);
}

/**
 * Send validation error response
 */
export function sendValidationError(
  res: Response,
  errors: Array<{ field?: string; message: string }>
): void {
  sendError(res, 'VALIDATION_ERROR', 'Validation failed', 400, errors);
}

/**
 * Send not found error response
 */
export function sendNotFound(res: Response, resource: string = 'Resource'): void {
  sendError(res, 'NOT_FOUND', `${resource} not found`, 404);
}

/**
 * Send unauthorized error response
 */
export function sendUnauthorized(res: Response, message: string = 'Unauthorized'): void {
  sendError(res, 'UNAUTHORIZED', message, 401);
}

/**
 * Send forbidden error response
 */
export function sendForbidden(res: Response, message: string = 'Forbidden'): void {
  sendError(res, 'FORBIDDEN', message, 403);
}

/**
 * Send internal server error response
 */
export function sendInternalError(res: Response, message: string = 'Internal server error'): void {
  sendError(res, 'INTERNAL_ERROR', message, 500);
}
