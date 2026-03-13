/**
 * Redirect Routes
 * 
 * Short link redirect handler
 */

import { Router, Request, Response, NextFunction } from 'express';
import { shortLinkService } from '../services/ShortLinkService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Redirect short link
 * GET /r/:shortCode
 */
router.get('/:shortCode', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { shortCode } = req.params;

    // Get short link
    const link = await shortLinkService.getShortLink(shortCode);

    if (!link) {
      res.status(404).json({
        success: false,
        message: 'Link not found or expired',
      });
      return;
    }

    // Record click (async, don't wait)
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'];
    const referrer = req.headers['referer'] || req.headers['referrer'];

    shortLinkService.recordClick(shortCode, {
      ip,
      userAgent,
      referrer: referrer as string | undefined,
    }).catch((error) => {
      logger.error('Failed to record click', { shortCode, error });
    });

    // Redirect to original URL
    res.redirect(301, link.originalUrl);
  } catch (error) {
    next(error);
  }
});

export default router;
