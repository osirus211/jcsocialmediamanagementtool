import { Router } from 'express';
import { GDPRController } from '../../controllers/GDPRController';
import { requireAuth } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validate';
import { z } from 'zod';

const router = Router();

// Validation schemas
const deleteAccountSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'Password is required'),
    gracePeriodDays: z.number().min(1).max(90).optional(),
    anonymizeAuditLogs: z.boolean().optional(),
    revokeOAuthTokens: z.boolean().optional(),
    cancelSubscriptions: z.boolean().optional(),
  }),
});

const cancelDeletionSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'Password is required'),
  }),
});

const consentSchema = z.object({
  body: z.object({
    marketingEmails: z.boolean().optional(),
    analyticsTracking: z.boolean().optional(),
    functionalCookies: z.boolean().optional(),
  }),
});

const exportFormatSchema = z.object({
  query: z.object({
    format: z.enum(['json', 'csv']).optional(),
  }),
});

/**
 * GDPR Compliance Routes
 * All routes require authentication
 */

// Data export (Right to Data Portability - Article 20)
router.get(
  '/export',
  requireAuth,
  validateRequest(exportFormatSchema),
  GDPRController.exportUserData
);

// Request account deletion (Right to Erasure - Article 17)
router.post(
  '/delete-account',
  requireAuth,
  validateRequest(deleteAccountSchema),
  GDPRController.requestAccountDeletion
);

// Cancel account deletion request
router.post(
  '/cancel-deletion',
  requireAuth,
  validateRequest(cancelDeletionSchema),
  GDPRController.cancelAccountDeletion
);

// Get GDPR request history
router.get(
  '/requests',
  requireAuth,
  GDPRController.getGDPRRequests
);

// Get data summary (Right of Access - Article 15)
router.get(
  '/data-summary',
  requireAuth,
  GDPRController.getDataSummary
);

// Download exported data
router.get(
  '/download/:requestId',
  requireAuth,
  GDPRController.downloadExportedData
);

// Update consent preferences
router.post(
  '/consent',
  requireAuth,
  validateRequest(consentSchema),
  GDPRController.updateConsent
);

export default router;
