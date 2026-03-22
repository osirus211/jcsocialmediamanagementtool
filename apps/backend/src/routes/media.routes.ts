import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { requireWorkspace, requireAdmin } from '../middleware/tenant';
import { validateFileMagicBytes } from '../middleware/validateFileMagicBytes';
import { mediaUploadLimit } from '../middleware/composerRateLimits';
import { MediaService } from '../services/MediaService';
import { MediaFolderService } from '../services/MediaFolderService';
import { StockPhotoService } from '../services/StockPhotoService';
import { CanvaService } from '../services/CanvaService';
import { FigmaService } from '../services/FigmaService';
import { MediaType } from '../models/Media';
import { StorageProvider } from '../services/MediaStorageService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const mediaService = MediaService.getInstance();

// Media upload and management
router.post(
  '/upload',
  requireAuth,
  requireWorkspace,
  mediaUploadLimit,
  upload.single('file'),
  validateFileMagicBytes,
  async (req, res, next) => {
    try {
      const media = await mediaService.createMedia({
        workspaceId: req.workspace!.workspaceId.toString(),
        userId: req.user!.userId,
        filename: req.file!.originalname,
        originalFilename: req.file!.originalname,
        mimeType: req.file!.mimetype,
        mediaType: req.file!.mimetype.startsWith('image/') ? MediaType.IMAGE : MediaType.VIDEO,
        size: req.file!.size,
        storageKey: `uploads/${Date.now()}-${req.file!.originalname}`,
        storageProvider: StorageProvider.S3
      });
      res.status(201).json(media);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const media = await mediaService.listMedia({
      workspaceId: req.workspace!.workspaceId.toString()
    });
    res.json(media);
  } catch (error) {
    next(error);
  }
});

router.get('/:fileId', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const media = await mediaService.getMediaById(
      req.params.fileId,
      req.workspace!.workspaceId.toString()
    );
    res.json(media);
  } catch (error) {
    next(error);
  }
});

router.patch('/:fileId', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const media = await mediaService.updateMediaStatus({
      mediaId: req.params.fileId,
      status: req.body.status
    });
    res.json(media);
  } catch (error) {
    next(error);
  }
});

router.delete('/:fileId', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    await mediaService.deleteMedia(req.params.fileId, req.workspace!.workspaceId.toString());
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/bulk-delete', requireAuth, requireWorkspace, requireAdmin, async (req, res, next) => {
  try {
    const results = [];
    for (const fileId of req.body.fileIds) {
      await mediaService.deleteMedia(fileId, req.workspace!.workspaceId.toString());
      results.push({ fileId, deleted: true });
    }
    res.json({ results });
  } catch (error) {
    next(error);
  }
});

// Media folders
router.get('/folders', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const folders = await MediaFolderService.getFolders(req.workspace!.workspaceId.toString());
    res.json(folders);
  } catch (error) {
    next(error);
  }
});

router.post('/folders', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const folder = await MediaFolderService.createFolder(
      req.workspace!.workspaceId.toString(),
      req.user!.userId,
      req.body
    );
    res.status(201).json(folder);
  } catch (error) {
    next(error);
  }
});

router.patch('/folders/:id', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const folder = await MediaFolderService.updateFolder(
      req.workspace!.workspaceId.toString(),
      req.params.id,
      req.body
    );
    res.json(folder);
  } catch (error) {
    next(error);
  }
});

router.delete('/folders/:id', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    await MediaFolderService.deleteFolder(req.workspace!.workspaceId.toString(), req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Stock photos
router.post('/stock/search', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const results = await StockPhotoService.searchUnsplash(
      req.body.query,
      req.body.page,
      req.body.perPage
    );
    res.json(results);
  } catch (error) {
    next(error);
  }
});

router.post('/stock/import', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const photo = await StockPhotoService.getUnsplashPhoto(req.body.photoId);
    res.status(201).json(photo);
  } catch (error) {
    next(error);
  }
});

// Canva integration
router.get('/canva/auth', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const authUrl = CanvaService.getAuthUrl(req.workspace!.workspaceId.toString());
    res.json({ authUrl });
  } catch (error) {
    next(error);
  }
});

router.get('/canva/callback', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const result = await CanvaService.handleCallback(
      req.query.code as string,
      req.query.state as string
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/canva/designs', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const designs = await CanvaService.getUserDesigns(req.workspace!.workspaceId.toString());
    res.json(designs);
  } catch (error) {
    next(error);
  }
});

router.post('/canva/import', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const design = await CanvaService.exportDesign(
      req.workspace!.workspaceId.toString(),
      req.body.designId,
      req.body.format
    );
    res.status(201).json(design);
  } catch (error) {
    next(error);
  }
});

// Figma integration
router.get('/figma/auth', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const authUrl = FigmaService.getAuthUrl(req.workspace!.workspaceId.toString());
    res.json({ authUrl });
  } catch (error) {
    next(error);
  }
});

router.get('/figma/callback', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const result = await FigmaService.handleCallback(
      req.query.code as string,
      req.query.state as string
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/figma/files', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const files = await FigmaService.getUserFiles(req.workspace!.workspaceId.toString());
    res.json(files);
  } catch (error) {
    next(error);
  }
});

router.post('/figma/import', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const frame = await FigmaService.exportFrame(
      req.workspace!.workspaceId.toString(),
      req.body.fileKey,
      req.body.nodeId,
      req.body.options
    );
    res.status(201).json(frame);
  } catch (error) {
    next(error);
  }
});

export default router;
