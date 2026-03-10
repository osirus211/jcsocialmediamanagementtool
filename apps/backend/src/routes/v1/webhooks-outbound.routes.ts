/**
 * Outbound Webhook Routes
 * 
 * Manages webhook endpoints for receiving analytics events
 */

import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validateRequest';
import { WebhookManagementService } from '../../services/WebhookManagementService';
import { WebhookEventType } from '../../services/WebhookService';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation schemas
const createWebhookSchema = z.object({
  body: z.object({
    url: z.string().url().refine(url => url.startsWith('https://'), {
      message: 'URL must use HTTPS',
    }),
    events: z.array(z.nativeEnum(WebhookEventType)).min(1, 'At least one event must be selected'),
    description: z.string().optional(),
  }),
});

const updateWebhookSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid webhook ID'),
  }),
  body: z.object({
    url: z.string().url().refine(url => url.startsWith('https://'), {
      message: 'URL must use HTTPS',
    }).optional(),
    events: z.array(z.nativeEnum(WebhookEventType)).min(1, 'At least one event must be selected').optional(),
    description: z.string().optional(),
    enabled: z.boolean().optional(),
  }),
});

const webhookParamsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid webhook ID'),
  }),
});

/**
 * GET /webhooks/outbound
 * List all outbound webhook endpoints for workspace
 */
router.get('/', async (req, res) => {
  try {
    const workspaceId = req.user.currentWorkspaceId;
    const webhooks = await WebhookManagementService.listEndpoints(workspaceId);

    // Don't expose secrets in list response
    const safeWebhooks = webhooks.map(webhook => ({
      _id: webhook._id,
      workspaceId: webhook.workspaceId,
      url: webhook.url,
      events: webhook.events,
      description: webhook.description,
      enabled: webhook.enabled,
      lastTriggeredAt: webhook.lastTriggeredAt,
      successCount: webhook.successCount,
      failureCount: webhook.failureCount,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    }));

    res.json({
      success: true,
      data: safeWebhooks,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to list webhook endpoints',
      error: error.message,
    });
  }
});

/**
 * POST /webhooks/outbound
 * Create new webhook endpoint
 */
router.post('/', validateRequest(createWebhookSchema), async (req, res) => {
  try {
    const workspaceId = req.user.currentWorkspaceId;
    const { url, events, description } = req.body;

    const webhook = await WebhookManagementService.createEndpoint(
      workspaceId,
      url,
      events,
      description
    );

    res.status(201).json({
      success: true,
      data: {
        _id: webhook._id,
        workspaceId: webhook.workspaceId,
        url: webhook.url,
        secret: webhook.secret, // Include secret only on creation
        events: webhook.events,
        description: webhook.description,
        enabled: webhook.enabled,
        successCount: webhook.successCount,
        failureCount: webhook.failureCount,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: 'Failed to create webhook endpoint',
      error: error.message,
    });
  }
});

/**
 * PATCH /webhooks/outbound/:id
 * Update webhook endpoint
 */
router.patch('/:id', validateRequest(updateWebhookSchema), async (req, res) => {
  try {
    const workspaceId = req.user.currentWorkspaceId;
    const { id } = req.params;
    const updates = req.body;

    const webhook = await WebhookManagementService.updateEndpoint(id, workspaceId, updates);

    res.json({
      success: true,
      data: {
        _id: webhook._id,
        workspaceId: webhook.workspaceId,
        url: webhook.url,
        events: webhook.events,
        description: webhook.description,
        enabled: webhook.enabled,
        lastTriggeredAt: webhook.lastTriggeredAt,
        successCount: webhook.successCount,
        failureCount: webhook.failureCount,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
      },
    });
  } catch (error: any) {
    const statusCode = error.message === 'Webhook not found' ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: 'Failed to update webhook endpoint',
      error: error.message,
    });
  }
});

/**
 * DELETE /webhooks/outbound/:id
 * Delete webhook endpoint
 */
router.delete('/:id', validateRequest(webhookParamsSchema), async (req, res) => {
  try {
    const workspaceId = req.user.currentWorkspaceId;
    const { id } = req.params;

    await WebhookManagementService.deleteEndpoint(id, workspaceId);

    res.json({
      success: true,
      message: 'Webhook endpoint deleted successfully',
    });
  } catch (error: any) {
    const statusCode = error.message === 'Webhook not found' ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: 'Failed to delete webhook endpoint',
      error: error.message,
    });
  }
});

/**
 * POST /webhooks/outbound/:id/rotate-secret
 * Rotate webhook signing secret
 */
router.post('/:id/rotate-secret', validateRequest(webhookParamsSchema), async (req, res) => {
  try {
    const workspaceId = req.user.currentWorkspaceId;
    const { id } = req.params;

    const result = await WebhookManagementService.rotateSecret(id, workspaceId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const statusCode = error.message === 'Webhook not found' ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: 'Failed to rotate webhook secret',
      error: error.message,
    });
  }
});

/**
 * POST /webhooks/outbound/:id/test
 * Send test ping to webhook endpoint
 */
router.post('/:id/test', validateRequest(webhookParamsSchema), async (req, res) => {
  try {
    const workspaceId = req.user.currentWorkspaceId;
    const { id } = req.params;

    const result = await WebhookManagementService.testEndpoint(id, workspaceId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const statusCode = error.message === 'Webhook not found' ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: 'Failed to test webhook endpoint',
      error: error.message,
    });
  }
});

/**
 * GET /webhooks/outbound/:id/deliveries
 * Get delivery history for webhook endpoint
 */
router.get('/:id/deliveries', validateRequest(webhookParamsSchema), async (req, res) => {
  try {
    const workspaceId = req.user.currentWorkspaceId;
    const { id } = req.params;

    const webhooks = await WebhookManagementService.listEndpoints(workspaceId);
    const webhook = webhooks.find(w => w._id.toString() === id);

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found',
      });
    }

    // Return basic delivery stats (in a real implementation, you'd store detailed delivery logs)
    const deliveries = {
      totalDeliveries: webhook.successCount + webhook.failureCount,
      successfulDeliveries: webhook.successCount,
      failedDeliveries: webhook.failureCount,
      lastTriggeredAt: webhook.lastTriggeredAt,
      // In a full implementation, you'd return the last 50 delivery attempts with timestamps, status codes, etc.
      recentDeliveries: [],
    };

    res.json({
      success: true,
      data: deliveries,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get delivery history',
      error: error.message,
    });
  }
});

export default router;