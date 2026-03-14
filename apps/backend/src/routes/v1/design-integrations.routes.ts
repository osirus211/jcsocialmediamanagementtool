/**
 * Design Integrations Routes
 * 
 * Handles Canva and Figma integration endpoints
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { CanvaService } from '../../services/CanvaService';
import { FigmaService } from '../../services/FigmaService';
import { Workspace } from '../../models/Workspace';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

// ============================================
// CANVA ROUTES
// ============================================

/**
 * GET /design-integrations/canva/auth-url
 * Get Canva OAuth authorization URL
 */
router.get('/canva/auth-url', async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const authUrl = CanvaService.getAuthUrl(workspaceId.toString());

    res.json({
      success: true,
      authUrl,
    });
  } catch (error: any) {
    logger.error('Failed to get Canva auth URL', {
      error: error.message,
      workspaceId: req.workspace?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get authorization URL',
    });
  }
});

/**
 * GET /design-integrations/canva/callback
 * Handle Canva OAuth callback
 */
router.get('/canva/callback', [
  query('code').notEmpty().withMessage('Authorization code is required'),
  query('state').notEmpty().withMessage('State parameter is required'),
  validateRequest,
], async (req, res): Promise<void> => {
  try {
    const { code, state } = req.query as { code: string; state: string };

    const result = await CanvaService.handleCallback(code, state);

    res.json({
      success: true,
      message: 'Canva account connected successfully',
      data: {
        userId: result.userId,
        displayName: result.displayName,
      },
    });
  } catch (error: any) {
    logger.error('Failed to handle Canva callback', {
      error: error.message,
    });

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /design-integrations/canva/designs
 * List user's Canva designs
 */
router.get('/canva/designs', [
  query('page').optional().isString(),
  query('query').optional().isString(),
  validateRequest,
], async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { page, query: searchQuery } = req.query as { page?: string; query?: string };

    // Get workspace to check connection
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace?.integrations?.canva?.connected || !workspace.integrations.canva.accessToken) {
      res.status(400).json({
        success: false,
        message: 'Canva account not connected',
      });
      return;
    }

    const result = await CanvaService.getUserDesigns(
      workspace.integrations.canva.accessToken,
      page,
      searchQuery
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to get Canva designs', {
      error: error.message,
      workspaceId: req.workspace?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch designs',
    });
  }
});

/**
 * POST /design-integrations/canva/export
 * Export a Canva design
 */
router.post('/canva/export', [
  body('designId').notEmpty().withMessage('Design ID is required'),
  body('format').optional().isIn(['png', 'jpg']).withMessage('Format must be png or jpg'),
  validateRequest,
], async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { designId, format = 'png' } = req.body;

    // Get workspace to check connection
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace?.integrations?.canva?.connected || !workspace.integrations.canva.accessToken) {
      res.status(400).json({
        success: false,
        message: 'Canva account not connected',
      });
      return;
    }

    const result = await CanvaService.exportDesign(
      workspace.integrations.canva.accessToken,
      designId,
      format
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to export Canva design', {
      error: error.message,
      workspaceId: req.workspace?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to export design',
    });
  }
});

/**
 * GET /design-integrations/canva/export/:jobId
 * Get Canva export job status
 */
router.get('/canva/export/:jobId', [
  param('jobId').notEmpty().withMessage('Job ID is required'),
  validateRequest,
], async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { jobId } = req.params;

    // Get workspace to check connection
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace?.integrations?.canva?.connected || !workspace.integrations.canva.accessToken) {
      res.status(400).json({
        success: false,
        message: 'Canva account not connected',
      });
      return;
    }

    const result = await CanvaService.getExportStatus(
      workspace.integrations.canva.accessToken,
      jobId
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to get Canva export status', {
      error: error.message,
      workspaceId: req.workspace?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get export status',
    });
  }
});

/**
 * DELETE /design-integrations/canva/disconnect
 * Disconnect Canva integration
 */
router.delete('/canva/disconnect', async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;

    await CanvaService.disconnectCanva(workspaceId.toString());

    res.json({
      success: true,
      message: 'Canva account disconnected successfully',
    });
  } catch (error: any) {
    logger.error('Failed to disconnect Canva', {
      error: error.message,
      workspaceId: req.workspace?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to disconnect Canva account',
    });
  }
});

// ============================================
// FIGMA ROUTES
// ============================================

/**
 * GET /design-integrations/figma/auth-url
 * Get Figma OAuth authorization URL
 */
router.get('/figma/auth-url', async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const authUrl = FigmaService.getAuthUrl(workspaceId.toString());

    res.json({
      success: true,
      authUrl,
    });
  } catch (error: any) {
    logger.error('Failed to get Figma auth URL', {
      error: error.message,
      workspaceId: req.workspace?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get authorization URL',
    });
  }
});

/**
 * GET /design-integrations/figma/callback
 * Handle Figma OAuth callback
 */
router.get('/figma/callback', [
  query('code').notEmpty().withMessage('Authorization code is required'),
  query('state').notEmpty().withMessage('State parameter is required'),
  validateRequest,
], async (req, res): Promise<void> => {
  try {
    const { code, state } = req.query as { code: string; state: string };

    const result = await FigmaService.handleCallback(code, state);

    res.json({
      success: true,
      message: 'Figma account connected successfully',
      data: {
        userId: result.userId,
        displayName: result.displayName,
      },
    });
  } catch (error: any) {
    logger.error('Failed to handle Figma callback', {
      error: error.message,
    });

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /design-integrations/figma/files
 * List user's Figma files
 */
router.get('/figma/files', async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;

    // Get workspace to check connection
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace?.integrations?.figma?.connected || !workspace.integrations.figma.accessToken) {
      res.status(400).json({
        success: false,
        message: 'Figma account not connected',
      });
      return;
    }

    const result = await FigmaService.getUserFiles(workspace.integrations.figma.accessToken);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to get Figma files', {
      error: error.message,
      workspaceId: req.workspace?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch files',
    });
  }
});

/**
 * GET /design-integrations/figma/files/:fileKey/frames
 * Get frames from a Figma file
 */
router.get('/figma/files/:fileKey/frames', [
  param('fileKey').notEmpty().withMessage('File key is required'),
  validateRequest,
], async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { fileKey } = req.params;

    // Get workspace to check connection
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace?.integrations?.figma?.connected || !workspace.integrations.figma.accessToken) {
      res.status(400).json({
        success: false,
        message: 'Figma account not connected',
      });
      return;
    }

    const result = await FigmaService.getFileFrames(
      workspace.integrations.figma.accessToken,
      fileKey
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to get Figma file frames', {
      error: error.message,
      workspaceId: req.workspace?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch frames',
    });
  }
});

/**
 * POST /design-integrations/figma/export
 * Export a Figma frame
 */
router.post('/figma/export', [
  body('fileKey').notEmpty().withMessage('File key is required'),
  body('nodeId').notEmpty().withMessage('Node ID is required'),
  body('format').optional().isIn(['png', 'jpg']).withMessage('Format must be png or jpg'),
  validateRequest,
], async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { fileKey, nodeId, format = 'png' } = req.body;

    // Get workspace to check connection
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace?.integrations?.figma?.connected || !workspace.integrations.figma.accessToken) {
      res.status(400).json({
        success: false,
        message: 'Figma account not connected',
      });
      return;
    }

    const result = await FigmaService.exportFrame(
      workspace.integrations.figma.accessToken,
      fileKey,
      nodeId,
      format
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to export Figma frame', {
      error: error.message,
      workspaceId: req.workspace?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to export frame',
    });
  }
});

/**
 * DELETE /design-integrations/figma/disconnect
 * Disconnect Figma integration
 */
router.delete('/figma/disconnect', async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;

    await FigmaService.disconnectFigma(workspaceId.toString());

    res.json({
      success: true,
      message: 'Figma account disconnected successfully',
    });
  } catch (error: any) {
    logger.error('Failed to disconnect Figma', {
      error: error.message,
      workspaceId: req.workspace?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to disconnect Figma account',
    });
  }
});

export default router;
