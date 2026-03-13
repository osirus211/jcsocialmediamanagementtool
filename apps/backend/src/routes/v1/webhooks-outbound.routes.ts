/**
 * Outbound Webhook Routes
 * 
 * Manages webhook endpoints for receiving analytics events
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { WebhookManagementService } from '../../services/WebhookManagementService';
import { WebhookEventType } from '../../services/WebhookService';

const router = Router();

// Apply auth and workspace middleware to all routes
router.use(requireAuth);
router.use(requireWorkspace);

// Validation schemas
const createWebhookSchema = z.object({
  body: z.object({
    url: z.string().url().refine(url => url.startsWith('https://'), {
      message: 'URL must use HTTPS',
    }),
    events: z.array(z.nativeEnum(WebhookEventType)).min(1, 'At least one event must be selected'),
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
router.get('/', async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const webhooks = await WebhookManagementService.listEndpoints(workspaceId.toString());

    // Don't expose secrets in list response
    const safeWebhooks = webhooks.map(webhook => ({
      _id: webhook._id,
      workspaceId: webhook.workspaceId,
      url: webhook.url,
      events: webhook.events,
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
router.post('/', validateRequest(createWebhookSchema), async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { url, events } = req.body;

    const webhook = await WebhookManagementService.createEndpoint(
      workspaceId.toString(),
      url,
      events
    );

    res.status(201).json({
      success: true,
      data: {
        _id: webhook._id,
        workspaceId: webhook.workspaceId,
        url: webhook.url,
        secret: webhook.secret, // Include secret only on creation
        events: webhook.events,
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
router.patch('/:id', validateRequest(updateWebhookSchema), async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { id } = req.params;
    const updates = req.body;

    const webhook = await WebhookManagementService.updateEndpoint(id, workspaceId.toString(), updates);

    res.json({
      success: true,
      data: {
        _id: webhook._id,
        workspaceId: webhook.workspaceId,
        url: webhook.url,
        events: webhook.events,
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
router.delete('/:id', validateRequest(webhookParamsSchema), async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { id } = req.params;

    await WebhookManagementService.deleteEndpoint(id, workspaceId.toString());

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
router.post('/:id/rotate-secret', validateRequest(webhookParamsSchema), async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { id } = req.params;

    const result = await WebhookManagementService.rotateSecret(id, workspaceId.toString());

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
router.post('/:id/test', validateRequest(webhookParamsSchema), async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { id } = req.params;

    const result = await WebhookManagementService.testEndpoint(id, workspaceId.toString());

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
router.get('/:id/deliveries', validateRequest(webhookParamsSchema), async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { id } = req.params;
    const { limit = 50, skip = 0, event, status } = req.query;

    // Import WebhookRetryService dynamically
    const { WebhookRetryService } = await import('../../services/WebhookRetryService');

    const result = await WebhookRetryService.getDeliveryHistory(id, workspaceId.toString(), {
      limit: parseInt(limit as string),
      skip: parseInt(skip as string),
      event: event as string,
      status: status as string,
    });

    res.json({
      success: true,
      data: {
        deliveries: result.deliveries,
        pagination: {
          total: result.total,
          limit: parseInt(limit as string),
          skip: parseInt(skip as string),
          hasMore: result.total > parseInt(skip as string) + parseInt(limit as string),
        },
        stats: result.stats,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get delivery history',
      error: error.message,
    });
  }
});

/**
 * POST /webhooks/outbound/:id/retry
 * Retry failed webhook deliveries
 */
router.post('/:id/retry', validateRequest(webhookParamsSchema), async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { id } = req.params;

    // Verify webhook exists and belongs to workspace
    const webhook = await WebhookManagementService.listEndpoints(workspaceId.toString());
    const targetWebhook = webhook.find(w => w._id.toString() === id);

    if (!targetWebhook) {
      res.status(404).json({
        success: false,
        message: 'Webhook not found',
      });
      return;
    }

    // Import services dynamically
    const { WebhookDelivery } = await import('../../models/WebhookDelivery');
    const { WebhookDeliveryQueue } = await import('../../queue/WebhookDeliveryQueue');

    // Find failed deliveries for this webhook
    const failedDeliveries = await WebhookDelivery.find({
      webhookId: id,
      workspaceId,
      status: { $in: ['failed', 'dead_letter'] },
    }).limit(10); // Limit to prevent abuse

    const queue = WebhookDeliveryQueue.getInstance();
    let retriedCount = 0;

    for (const delivery of failedDeliveries) {
      // Reset delivery for retry
      await queue.addDelivery({
        webhookId: id,
        workspaceId: workspaceId.toString(),
        event: delivery.event,
        payload: delivery.payload,
        url: delivery.url,
        secret: targetWebhook.secret,
        attempt: 1, // Reset to first attempt
        maxAttempts: 5,
      });
      retriedCount++;
    }

    res.json({
      success: true,
      data: {
        retriedCount,
        message: `${retriedCount} failed deliveries queued for retry`,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retry webhook deliveries',
      error: error.message,
    });
  }
});

export default router;