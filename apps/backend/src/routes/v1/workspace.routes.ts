import { Router } from 'express';
import multer from 'multer';
import { WorkspaceController } from '../../controllers/WorkspaceController';
import { InvitationController } from '../../controllers/InvitationController';
import { requireAuth } from '../../middleware/auth';
import {
  requireWorkspace,
  requireAdmin,
  requireOwner,
} from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { csrfProtection } from '../../middleware/csrf';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  transferOwnershipSchema,
} from '../../validators/workspace.validators';
import { checkMemberLimit } from '../../middleware/planLimit';
import { protectWorkspaceFields, protectMemberFields } from '../../middleware/massAssignmentProtection';
import { requireConfirmationToken } from '../../middleware/confirmationToken';
import {
  workspaceCreateRateLimiter,
  workspaceUpdateRateLimiter,
  workspaceDeleteRateLimiter,
  uploadRateLimiter,
  invitationCreateRateLimiter,
  invitationResendRateLimiter,
  invitationRevokeRateLimiter,
  memberRemoveRateLimiter,
  memberDeactivateRateLimiter,
  memberReactivateRateLimiter,
  memberRoleChangeRateLimiter,
  memberRoleChangeUserRateLimiter,
  bulkMemberRoleUpdateRateLimiter,
  slugAvailabilityRateLimiter,
} from '../../middleware/rateLimiter';
import blackoutDatesRoutes from '../blackoutDates';

const router = Router();

// Configure multer for logo upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * Workspace routes
 * All routes require authentication
 */

// Create workspace (no workspace context needed)
router.post(
  '/',
  requireAuth,
  csrfProtection,
  workspaceCreateRateLimiter,
  validateRequest(createWorkspaceSchema),
  WorkspaceController.createWorkspace
);

// Get user's workspaces (no workspace context needed)
router.get('/', requireAuth, WorkspaceController.getUserWorkspaces);

// Get workspace details
router.get(
  '/:workspaceId',
  requireAuth,
  requireWorkspace,
  WorkspaceController.getWorkspace
);

// Update workspace (admin or owner only)
router.patch(
  '/:workspaceId',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  csrfProtection,
  workspaceUpdateRateLimiter,
  protectWorkspaceFields,
  validateRequest(updateWorkspaceSchema),
  WorkspaceController.updateWorkspace
);

// Upload workspace logo (admin or owner only)
router.post(
  '/:workspaceId/logo',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  csrfProtection,
  uploadRateLimiter,
  upload.single('logo'),
  WorkspaceController.uploadLogo
);

// Generate deletion confirmation token (owner only)
router.post(
  '/:workspaceId/delete-token',
  requireAuth,
  requireWorkspace,
  requireOwner,
  csrfProtection,
  WorkspaceController.generateDeleteToken
);

// Delete workspace (owner only)
router.delete(
  '/:workspaceId',
  requireAuth,
  requireWorkspace,
  requireOwner,
  csrfProtection,
  requireConfirmationToken,
  workspaceDeleteRateLimiter,
  WorkspaceController.deleteWorkspace
);

// Get workspace members
router.get(
  '/:workspaceId/members',
  requireAuth,
  requireWorkspace,
  WorkspaceController.getMembers
);

// Invite member (admin or owner only)
router.post(
  '/:workspaceId/members',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  csrfProtection,
  checkMemberLimit,
  validateRequest(inviteMemberSchema),
  WorkspaceController.inviteMember
);

// Remove member (admin or owner only)
router.delete(
  '/:workspaceId/members/:userId',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  csrfProtection,
  memberRemoveRateLimiter,
  WorkspaceController.removeMember
);

// Deactivate member (admin or owner only)
router.patch(
  '/:workspaceId/members/:userId/deactivate',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  csrfProtection,
  memberDeactivateRateLimiter,
  WorkspaceController.deactivateMember
);

// Reactivate member (admin or owner only)
router.patch(
  '/:workspaceId/members/:userId/reactivate',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  csrfProtection,
  memberReactivateRateLimiter,
  WorkspaceController.reactivateMember
);

// Update member role (admin or owner only)
router.patch(
  '/:workspaceId/members/:userId',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  csrfProtection,
  memberRoleChangeRateLimiter,
  memberRoleChangeUserRateLimiter,
  protectMemberFields,
  validateRequest(updateMemberRoleSchema),
  WorkspaceController.updateMemberRole
);

// Bulk update member roles (admin or owner only)
router.patch(
  '/:workspaceId/members/bulk-roles',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  csrfProtection,
  bulkMemberRoleUpdateRateLimiter,
  WorkspaceController.bulkUpdateMemberRoles
);

// Check slug availability
router.get(
  '/slug-availability/:slug',
  slugAvailabilityRateLimiter,
  WorkspaceController.checkSlugAvailability
);

// Transfer ownership (owner only)
router.post(
  '/:workspaceId/transfer-ownership',
  requireAuth,
  requireWorkspace,
  requireOwner,
  validateRequest(transferOwnershipSchema),
  WorkspaceController.transferOwnership
);

// Leave workspace
router.post(
  '/:workspaceId/leave',
  requireAuth,
  requireWorkspace,
  WorkspaceController.leaveWorkspace
);

// Email invitation routes
// Create email invitation (admin or owner only)
router.post(
  '/:workspaceId/invitations',
  invitationCreateRateLimiter,
  requireAuth,
  requireWorkspace,
  requireAdmin,
  checkMemberLimit,
  InvitationController.createInvitation
);

// Get pending invitations (admin or owner only)
router.get(
  '/:workspaceId/invitations',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  InvitationController.getPendingInvitations
);

// Resend invitation (admin or owner only)
router.post(
  '/:workspaceId/invitations/:token/resend',
  invitationResendRateLimiter,
  requireAuth,
  requireWorkspace,
  requireAdmin,
  InvitationController.resendInvitation
);

// Revoke invitation (admin or owner only)
router.delete(
  '/:workspaceId/invitations/:token',
  invitationRevokeRateLimiter,
  requireAuth,
  requireWorkspace,
  requireAdmin,
  InvitationController.revokeInvitation
);

// Bulk cancel invitations (admin or owner only)
router.delete(
  '/:workspaceId/invitations/bulk',
  invitationRevokeRateLimiter,
  requireAuth,
  requireWorkspace,
  requireAdmin,
  InvitationController.bulkCancelInvitations
);

// Get invitation stats (admin or owner only)
router.get(
  '/:workspaceId/invitations/stats',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  InvitationController.getInvitationStats
);

// Mount blackout dates routes
router.use('/', blackoutDatesRoutes);

export default router;

