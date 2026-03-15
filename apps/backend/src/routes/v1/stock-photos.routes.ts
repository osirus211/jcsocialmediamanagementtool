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
 * Search stock photos from Unsplash, Pexels, and/or Pixabay
 */
router.get('/search', [
  query('q').notEmpty().withMessage('Search query is required'),
  query('source').optional().isIn(['unsplash', 'pexels', 'pixabay', 'all']).withMessage('Source must be unsplash, pexels, pixabay, or all'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('perPage').optional().isInt({ min: 1, max: 50 }).withMessage('Per page must be between 1 and 50'),
  query('orientation').optional().isIn(['all', 'horizontal', 'vertical']).withMessage('Orientation must be all, horizontal, or vertical'),
  query('category').optional().isString().withMessage('Category must be a string'),
  query('colors').optional().isString().withMessage('Colors must be a string'),
  validateRequest,
], async (req, res) => {
  try {
    const { 
      q: query, 
      source = 'all', 
      page = 1, 
      perPage = 20,
      orientation,
      category,
      colors
    } = req.query as {
      q: string;
      source?: 'unsplash' | 'pexels' | 'pixabay' | 'all';
      page?: number;
      perPage?: number;
      orientation?: 'all' | 'horizontal' | 'vertical';
      category?: string;
      colors?: string;
    };

    const filters = {
      orientation,
      category,
      colors,
    };

    let result;

    if (source === 'unsplash') {
      result = await StockPhotoService.searchUnsplash(query, Number(page), Number(perPage));
    } else if (source === 'pexels') {
      result = await StockPhotoService.searchPexels(query, Number(page), Number(perPage));
    } else if (source === 'pixabay') {
      result = await StockPhotoService.searchPixabay(query, Number(page), Number(perPage), filters);
    } else {
      // Search all sources and combine results
      const promises = [];
      const perSource = Math.ceil(Number(perPage) / 3);

      promises.push(
        StockPhotoService.searchUnsplash(query, Number(page), perSource).catch(() => ({ photos: [], total: 0, totalPages: 0 }))
      );
      promises.push(
        StockPhotoService.searchPexels(query, Number(page), perSource).catch(() => ({ photos: [], total: 0, totalPages: 0 }))
      );
      promises.push(
        StockPhotoService.searchPixabay(query, Number(page), perSource, filters).catch(() => ({ photos: [], total: 0, totalPages: 0 }))
      );

      const results = await Promise.allSettled(promises);
      const allPhotos = [];
      let totalResults = 0;
      let totalPages = 0;

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          allPhotos.push(...result.value.photos);
          totalResults += result.value.total;
          totalPages = Math.max(totalPages, result.value.totalPages);
        }
      });

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
 * GET /stock-photos/pixabay/:id
 * Get single Pixabay photo
 */
router.get('/pixabay/:id', [
  param('id').notEmpty().withMessage('Photo ID is required'),
  validateRequest,
], async (req, res) => {
  try {
    const { id } = req.params;

    const photo = await StockPhotoService.getPixabayPhoto(id);

    res.json({
      success: true,
      data: photo,
    });
  } catch (error: any) {
    logger.error('Failed to get Pixabay photo', {
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
