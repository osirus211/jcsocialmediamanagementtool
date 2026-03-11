import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/workspace';
import { validateBody } from '../../middleware/validation';
import { CampaignService } from '../../services/CampaignService';
import { CampaignStatus } from '../../models/Campaign';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * Validation schemas
 */
const createCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  status: z.enum([CampaignStatus.DRAFT, CampaignStatus.ACTIVE, CampaignStatus.PAUSED, CampaignStatus.COMPLETED]).optional(),
  startDate: z.string().transform(val => val ? new Date(val) : undefined).optional(),
  endDate: z.string().transform(val => val ? new Date(val) : undefined).optional(),
  goals: z.string().max(1000).optional(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  status: z.enum([CampaignStatus.DRAFT, CampaignStatus.ACTIVE, CampaignStatus.PAUSED, CampaignStatus.COMPLETED]).optional(),
  startDate: z.string().transform(val => val ? new Date(val) : undefined).optional(),
  endDate: z.string().transform(val => val ? new Date(val) : undefined).optional(),
  goals: z.string().max(1000).optional(),
});

/**
 * @route   GET /api/v1/campaigns
 * @desc    Get all campaigns for workspace
 * @access  Private (requires auth + workspace)
 * @query   status (optional)
 */
router.get('/', async (req, res) => {
  try {
    const workspaceId = req.workspace._id.toString();
    const { status } = req.query;
    
    const filters = status ? { status: status as CampaignStatus } : undefined;
    const campaigns = await CampaignService.getCampaigns(workspaceId, filters);
    
    res.json({ success: true, data: campaigns });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/v1/campaigns
 * @desc    Create a new campaign
 * @access  Private (requires auth + workspace)
 */
router.post('/', validateBody(createCampaignSchema), async (req, res) => {
  try {
    const workspaceId = req.workspace._id.toString();
    const userId = req.user._id.toString();
    
    const campaign = await CampaignService.createCampaign(workspaceId, userId, req.body);
    
    res.status(201).json({ success: true, data: campaign });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/v1/campaigns/:id
 * @desc    Get campaign with stats
 * @access  Private (requires auth + workspace)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace._id.toString();
    
    const [campaign, stats] = await Promise.all([
      CampaignService.getCampaign(id, workspaceId),
      CampaignService.getCampaignStats(id, workspaceId)
    ]);
    
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    
    res.json({ success: true, data: { ...campaign.toJSON(), stats } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   PATCH /api/v1/campaigns/:id
 * @desc    Update a campaign
 * @access  Private (requires auth + workspace)
 */
router.patch('/:id', validateBody(updateCampaignSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace._id.toString();
    
    const campaign = await CampaignService.updateCampaign(id, workspaceId, req.body);
    
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    
    res.json({ success: true, data: campaign });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   DELETE /api/v1/campaigns/:id
 * @desc    Delete a campaign
 * @access  Private (requires auth + workspace)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace._id.toString();
    
    await CampaignService.deleteCampaign(id, workspaceId);
    
    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/v1/campaigns/:id/posts
 * @desc    Get all posts for a campaign
 * @access  Private (requires auth + workspace)
 */
router.get('/:id/posts', async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace._id.toString();
    
    const posts = await CampaignService.getCampaignPosts(id, workspaceId);
    
    res.json({ success: true, data: posts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;