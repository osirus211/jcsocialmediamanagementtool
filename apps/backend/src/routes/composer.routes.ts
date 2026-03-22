import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireWorkspace } from '../middleware/tenant';
import {
  aiCaptionLimit,
  aiImageLimit,
  linkPreviewLimit,
  urlShortenerLimit
} from '../middleware/composerRateLimits';
import { ComposerService } from '../services/ComposerService';
import { LinkPreviewService } from '../services/LinkPreviewService';
import { ShortLinkService } from '../services/ShortLinkService';
import { HashtagGroupsService } from '../services/HashtagGroupsService';
import { PostTemplateService } from '../services/PostTemplateService';
import { PublishMode } from '../models/Post';
import { SavedCaption } from '../models/SavedCaption';
import mongoose from 'mongoose';

const router = Router();
const composerService = new ComposerService();
const linkPreviewService = LinkPreviewService.getInstance();
const shortLinkService = ShortLinkService.getInstance();
const templateService = PostTemplateService.getInstance();

// Draft management
router.post('/drafts', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const draft = await composerService.createDraft(req.body);
    res.status(201).json(draft);
  } catch (error) {
    next(error);
  }
});

router.get('/drafts/:postId', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const draft = await composerService.updateDraft(
      req.params.postId,
      req.workspace!.workspaceId.toString(),
      {}
    );
    res.json(draft);
  } catch (error) {
    next(error);
  }
});

router.patch('/drafts/:postId', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const draft = await composerService.updateDraft(
      req.params.postId,
      req.workspace!.workspaceId.toString(),
      req.body
    );
    res.json(draft);
  } catch (error) {
    next(error);
  }
});

router.delete('/drafts/:postId', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    await composerService.deletePost(req.params.postId, req.workspace!.workspaceId.toString());
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/drafts/:postId/schedule', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const result = await composerService.publishPost(
      req.params.postId,
      req.workspace!.workspaceId.toString(),
      {
        publishMode: PublishMode.SCHEDULE,
        scheduledAt: req.body.scheduledFor
      }
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/drafts/:postId/validate', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const validation = await composerService.updateDraft(
      req.params.postId,
      req.workspace!.workspaceId.toString(),
      {}
    );
    res.json({ valid: true, draft: validation });
  } catch (error) {
    next(error);
  }
});

// AI features
router.post('/ai/caption', requireAuth, requireWorkspace, aiCaptionLimit, async (req, res, next) => {
  try {
    const caption = `Generated caption for ${req.body.platform}: ${req.body.prompt}`;
    res.json({ caption });
  } catch (error) {
    next(error);
  }
});

router.post('/ai/improve', requireAuth, requireWorkspace, aiCaptionLimit, async (req, res, next) => {
  try {
    const improved = `Improved: ${req.body.caption}`;
    res.json({ caption: improved });
  } catch (error) {
    next(error);
  }
});

router.post('/ai/image', requireAuth, requireWorkspace, aiImageLimit, async (req, res, next) => {
  try {
    const image = { url: 'https://example.com/generated-image.jpg', prompt: req.body.prompt };
    res.json(image);
  } catch (error) {
    next(error);
  }
});

// Link preview
router.post('/link-preview', requireAuth, requireWorkspace, linkPreviewLimit, async (req, res, next) => {
  try {
    const preview = await linkPreviewService.fetchPreview(req.body.url);
    res.json(preview);
  } catch (error) {
    next(error);
  }
});

// URL shortener
router.post('/shorten', requireAuth, requireWorkspace, urlShortenerLimit, async (req, res, next) => {
  try {
    const { shortLink, shortUrl } = await shortLinkService.createShortLink(
      req.body.url,
      req.workspace!.workspaceId.toString(),
      req.user!.userId,
      req.body.options
    );
    res.json({ shortLink, shortUrl });
  } catch (error) {
    next(error);
  }
});

// Hashtags
router.get('/hashtags/suggest', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const suggestions = ['#marketing', '#socialmedia', '#content'];
    res.json(suggestions);
  } catch (error) {
    next(error);
  }
});

router.get('/hashtags/trending', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const trending = ['#trending', '#viral', '#popular'];
    res.json(trending);
  } catch (error) {
    next(error);
  }
});

router.get('/hashtags/groups', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const groups = await HashtagGroupsService.getHashtagGroups(req.workspace!.workspaceId.toString());
    res.json(groups);
  } catch (error) {
    next(error);
  }
});

router.post('/hashtags/groups', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const group = await HashtagGroupsService.createHashtagGroup({
      ...req.body,
      workspaceId: req.workspace!.workspaceId.toString(),
      createdBy: req.user!.userId
    });
    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
});

router.delete('/hashtags/groups/:id', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    await HashtagGroupsService.deleteHashtagGroup(req.params.id, req.workspace!.workspaceId.toString());
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Templates
router.get('/templates', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const templates = await templateService.getTemplates(req.workspace!.workspaceId.toString());
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

router.post('/templates', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const template = await templateService.createTemplate({
      ...req.body,
      workspaceId: req.workspace!.workspaceId.toString(),
      createdBy: req.user!.userId
    });
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

router.patch('/templates/:id', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const template = await templateService.updateTemplate(
      req.params.id,
      req.workspace!.workspaceId.toString(),
      req.body
    );
    res.json(template);
  } catch (error) {
    next(error);
  }
});

router.delete('/templates/:id', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    await templateService.deleteTemplate(req.params.id, req.workspace!.workspaceId.toString());
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/templates/:id/apply', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const applied = await templateService.applyTemplate(
      req.params.id,
      req.workspace!.workspaceId.toString()
    );
    res.json(applied);
  } catch (error) {
    next(error);
  }
});

// Saved captions
router.get('/captions', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const captions = [];
    res.json(captions);
  } catch (error) {
    next(error);
  }
});

router.post('/captions', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const caption = { ...req.body, id: 'new-caption-id' };
    res.status(201).json(caption);
  } catch (error) {
    next(error);
  }
});

router.patch('/captions/:id', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    const caption = { ...req.body, id: req.params.id };
    res.json(caption);
  } catch (error) {
    next(error);
  }
});

router.delete('/captions/:id', requireAuth, requireWorkspace, async (req, res, next) => {
  try {
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

// Saved caption categories
router.get('/saved-captions/categories', requireAuth, requireWorkspace, async (req, res) => {
  try {
    const workspaceId = req.workspace!.workspaceId;
    const categories = await SavedCaption.distinct('category', {
      workspaceId: new mongoose.Types.ObjectId(workspaceId.toString()),
    });
    res.json({ success: true, data: categories.sort() });
  } catch (error: any) {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: error.message });
  }
});
