import { Router } from 'express';
import multer from 'multer';
import { WorkspaceController } from '../../controllers/WorkspaceController';
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
  WorkspaceController.removeMember
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

export default router;
