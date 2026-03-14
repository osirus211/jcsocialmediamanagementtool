import { Router } from 'express';
import { HashtagGroupsService } from '../../services/HashtagGroupsService';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validateHashtagGroup = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('hashtags')
    .isArray({ min: 1, max: 50 })
    .withMessage('Hashtags must be an array with 1-50 items'),
  body('hashtags.*')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Each hashtag must be between 2-100 characters'),
  body('platform')
    .isIn(['instagram', 'twitter', 'tiktok', 'linkedin', 'facebook', 'all'])
    .withMessage('Invalid platform')
];

const validateUpdateHashtagGroup = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('hashtags')
    .optional()
    .isArray({ min: 1, max: 50 })
    .withMessage('Hashtags must be an array with 1-50 items'),
  body('hashtags.*')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Each hashtag must be between 2-100 characters'),
  body('platform')
    .optional()
    .isIn(['instagram', 'twitter', 'tiktok', 'linkedin', 'facebook', 'all'])
    .withMessage('Invalid platform')
];

// GET /api/v1/hashtag-groups - Get all hashtag groups for workspace
router.get('/', 
  requireAuth,
  requireWorkspace,
  query('platform').optional().isIn(['instagram', 'twitter', 'tiktok', 'linkedin', 'facebook', 'all']),
  query('search').optional().trim().isLength({ min: 1, max: 100 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed',
          errors: errors.array() 
        });
      }

      const workspaceId = req.workspace!.workspaceId.toString();
      const platform = req.query.platform as string;
      const search = req.query.search as string;

      let hashtagGroups;
      
      if (search) {
        hashtagGroups = await HashtagGroupsService.searchHashtagGroups(
          workspaceId, 
          search, 
          platform
        );
      } else {
        hashtagGroups = await HashtagGroupsService.getHashtagGroups(
          workspaceId, 
          platform
        );
      }

      return res.json({
        success: true,
        data: hashtagGroups
      });
    } catch (error) {
      console.error('Error fetching hashtag groups:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch hashtag groups'
      });
    }
  }
);

// GET /api/v1/hashtag-groups/:id - Get specific hashtag group
router.get('/:id',
  requireAuth,
  requireWorkspace,
  param('id').isMongoId().withMessage('Invalid group ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed',
          errors: errors.array() 
        });
      }

      const workspaceId = req.workspace!.workspaceId.toString();
      const groupId = req.params.id;

      const hashtagGroup = await HashtagGroupsService.getHashtagGroupById(
        groupId, 
        workspaceId
      );

      if (!hashtagGroup) {
        return res.status(404).json({
          success: false,
          message: 'Hashtag group not found'
        });
      }

      return res.json({
        success: true,
        data: hashtagGroup
      });
    } catch (error) {
      console.error('Error fetching hashtag group:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch hashtag group'
      });
    }
  }
);

// POST /api/v1/hashtag-groups - Create new hashtag group
router.post('/',
  requireAuth,
  requireWorkspace,
  validateHashtagGroup,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed',
          errors: errors.array() 
        });
      }

      const workspaceId = req.workspace!.workspaceId.toString();
      const userId = req.user!.userId.toString();
      const { name, hashtags, platform } = req.body;

      const hashtagGroup = await HashtagGroupsService.createHashtagGroup({
        name,
        hashtags,
        platform,
        workspaceId,
        createdBy: userId
      });

      return res.status(201).json({
        success: true,
        data: hashtagGroup,
        message: 'Hashtag group created successfully'
      });
    } catch (error: any) {
      console.error('Error creating hashtag group:', error);
      
      if (error.message === 'A hashtag group with this name already exists') {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to create hashtag group'
      });
    }
  }
);

// PATCH /api/v1/hashtag-groups/:id - Update hashtag group
router.patch('/:id',
  requireAuth,
  requireWorkspace,
  param('id').isMongoId().withMessage('Invalid group ID'),
  validateUpdateHashtagGroup,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed',
          errors: errors.array() 
        });
      }

      const workspaceId = req.workspace!.workspaceId.toString();
      const groupId = req.params.id;
      const updateData = req.body;

      const hashtagGroup = await HashtagGroupsService.updateHashtagGroup(
        groupId,
        workspaceId,
        updateData
      );

      if (!hashtagGroup) {
        return res.status(404).json({
          success: false,
          message: 'Hashtag group not found'
        });
      }

      return res.json({
        success: true,
        data: hashtagGroup,
        message: 'Hashtag group updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating hashtag group:', error);
      
      if (error.message === 'A hashtag group with this name already exists') {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to update hashtag group'
      });
    }
  }
);

// DELETE /api/v1/hashtag-groups/:id - Delete hashtag group
router.delete('/:id',
  requireAuth,
  requireWorkspace,
  param('id').isMongoId().withMessage('Invalid group ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed',
          errors: errors.array() 
        });
      }

      const workspaceId = req.workspace!.workspaceId.toString();
      const groupId = req.params.id;

      const deleted = await HashtagGroupsService.deleteHashtagGroup(
        groupId,
        workspaceId
      );

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Hashtag group not found'
        });
      }

      return res.json({
        success: true,
        message: 'Hashtag group deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting hashtag group:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete hashtag group'
      });
    }
  }
);

export default router;


