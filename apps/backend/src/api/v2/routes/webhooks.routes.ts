/**
 * Public API v2 - Webhooks Routes
 * 
 * External API for webhook management with API key authentication
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireScope } from '../../../middleware/apiKeyScope';
import { Webhook } from '../../../models/Webhook';
import { logger } from '../../../utils/logger';

const router = Router();

// Validation schemas
const CreateWebhookSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  secret: z.string().min(8, 'Secret must be at least 8 characters').optional(),
  enabled: z.boolean().default(true),
});

const UpdateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  secret: z.string().min(8).optional(),
  enabled: z.boolean().optional(),
});

const ListWebhooksSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  enabled: z.coerce.boolean().optional(),
});

/**
 * GET /v2/webhooks - List webhook endpoints
 */
router.get('/', requireScope('webhooks:read'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const query = ListWebhooksSchema.parse(req.query);
    
    // Build filter
    const filter: any = { workspaceId };
    if (query.enabled !== undefined) filter.enabled = query.enabled;
    
    // Cursor-based pagination
    if (query.cursor) {
      filter._id = { $lt: query.cursor };
    }
    
    const webhooks = await Webhook.find(filter)
      .sort({ _id: -1 })
      .limit(query.limit + 1)
      .select('-secret') // Don't expose secrets
      .lean();
    
    const hasMore = webhooks.length > query.limit;
    const data = hasMore ? webhooks.slice(0, -1) : webhooks;
    const nextCursor = hasMore ? data[data.length - 1]._id.toString() : null;
    
    res.json({
      data,
      meta: {
        cursor: nextCursor,
        hasMore,
        total: await Webhook.countDocuments(filter),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v2/webhooks - Register webhook endpoint
 */
router.post('/', requireScope('webhooks:write'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const data = CreateWebhookSchema.parse(req.body);
    
    // Generate secret if not provided
    const secret = data.secret || require('crypto').randomBytes(32).toString('hex');
    
    const webhook = await Webhook.create({
      workspaceId,
      url: data.url,
      events: data.events,
      secret,
      enabled: data.enabled,
      createdBy: req.apiKey!.keyId, // Use API key ID as creator
    });
    
    logger.info('Webhook created via API v2', {
      webhookId: webhook._id,
      workspaceId,
      apiKeyId: req.apiKey!.keyId,
      url: data.url,
      events: data.events,
    });
    
    // Return webhook without secret for security
    const responseData = webhook.toObject();
    delete responseData.secret;
    
    res.status(201).json({ 
      data: responseData,
      secret: secret, // Return secret only on creation
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /v2/webhooks/:id - Update webhook
 */
router.patch('/:id', requireScope('webhooks:write'), async (req, res, next): Promise<void> => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const webhookId = req.params.id;
    const data = UpdateWebhookSchema.parse(req.body);
    
    const webhook = await Webhook.findOneAndUpdate(
      { _id: webhookId, workspaceId },
      data,
      { new: true, runValidators: true }
    ).select('-secret');
    
    if (!webhook) {
      res.status(404).json({
        error: 'Webhook not found',
        code: 'WEBHOOK_NOT_FOUND',
      });
      return;
    }
    
    logger.info('Webhook updated via API v2', {
      webhookId,
      workspaceId,
      apiKeyId: req.apiKey!.keyId,
    });
    
    res.json({ data: webhook });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * DELETE /v2/webhooks/:id - Delete webhook
 */
router.delete('/:id', requireScope('webhooks:write'), async (req, res, next): Promise<void> => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const webhookId = req.params.id;
    
    const webhook = await Webhook.findOneAndDelete({ _id: webhookId, workspaceId });
    
    if (!webhook) {
      res.status(404).json({
        error: 'Webhook not found',
        code: 'WEBHOOK_NOT_FOUND',
      });
      return;
    }
    
    logger.info('Webhook deleted via API v2', {
      webhookId,
      workspaceId,
      apiKeyId: req.apiKey!.keyId,
    });
    
    res.status(204).send();
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * GET /v2/webhooks/:id/deliveries - Get delivery history
 */
router.get('/:id/deliveries', requireScope('webhooks:read'), async (req, res, next): Promise<void> => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const webhookId = req.params.id;
    
    const webhook = await Webhook.findOne({ _id: webhookId, workspaceId });
    
    if (!webhook) {
      res.status(404).json({
        error: 'Webhook not found',
        code: 'WEBHOOK_NOT_FOUND',
      });
      return;
    }
    
    // Return delivery statistics
    const deliveryStats = {
      totalDeliveries: (webhook.successCount || 0) + (webhook.failureCount || 0),
      successfulDeliveries: webhook.successCount || 0,
      failedDeliveries: webhook.failureCount || 0,
      lastTriggeredAt: webhook.lastTriggeredAt,
      successRate: webhook.successCount && webhook.failureCount 
        ? (webhook.successCount / (webhook.successCount + webhook.failureCount) * 100).toFixed(2) + '%'
        : webhook.successCount ? '100%' : '0%',
    };
    
    res.json({ data: deliveryStats });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

export default router;