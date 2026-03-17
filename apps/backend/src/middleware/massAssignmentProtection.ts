import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Mass assignment protection middleware
 * Prevents updating sensitive fields through API requests
 */
export const protectWorkspaceFields = (req: Request, res: Response, next: NextFunction): void | Response => {
  const protectedFields = [
    'ownerId',
    'plan', 
    'stripeCustomerId',
    'subscriptionId',
    'subscriptionStatus',
    'usage',
    'limits',
    'createdAt',
    'updatedAt',
    'deletedAt',
    '_id'
  ];

  const attemptedFields = Object.keys(req.body);
  const blockedFields = attemptedFields.filter(field => protectedFields.includes(field));

  if (blockedFields.length > 0) {
    logger.warn('Mass assignment attempt blocked', {
      userId: req.user?.userId,
      workspaceId: req.workspace?.workspaceId,
      blockedFields,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(422).json({
      code: 'INVALID_FIELDS',
      message: 'Cannot update protected fields',
      details: {
        blockedFields,
        allowedFields: [
          'name',
          'slug', 
          'description',
          'settings',
          'billingEmail',
          'clientPortal'
        ]
      }
    });
  }

  next();
};

/**
 * Protect member role assignment
 */
export const protectMemberFields = (req: Request, res: Response, next: NextFunction): void | Response => {
  const protectedFields = [
    'workspaceId',
    'userId',
    'invitedBy',
    'invitedAt',
    'joinedAt',
    'createdAt',
    'updatedAt',
    '_id'
  ];

  const attemptedFields = Object.keys(req.body);
  const blockedFields = attemptedFields.filter(field => protectedFields.includes(field));

  if (blockedFields.length > 0) {
    logger.warn('Member mass assignment attempt blocked', {
      userId: req.user?.userId,
      workspaceId: req.workspace?.workspaceId,
      blockedFields,
      ip: req.ip
    });

    return res.status(422).json({
      code: 'INVALID_FIELDS',
      message: 'Cannot update protected member fields',
      details: {
        blockedFields,
        allowedFields: ['role']
      }
    });
  }

  next();
};