import { Router } from 'express';
import { InvitationController } from '../../controllers/InvitationController';

const router = Router();

/**
 * Public invitation routes
 * These routes don't require authentication
 */

// Validate invitation token
router.get(
  '/:token/validate',
  InvitationController.validateInvitation
);

// Accept invitation
router.post(
  '/:token/accept',
  InvitationController.acceptInvitation
);

export default router;