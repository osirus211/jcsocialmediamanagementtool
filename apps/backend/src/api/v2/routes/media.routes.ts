/**
 * Public API v2 - Media Routes
 * 
 * External API for media management with API key authentication
 */

import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { requireScope } from '../../../middleware/apiKeyScope';
import { MediaUploadService } from '../../../services/MediaUploadService';
import { Media } from '../../../models/Media';
import { logger } from '../../../utils/logger';

const router = Router();
const mediaUploadService = new MediaUploadService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and videos
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/mov',
      'video/avi',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and videos are allowed.'));
    }
  },
});

// Validation schemas
const ListMediaSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  mimeType: z.string().optional(),
  folderId: z.string().optional(),
});

/**
 * GET /v2/media - List media files
 */
router.get('/', requireScope('media:read'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const query = ListMediaSchema.parse(req.query);
    
    // Build filter
    const filter: any = { workspaceId };
    if (query.mimeType) filter.mimeType = new RegExp(query.mimeType, 'i');
    if (query.folderId) filter.folderId = query.folderId;
    
    // Cursor-based pagination
    if (query.cursor) {
      filter._id = { $lt: query.cursor };
    }
    
    const mediaFiles = await Media.find(filter)
      .sort({ _id: -1 })
      .limit(query.limit + 1)
      .lean();
    
    const hasMore = mediaFiles.length > query.limit;
    const data = hasMore ? mediaFiles.slice(0, -1) : mediaFiles;
    const nextCursor = hasMore ? data[data.length - 1]._id.toString() : null;
    
    res.json({
      data,
      meta: {
        cursor: nextCursor,
        hasMore,
        total: await Media.countDocuments(filter),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v2/media/upload - Upload media file
 */
router.post('/upload', requireScope('media:write'), upload.single('file'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    
    if (!req.file) {
      res.status(400).json({
        error: 'No file provided',
        code: 'FILE_REQUIRED',
      });
      return;
    }
    
    const uploadResult = await (mediaUploadService as any).uploadFile({
      workspaceId,
      file: {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      uploadedBy: req.apiKey!.keyId, // Use API key ID as uploader
      folderId: req.body.folderId,
    });
    
    logger.info('Media uploaded via API v2', {
      mediaId: uploadResult._id,
      workspaceId,
      apiKeyId: req.apiKey!.keyId,
      filename: req.file.originalname,
      size: req.file.size,
    });
    
    res.status(201).json({ data: uploadResult });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /v2/media/:id - Delete media file
 */
router.delete('/:id', requireScope('media:write'), async (req, res, next) => {
  try {
    const workspaceId = req.apiKey!.workspaceId;
    const mediaId = req.params.id;
    
    const media = await Media.findOne({ _id: mediaId, workspaceId });
    
    if (!media) {
      res.status(404).json({
        error: 'Media file not found',
        code: 'MEDIA_NOT_FOUND',
      });
      return;
    }
    
    await (mediaUploadService as any).deleteFile(mediaId, workspaceId);
    
    logger.info('Media deleted via API v2', {
      mediaId,
      workspaceId,
      apiKeyId: req.apiKey!.keyId,
    });
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;