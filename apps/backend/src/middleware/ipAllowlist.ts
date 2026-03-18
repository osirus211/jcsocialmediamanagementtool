import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Workspace IP Allowlist Middleware
 * 
 * Enforces IP allowlisting at the workspace level.
 * Should be applied after requireWorkspace middleware.
 */
export const workspaceIpAllowlist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspaceContext = req.workspace;
    
    // Skip if no workspace context
    if (!workspaceContext) {
      return next();
    }
    
    // Fetch full workspace object to check IP allowlist settings
    const { Workspace } = await import('../models/Workspace');
    const workspace = await Workspace.findById(workspaceContext.workspaceId);
    
    if (!workspace) {
      return next();
    }
    
    // Skip if IP allowlisting is not enabled for this workspace
    if (!workspace.ipAllowlistEnabled) {
      return next();
    }
    
    // Skip if no IPs are configured (fail-open for safety)
    if (!workspace.ipAllowlist || workspace.ipAllowlist.length === 0) {
      return next();
    }
    
    // Get client IP address
    const clientIp = req.ip || 
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.headers['x-real-ip']?.toString() ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown';
    
    // Check if client IP is in allowlist
    if (!workspace.ipAllowlist.includes(clientIp)) {
      logger.warn('IP address blocked by workspace allowlist', {
        workspaceId: workspace._id,
        clientIp,
        allowedIps: workspace.ipAllowlist,
        userAgent: req.headers['user-agent'],
        path: req.path,
      });
      
      res.status(403).json({
        success: false,
        code: 'IP_NOT_ALLOWED',
        message: 'Access denied from this IP address'
      });
      return;
    }
    
    // IP is allowed, continue
    logger.debug('IP address allowed by workspace allowlist', {
      workspaceId: workspace._id,
      clientIp,
    });
    
    next();
  } catch (error: any) {
    logger.error('Error in workspace IP allowlist middleware', {
      error: error.message,
      stack: error.stack,
    });
    
    // Fail-open for safety - don't block requests on middleware errors
    next();
  }
};