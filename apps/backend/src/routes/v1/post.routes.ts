import { Router } from 'express';
import { postController } from '../../controllers/PostController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { checkPostLimit } from '../../middleware/planLimit';
import { requirePostOwnershipOrAdmin } from '../../middleware/rbac';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * Post Routes
 * Base: /api/v1/posts
 */

// Get calendar view (must be before /:id to avoid conflict)
router.get('/calendar', postController.getCalendar.bind(postController));

// Get post statistics
router.get('/stats', postController.getPostStats.bind(postController));

// Create post
router.post('/', checkPostLimit, postController.createPost.bind(postController));

// Get posts with filters
router.get('/', postController.getPosts.bind(postController));

// Get single post
router.get('/:id', postController.getPostById.bind(postController));

// Update post (requires post ownership or admin)
router.patch('/:id', requirePostOwnershipOrAdmin, postController.updatePost.bind(postController));

// Delete post (requires post ownership or admin)
router.delete('/:id', requirePostOwnershipOrAdmin, postController.deletePost.bind(postController));

// Schedule post (requires post ownership or admin)
// router.post('/:id/schedule', requirePostOwnershipOrAdmin, postController.schedulePost.bind(postController));

// Cancel scheduled post (requires post ownership or admin)  
// router.post('/:id/cancel', requirePostOwnershipOrAdmin, postController.cancelPost.bind(postController));

// Retry failed post (requires post ownership or admin)
router.post('/:id/retry', requirePostOwnershipOrAdmin, postController.retryPost.bind(postController));

export default router;
