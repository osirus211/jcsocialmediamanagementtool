/**
 * Raw Body Parser Middleware
 * 
 * Preserves raw request body for webhook signature verification
 * while still parsing JSON for application use
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Extend Express Request to include rawBody
 */
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

/**
 * Raw body parser middleware
 * 
 * Captures raw body before JSON parsing for signature verification
 */
export function rawBodyParser(req: Request, res: Response, next: NextFunction): void {
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    
    // Parse JSON manually
    if (req.rawBody.length > 0) {
      try {
        req.body = JSON.parse(req.rawBody.toString('utf8'));
      } catch (error: any) {
        logger.error('Failed to parse webhook body as JSON', {
          error: error.message,
          bodyLength: req.rawBody.length,
        });
        req.body = {};
      }
    }
    
    next();
  });

  req.on('error', (error) => {
    logger.error('Error reading request body', { error: error.message });
    next(error);
  });
}
