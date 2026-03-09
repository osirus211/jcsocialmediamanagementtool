/**
 * Public API - Media Routes
 * 
 * External endpoints for managing media via API keys
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireScope } from '../../../middleware/apiKeyScope';
import { Media } from '../../../models/Media';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import mongoose from 'mongoose';

const router = Router();

/**
 * GET /api/public/v1/media
 * List media files for the workspace
 * 
 * Query params:
 * - type: filter by type (image, video)
 * - limit: number of items to return (default: 20, max: 100)
 * - page: page number (default: 1)
 * 
 * Requires: media:read scope
 */
router.get('/',
  requireScope('media:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.apiKey!.workspaceId;
      
      // Parse query params
      const type = req.query.type as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const page = parseInt(req.query.page as string) || 1;
      const skip = (page - 1) * limit;
      
      // Build query
      const query: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };
      
      if (type) {
        query.mediaType = type;
      }
      
      // Fetch media
      const [media, total] = await Promise.all([
        Media.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .select('-__v'),
        Media.countDocuments(query),
      ]);
      
      res.json({
        media: media.map(item => ({
          id: item._id,
          filename: item.filename,
          mediaType: item.mediaType,
          storageUrl: item.storageUrl,
          cdnUrl: item.cdnUrl,
          thumbnailUrl: item.thumbnailUrl,
          size: item.size,
          mimeType: item.mimeType,
          status: item.status,
          createdAt: item.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/public/v1/media/:id
 * Get a single media file
 * 
 * Requires: media:read scope
 */
router.get('/:id',
  requireScope('media:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const workspaceId = req.apiKey!.workspaceId;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError('Invalid media ID');
      }
      
      const media = await Media.findOne({
        _id: new mongoose.Types.ObjectId(id),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      }).select('-__v');
      
      if (!media) {
        throw new NotFoundError('Media not found');
      }
      
      res.json({
        media: {
          id: media._id,
          filename: media.filename,
          mediaType: media.mediaType,
          storageUrl: media.storageUrl,
          cdnUrl: media.cdnUrl,
          thumbnailUrl: media.thumbnailUrl,
          size: media.size,
          mimeType: media.mimeType,
          width: media.width,
          height: media.height,
          duration: media.duration,
          status: media.status,
          createdAt: media.createdAt,
          updatedAt: media.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/public/v1/media
 * Upload a media file
 * 
 * Note: This is a placeholder. Actual implementation would require
 * multipart/form-data handling and file upload service integration.
 * 
 * Requires: media:write scope
 */
router.post('/',
  requireScope('media:write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Implement file upload handling
      // This would typically use multer or similar middleware
      // and integrate with S3/GCS storage service
      
      res.status(501).json({
        error: 'Not Implemented',
        message: 'Media upload endpoint requires multipart/form-data handling. Please use the internal API or implement file upload middleware.',
        code: 'NOT_IMPLEMENTED',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/public/v1/media/:id
 * Delete a media file
 * 
 * Requires: media:write scope
 */
router.delete('/:id',
  requireScope('media:write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const workspaceId = req.apiKey!.workspaceId;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError('Invalid media ID');
      }
      
      const result = await Media.deleteOne({
        _id: new mongoose.Types.ObjectId(id),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });
      
      if (result.deletedCount === 0) {
        throw new NotFoundError('Media not found');
      }
      
      res.json({
        message: 'Media deleted successfully',
        mediaId: id,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
