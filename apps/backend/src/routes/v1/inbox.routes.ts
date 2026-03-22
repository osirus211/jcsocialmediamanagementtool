import { Router } from 'express';
import { z } from 'zod';
import { Mention } from '../../models/Mention';
import { PostComment } from '../../models/PostComment';
import { Notification } from '../../models/Notification';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { logger } from '../../utils/logger';
import { AuthTokenService } from '../../services/AuthTokenService';
import { WorkspaceActivityLog, ActivityAction } from '../../models/WorkspaceActivityLog';
import { Request, Response, NextFunction } from 'express';
import { SlidingWindowRateLimiter } from '../../middleware/composerRateLimits';

const router = Router();

// Rate limiter for inbox (120 per minute per workspace)
const inboxLimit = new SlidingWindowRateLimiter({
  maxRequests: 120,
  windowMs: 60 * 1000,
  keyPrefix: 'rateLimit:inbox',
});

const inboxRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const key = req.workspace?.workspaceId?.toString() || req.ip || 'unknown';
    const { allowed } = await inboxLimit.checkLimit(key);
    if (!allowed) {
      res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many inbox requests.',
      });
      return;
    }
    next();
  } catch {
    next();
  }
};

router.use(inboxRateLimit);

// Validation schemas
const getInboxSchema = z.object({
  query: z.object({
    type: z.enum(['mention', 'comment', 'notification', 'all']).optional().default('all'),
    platform: z.string().optional(),
    sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
    unreadOnly: z.string().optional().transform(val => val === 'true'),
    limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
    offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
  }),
});

interface InboxItem {
  _id: string;
  type: 'mention' | 'comment' | 'notification';
  workspaceId: string;
  platform?: string;
  content: string;
  author?: {
    username: string;
    displayName?: string;
    profileUrl?: string;
  };
  sentiment?: 'positive' | 'negative' | 'neutral';
  keyword?: string;
  sourceUrl?: string;
  readAt?: Date;
  createdAt: Date;
}

/**
 * GET /inbox
 * Get unified inbox feed (mentions + comments + notifications)
 */
router.get('/', requireAuth, requireWorkspace, validateRequest(getInboxSchema), async (req, res): Promise<void> => {
  try {
    const workspaceId = req.workspace!.workspaceId;
    const userId = req.user!.userId;
    const { type, platform, sentiment, unreadOnly, limit, offset } = req.query as any;

    const items: InboxItem[] = [];

    // Fetch mentions
    if (type === 'all' || type === 'mention') {
      const mentionQuery: any = { workspaceId };
      
      if (platform) {
        mentionQuery.platform = platform;
      }
      
      if (sentiment) {
        mentionQuery.sentiment = sentiment;
      }
      
      if (unreadOnly) {
        mentionQuery.readAt = { $exists: false };
      }

      const mentions = await Mention.find(mentionQuery)
        .sort({ collectedAt: -1 })
        .limit(limit + offset)
        .lean();

      mentions.forEach((mention) => {
        items.push({
          _id: mention._id.toString(),
          type: 'mention',
          workspaceId: mention.workspaceId.toString(),
          platform: mention.platform,
          content: mention.text,
          author: {
            username: mention.author.username,
            displayName: mention.author.displayName,
            profileUrl: mention.author.profileUrl,
          },
          sentiment: mention.sentiment,
          keyword: mention.keyword,
          sourceUrl: mention.sourceUrl,
          readAt: mention.readAt,
          createdAt: mention.collectedAt,
        });
      });
    }

    // Fetch post comments where user is mentioned
    if (type === 'all' || type === 'comment') {
      const commentQuery: any = {
        workspaceId,
        mentions: userId,
        isDeleted: false,
      };
      
      if (unreadOnly) {
        commentQuery.readAt = { $exists: false };
      }

      const comments = await PostComment.find(commentQuery)
        .sort({ createdAt: -1 })
        .limit(limit + offset)
        .lean();

      comments.forEach((comment) => {
        items.push({
          _id: comment._id.toString(),
          type: 'comment',
          workspaceId: comment.workspaceId.toString(),
          content: comment.content,
          author: {
            username: comment.authorName,
            displayName: comment.authorName,
            profileUrl: comment.authorAvatar,
          },
          readAt: comment.readAt,
          createdAt: comment.createdAt,
        });
      });
    }

    // Fetch notifications
    if (type === 'all' || type === 'notification') {
      const notificationQuery: any = {
        workspaceId,
        userId,
      };
      
      if (unreadOnly) {
        notificationQuery.read = false;
      }

      const notifications = await Notification.find(notificationQuery)
        .sort({ createdAt: -1 })
        .limit(limit + offset)
        .lean();

      notifications.forEach((notification) => {
        items.push({
          _id: notification._id.toString(),
          type: 'notification',
          workspaceId: notification.workspaceId.toString(),
          content: notification.message,
          readAt: notification.readAt,
          createdAt: notification.createdAt,
        });
      });
    }

    // Sort all items by createdAt descending
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const paginatedItems = items.slice(offset, offset + limit);

    // Count unread items
    const unreadCount = items.filter(item => !item.readAt).length;

    // Audit log
    WorkspaceActivityLog.create({
      workspaceId,
      userId,
      action: ActivityAction.INBOX_ACCESSED,
      metadata: { itemCount: paginatedItems.length, filters: { type, platform, sentiment } },
    }).catch(() => {});

    res.json({
      success: true,
      data: {
        items: paginatedItems,
        unreadCount,
        total: items.length,
      },
    });
  } catch (error: any) {
    logger.error('Error getting inbox', {
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to get inbox',
    });
  }
});

/**
 * POST /inbox/mark-all-read
 * Mark all unread items as read
 */
router.post('/mark-all-read', requireAuth, requireWorkspace, async (req, res): Promise<void> => {
  try {
    const workspaceId = req.workspace!.workspaceId;
    const userId = req.user!.userId;
    const now = new Date();

    const [mentionResult, notificationResult] = await Promise.all([
      Mention.updateMany(
        { workspaceId, readAt: { $exists: false } },
        { $set: { readAt: now } }
      ),
      Notification.updateMany(
        { workspaceId, userId, read: false },
        { $set: { read: true, readAt: now } }
      ),
    ]);

    const markedCount = mentionResult.modifiedCount + notificationResult.modifiedCount;

    res.json({
      success: true,
      data: {
        markedCount,
      },
    });
  } catch (error: any) {
    logger.error('Error marking all as read', {
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to mark all as read',
    });
  }
});

/**
 * GET /inbox/stream-token
 * Generate short-lived token for WebSocket/SSE authentication
 */
router.get('/stream-token', requireAuth, requireWorkspace, async (req, res): Promise<void> => {
  try {
    const workspaceId = req.workspace!.workspaceId;
    const userId = req.user!.userId;

    // Generate JWT with 1 hour TTL
    const token = AuthTokenService.generateTempToken(
      {
        userId,
        email: req.user!.email,
        role: req.user!.role,
        purpose: 'inbox-stream',
        workspaceId: workspaceId.toString(),
      } as any,
      '1h'
    );

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    res.json({
      success: true,
      data: {
        token,
        expiresAt,
      },
    });
  } catch (error: any) {
    logger.error('Error generating stream token', {
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });

    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to generate stream token',
    });
  }
});

export default router;

/**
 * Stream token verification middleware
 */
async function verifyStreamToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = (req.headers['x-stream-token'] as string) || (req.query.token as string);
  
  if (!token) {
    res.status(401).json({ 
      code: 'MISSING_STREAM_TOKEN', 
      message: 'Stream token required' 
    });
    return;
  }

  try {
    const payload = AuthTokenService.verifyAccessToken(token) as any;
    
    if (!payload || payload.workspaceId !== req.workspace?.workspaceId?.toString()) {
      res.status(401).json({ 
        code: 'INVALID_STREAM_TOKEN', 
        message: 'Invalid or expired stream token' 
      });
      return;
    }

    next();
  } catch {
    res.status(401).json({ 
      code: 'INVALID_STREAM_TOKEN', 
      message: 'Invalid or expired stream token' 
    });
  }
}

/**
 * GET /inbox/stream
 * Server-Sent Events endpoint for real-time inbox updates
 */
router.get('/stream', requireAuth, requireWorkspace, verifyStreamToken, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});
