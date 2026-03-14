import { Router } from 'express';
import { GiphyService } from '../services/GiphyService';
import { requireAuth } from '../middleware/auth';
import { query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();
const giphyService = new GiphyService();

// Validation middleware
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// Apply authentication to all routes
router.use(requireAuth);

/**
 * Search GIFs
 * GET /api/v1/giphy/search?q=query&limit=20&offset=0
 */
router.get('/search', [
  query('q').notEmpty().withMessage('Search query is required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  query('rating').optional().isIn(['y', 'g', 'pg', 'pg-13', 'r']).withMessage('Invalid rating'),
  validateRequest
], async (req, res) => {
  try {
    const { q, limit = 20, offset = 0, rating = 'g' } = req.query;

    const result = await giphyService.searchGifs(
      q as string,
      parseInt(limit as string),
      parseInt(offset as string),
      rating as string
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Failed to search GIFs', { error, query: req.query });
    res.status(500).json({
      success: false,
      error: 'Failed to search GIFs'
    });
  }
});

/**
 * Get trending GIFs
 * GET /api/v1/giphy/trending?limit=20
 */
router.get('/trending', [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('rating').optional().isIn(['y', 'g', 'pg', 'pg-13', 'r']).withMessage('Invalid rating'),
  validateRequest
], async (req, res) => {
  try {
    const { limit = 20, rating = 'g' } = req.query;

    const result = await giphyService.getTrending(
      parseInt(limit as string),
      rating as string
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Failed to get trending GIFs', { error, query: req.query });
    res.status(500).json({
      success: false,
      error: 'Failed to get trending GIFs'
    });
  }
});

/**
 * Search stickers
 * GET /api/v1/giphy/stickers?q=query&limit=20&offset=0
 */
router.get('/stickers', [
  query('q').notEmpty().withMessage('Search query is required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  query('rating').optional().isIn(['y', 'g', 'pg', 'pg-13', 'r']).withMessage('Invalid rating'),
  validateRequest
], async (req, res) => {
  try {
    const { q, limit = 20, offset = 0, rating = 'g' } = req.query;

    const result = await giphyService.searchStickers(
      q as string,
      parseInt(limit as string),
      parseInt(offset as string),
      rating as string
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Failed to search stickers', { error, query: req.query });
    res.status(500).json({
      success: false,
      error: 'Failed to search stickers'
    });
  }
});

/**
 * Get trending stickers
 * GET /api/v1/giphy/stickers/trending?limit=20
 */
router.get('/stickers/trending', [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('rating').optional().isIn(['y', 'g', 'pg', 'pg-13', 'r']).withMessage('Invalid rating'),
  validateRequest
], async (req, res) => {
  try {
    const { limit = 20, rating = 'g' } = req.query;

    const result = await giphyService.getTrendingStickers(
      parseInt(limit as string),
      rating as string
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Failed to get trending stickers', { error, query: req.query });
    res.status(500).json({
      success: false,
      error: 'Failed to get trending stickers'
    });
  }
});

/**
 * Get GIF categories
 * GET /api/v1/giphy/categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await giphyService.getCategories();

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    logger.error('Failed to get GIF categories', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get GIF categories'
    });
  }
});

/**
 * Get GIF by ID
 * GET /api/v1/giphy/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const gif = await giphyService.getById(id);

    res.json({
      success: true,
      data: gif
    });
  } catch (error) {
    logger.error('Failed to get GIF by ID', { error, id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to get GIF'
    });
  }
});

export default router;