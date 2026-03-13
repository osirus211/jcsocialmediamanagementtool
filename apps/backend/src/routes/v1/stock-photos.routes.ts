/**
 * Stock Photos Routes
 * 
 * Handles Unsplash and Pexels stock photo endpoints
 */

import { Router } from 'express';
import { query, param, body } from 'express-validator';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { StockPhotoService } from '../../services/StockPhotoService';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

/**
 * GET /stock-photos/search
 * Search stock photos from Unsplash and/or Pexels
 */
router.get('/search', [
  query('q').notEmpty().withMessage('Search query is required'),
  query('source').optional().isIn(['unsplash', 'pexels', 'both']).withMessage('Source must be unsplash, pexels, or both'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('perPage').optional().isInt({ min: 1, max: 50 }).withMessage('Per page must be between 1 and 50'),
  validateRequest,
], async (req, res) => {
  try {
    const { q: query, source = 'both', page = 1, perPage = 20 } = req.query as {
      q: string;
      source?: 'unsplash' | 'pexels' | 'both';
      page?: number;
      perPage?: number;
    };

    let result;

    if (source === 'unsplash') {
      result = await StockPhotoService.searchUnsplash(query, Number(page), Number(perPage));
    } else if (source === 'pexels') {
      result = await StockPhotoService.searchPexels(query, Number(page), Number(perPage));
    } else {
      // Search both sources and combine results
      const [unsplashResult, pexelsResult] = await Promise.allSettled([
        StockPhotoService.searchUnsplash(query, Number(page), Math.ceil(Number(perPage) / 2)),
        StockPhotoService.searchPexels(query, Number(page), Math.ceil(Number(perPage) / 2)),
      ]);

      const allPhotos = [];
      let totalResults = 0;
      let totalPages = 0;

      if (unsplashResult.status === 'fulfilled') {
        allPhotos.push(...unsplashResult.value.photos);
        totalResults += unsplashResult.value.total;
        totalPages = Math.max(totalPages, unsplashResult.value.totalPages);
      }

      if (pexelsResult.status === 'fulfilled') {
        allPhotos.push(...pexelsResult.value.photos);
        totalResults += pexelsResult.value.total;
        totalPages = Math.max(totalPages, pexelsResult.value.totalPages);
      }

      // Shuffle to mix sources
      const shuffledPhotos = allPhotos.sort(() => Math.random() - 0.5);

      result = {
        photos: shuffledPhotos.slice(0, Number(perPage)),
        total: totalResults,
        totalPages,
      };
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to search stock photos', {
      error: error.message,
      workspaceId: req.user?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to search stock photos',
    });
  }
});

/**
 * GET /stock-photos/curated
 * Get curated/trending photos from both sources
 */
router.get('/curated', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('perPage').optional().isInt({ min: 1, max: 50 }).withMessage('Per page must be between 1 and 50'),
  validateRequest,
], async (req, res) => {
  try {
    const { page = 1, perPage = 20 } = req.query as {
      page?: number;
      perPage?: number;
    };

    const result = await StockPhotoService.getCuratedPhotos(Number(page), Number(perPage));

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to get curated photos', {
      error: error.message,
      workspaceId: req.user?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get curated photos',
    });
  }
});

/**
 * GET /stock-photos/unsplash/:id
 * Get single Unsplash photo
 */
router.get('/unsplash/:id', [
  param('id').notEmpty().withMessage('Photo ID is required'),
  validateRequest,
], async (req, res) => {
  try {
    const { id } = req.params;

    const photo = await StockPhotoService.getUnsplashPhoto(id);

    res.json({
      success: true,
      data: photo,
    });
  } catch (error: any) {
    logger.error('Failed to get Unsplash photo', {
      error: error.message,
      photoId: req.params.id,
      workspaceId: req.user?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get photo',
    });
  }
});

/**
 * GET /stock-photos/pexels/:id
 * Get single Pexels photo
 */
router.get('/pexels/:id', [
  param('id').notEmpty().withMessage('Photo ID is required'),
  validateRequest,
], async (req, res) => {
  try {
    const { id } = req.params;

    const photo = await StockPhotoService.getPexelsPhoto(id);

    res.json({
      success: true,
      data: photo,
    });
  } catch (error: any) {
    logger.error('Failed to get Pexels photo', {
      error: error.message,
      photoId: req.params.id,
      workspaceId: req.user?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get photo',
    });
  }
});

/**
 * POST /stock-photos/track-download
 * Track Unsplash download (required by API terms)
 */
router.post('/track-download', [
  body('downloadLocation').notEmpty().withMessage('Download location is required'),
  validateRequest,
], async (req, res) => {
  try {
    const { downloadLocation } = req.body;

    await StockPhotoService.trackUnsplashDownload(downloadLocation);

    res.json({
      success: true,
      message: 'Download tracked successfully',
    });
  } catch (error: any) {
    logger.error('Failed to track download', {
      error: error.message,
      workspaceId: req.user?.workspaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to track download',
    });
  }
});

export default router;