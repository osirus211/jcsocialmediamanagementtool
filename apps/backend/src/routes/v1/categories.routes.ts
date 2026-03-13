import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validate';
import { CategoryService } from '../../services/CategoryService';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

/**
 * Validation schemas
 */
const createCategoryBodySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    description: z.string().max(200).optional(),
    icon: z.string().max(50).optional(),
  }),
});

const updateCategoryBodySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    description: z.string().max(200).optional(),
    icon: z.string().max(50).optional(),
  }),
});

/**
 * @route   GET /api/v1/categories
 * @desc    Get all categories for workspace
 * @access  Private (requires auth + workspace)
 */
router.get('/', async (req, res): Promise<void> => {
  try {
    const workspaceId = req.workspace.workspaceId.toString();
    const categories = await CategoryService.getCategories(workspaceId);
    
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/v1/categories
 * @desc    Create a new category
 * @access  Private (requires auth + workspace)
 */
router.post('/', validateRequest(createCategoryBodySchema), async (req, res): Promise<void> => {
  try {
    const workspaceId = req.workspace.workspaceId.toString();
    const userId = req.user.userId;
    
    const category = await CategoryService.createCategory(workspaceId, userId, req.body);
    
    res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ success: false, error: 'Category name already exists' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

/**
 * @route   PATCH /api/v1/categories/:id
 * @desc    Update a category
 * @access  Private (requires auth + workspace)
 */
router.patch('/:id', validateRequest(updateCategoryBodySchema), async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace.workspaceId.toString();
    
    const category = await CategoryService.updateCategory(id, workspaceId, req.body);
    
    if (!category) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }
    
    res.json({ success: true, data: category });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ success: false, error: 'Category name already exists' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

/**
 * @route   DELETE /api/v1/categories/:id
 * @desc    Delete a category
 * @access  Private (requires auth + workspace)
 */
router.delete('/:id', async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace.workspaceId.toString();
    
    await CategoryService.deleteCategory(id, workspaceId);
    
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;