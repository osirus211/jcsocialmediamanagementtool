/**
 * Platform Routes
 * 
 * API routes for platform capabilities, status, and rate limits
 */

import { Router } from 'express';
import { PlatformController } from '../../controllers/PlatformController';
import { requireAuth } from '../../middleware/auth';

const router = Router();
const platformController = new PlatformController();

/**
 * @openapi
 * /api/v1/platforms/capabilities:
 *   get:
 *     summary: Get platform capabilities
 *     description: Retrieve capabilities and limits for social media platforms
 *     tags:
 *       - Platforms
 *     parameters:
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [twitter, facebook, instagram, linkedin, youtube, threads, tiktok]
 *         description: Optional platform filter
 *     responses:
 *       200:
 *         description: Platform capabilities retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         platforms:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               platform:
 *                                 type: string
 *                               displayName:
 *                                 type: string
 *                               maxContentLength:
 *                                 type: integer
 *                               maxMediaItems:
 *                                 type: integer
 *                               supportedMediaTypes:
 *                                 type: object
 *                               imageFormats:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               videoFormats:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               features:
 *                                 type: object
 *       400:
 *         description: Invalid platform
 */
router.get('/capabilities', (req, res, next) => {
  (platformController as any).getCapabilities(req, res, next);
});

/**
 * @openapi
 * /api/v1/platforms/permissions:
 *   get:
 *     summary: Get OAuth permissions
 *     description: Retrieve OAuth permission requirements and explanations for social media platforms
 *     tags:
 *       - Platforms
 *     parameters:
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [twitter, facebook, instagram, linkedin, youtube, threads, tiktok]
 *         description: Optional platform filter
 *     responses:
 *       200:
 *         description: Platform permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         platforms:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               platform:
 *                                 type: string
 *                               permissions:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               explanation:
 *                                 type: string
 *                               documentationLink:
 *                                 type: string
 *                               requiredScopes:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                               optionalScopes:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *       400:
 *         description: Invalid platform
 */
router.get('/permissions', (req, res, next) => {
  (platformController as any).getPermissions(req, res, next);
});

export default router;

/**
 * @openapi
 * /api/v1/platforms/status:
 *   get:
 *     summary: Get platform health status
 *     description: Retrieve health status, failure rate, and publishing pause status for all platforms
 *     tags:
 *       - Platforms
 *     responses:
 *       200:
 *         description: Platform status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       status:
 *                         type: string
 *                         enum: [operational, degraded]
 *                       failureRate:
 *                         type: number
 *                       lastChecked:
 *                         type: string
 *                         format: date-time
 *                       publishingPaused:
 *                         type: boolean
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Failed to fetch platform status
 */
router.get('/status', (req, res) => {
  (platformController as any).getPlatformStatus(req, res);
});

/**
 * @openapi
 * /api/v1/platforms/rate-limits:
 *   get:
 *     summary: Get rate limit status for connected accounts
 *     description: Retrieve rate limit information for all accounts connected to the current workspace
 *     tags:
 *       - Platforms
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rate limits retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       accountId:
 *                         type: string
 *                       platform:
 *                         type: string
 *                       accountName:
 *                         type: string
 *                       rateLimited:
 *                         type: boolean
 *                       resetAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       quotaUsed:
 *                         type: number
 *                         nullable: true
 *                       quotaLimit:
 *                         type: number
 *                         nullable: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Failed to fetch rate limits
 */
router.get('/rate-limits', requireAuth, (req, res) => {
  (platformController as any).getRateLimits(req, res);
});

