/**
 * Response Time Tracker Middleware
 * 
 * Tracks API response times for connection health monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { ConnectionHealthService } from '../services/ConnectionHealthService';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

const redis = getRedisClient();
const healthService = new ConnectionHealthService(redis);

/**
 * Middleware to track response times for social media API calls
 */
export const responseTimeTracker = (req: any, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Store original end method
  const originalEnd = res.end.bind(res);
  
  // Override end method to capture response time
  res.end = function(...args: any[]): Response {
    const responseTime = Date.now() - startTime;
    
    // Only track for authenticated requests with social account context
    if (req.socialAccount && req.workspace) {
      const { provider, accountId } = req.socialAccount;
      
      // Record response time asynchronously (don't block response)
      setImmediate(async () => {
        try {
          await healthService.recordApiResponseTime(provider, accountId, responseTime);
          
          logger.debug('API response time recorded', {
            provider,
            accountId,
            responseTime,
            path: req.path,
            method: req.method,
            statusCode: res.statusCode
          });
        } catch (error: any) {
          logger.error('Failed to record API response time', {
            provider,
            accountId,
            responseTime,
            error: error.message
          });
        }
      });
    }
    
    // Call original end method
    return originalEnd(...args);
  };

  next();
};

/**
 * Middleware to extract social account context from request
 * Should be used on routes that interact with specific social accounts
 */
export const setSocialAccountContext = (provider: string) => {
  return (req: any, res: Response, next: NextFunction) => {
    const accountId = req.params.accountId || req.body.accountId || req.query.accountId;
    
    if (accountId) {
      req.socialAccount = {
        provider,
        accountId: accountId as string
      };
    }
    
    next();
  };
};

/**
 * Generic middleware that tries to extract social account from various sources
 */
export const extractSocialAccountContext = (req: any, res: Response, next: NextFunction) => {
  // Try to extract from URL path
  const pathParts = req.path.split('/');
  
  // Look for platform names in path
  const platforms = ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'bluesky', 'mastodon', 'reddit'];
  const platform = pathParts.find(part => platforms.includes(part));
  
  if (platform) {
    const accountId = req.params.accountId || req.body.accountId || req.query.accountId;
    
    if (accountId) {
      req.socialAccount = {
        provider: platform,
        accountId: accountId as string
      };
    }
  }
  
  next();
};