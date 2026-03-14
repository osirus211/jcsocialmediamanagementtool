/**
 * Redirect Routes
 * 
 * Short link redirect handler with password protection and status checks
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
    const { password } = req.query;

    // Get short link
    const link = await shortLinkService.getShortLink(shortCode);

    if (!link) {
      res.status(404).json({
        success: false,
        message: 'Link not found or expired',
      });
      return;
    }

    // Check if link is active
    if (!link.isActive) {
      res.status(410).json({
        success: false,
        message: 'This link has been disabled',
      });
      return;
    }

    // Check password protection
    if (link.password) {
      if (!password || password !== link.password) {
        res.status(401).json({
          success: false,
          message: 'Password required',
          requiresPassword: true,
        });
        return;
      }
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

/**
 * Password gate page
 * GET /r/:shortCode/gate
 */
router.get('/:shortCode/gate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { shortCode } = req.params;

    const link = await shortLinkService.getShortLink(shortCode);

    if (!link || !link.password) {
      res.redirect(`/r/${shortCode}`);
      return;
    }

    // Return simple HTML password gate
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Password Protected Link</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 400px; margin: 100px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #333; margin-bottom: 20px; }
          input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 20px; font-size: 16px; }
          button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
          button:hover { background: #0056b3; }
          .error { color: #dc3545; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔒 Password Protected</h1>
          <p>This link is password protected. Please enter the password to continue.</p>
          <form onsubmit="handleSubmit(event)">
            <input type="password" id="password" placeholder="Enter password" required>
            <button type="submit">Access Link</button>
          </form>
          <div id="error" class="error"></div>
        </div>
        <script>
          function handleSubmit(e) {
            e.preventDefault();
            const password = document.getElementById('password').value;
            window.location.href = '/r/${shortCode}?password=' + encodeURIComponent(password);
          }
        </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    next(error);
  }
});

export default router;
