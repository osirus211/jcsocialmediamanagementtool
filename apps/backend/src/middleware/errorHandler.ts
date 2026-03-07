import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Log error with full context
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    requestId: req.headers['x-request-id'],
    userId: (req as any).user?.userId,
    workspaceId: req.headers['x-workspace-id'],
  });

  // Handle known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      requestId: req.headers['x-request-id'],
      ...(err.details && !isProduction && { details: err.details }),
      ...(!isProduction && { stack: err.stack }),
    });
    return;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation Error',
      message: isProduction ? 'Invalid input data' : err.message,
      requestId: req.headers['x-request-id'],
    });
    return;
  }

  // Handle Mongoose cast errors
  if (err.name === 'CastError') {
    res.status(400).json({
      error: 'Invalid ID',
      message: 'The provided ID is not valid',
      requestId: req.headers['x-request-id'],
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Invalid Token',
      message: 'The provided token is invalid',
      requestId: req.headers['x-request-id'],
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Token Expired',
      message: 'The provided token has expired',
      requestId: req.headers['x-request-id'],
    });
    return;
  }

  // Handle duplicate key errors
  if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    res.status(409).json({
      error: 'Duplicate Entry',
      message: 'A record with this value already exists',
      requestId: req.headers['x-request-id'],
    });
    return;
  }

  // Default error response - hide details in production
  res.status(500).json({
    error: 'Internal Server Error',
    message: isProduction 
      ? 'An unexpected error occurred. Please try again later.' 
      : err.message,
    requestId: req.headers['x-request-id'],
    ...(!isProduction && { stack: err.stack }),
  });
};
