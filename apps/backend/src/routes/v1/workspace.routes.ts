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
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  transferOwnershipSchema,
} from '../../validators/workspace.validators';
import { checkMemberLimit } from '../../middleware/planLimit';
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
} from '../../middleware/rateLimiter';

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
  workspaceUpdateRateLimiter,
  validateRequest(updateWorkspaceSchema),
  WorkspaceController.updateWorkspace
);

// Upload workspace logo (admin or owner only)
router.post(
  '/:workspaceId/logo',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  uploadRateLimiter,
  upload.single('logo'),
  WorkspaceController.uploadLogo
);

// Delete workspace (owner only)
router.delete(
  '/:workspaceId',
  requireAuth,
  requireWorkspace,
  requireOwner,
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
  memberRemoveRateLimiter,
  WorkspaceController.removeMember
);

// Deactivate member (admin or owner only)
router.patch(
  '/:workspaceId/members/:userId/deactivate',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  memberDeactivateRateLimiter,
  WorkspaceController.deactivateMember
);

// Reactivate member (admin or owner only)
router.patch(
  '/:workspaceId/members/:userId/reactivate',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  memberReactivateRateLimiter,
  WorkspaceController.reactivateMember
);

// Update member role (admin or owner only)
router.patch(
  '/:workspaceId/members/:userId',
  requireAuth,
  requireWorkspace,
  requireAdmin,
  validateRequest(updateMemberRoleSchema),
  WorkspaceController.updateMemberRole
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

export default router;
