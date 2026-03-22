import { Router } from 'express';
import composerRoutes from './composer.routes';
import mediaRoutes from './media.routes';
import queueRoutes from './v1/queue.routes';
import queueSlotRoutes from './v1/queue-slots.routes';
import evergreenRoutes from './v1/evergreen.routes';
import rssFeedsRoutes from './v1/rss-feeds.routes';
import rssArticlesRoutes from './v1/rss-articles.routes';
import blackoutDateRoutes from './blackoutDates';
import listeningRulesRoutes from './v1/listening-rules.routes';
import mentionsRoutes from './v1/mentions.routes';
import notificationsRoutes from './v1/notifications.routes';
import postCommentsRoutes from './v1/post-comments.routes';
import inboxRoutes from './v1/inbox.routes';

const router = Router();

router.use('/v1/composer', composerRoutes);
router.use('/v1/media', mediaRoutes);
router.use('/v1/queue', queueRoutes);
router.use('/v1/queue-slots', queueSlotRoutes);
router.use('/v1/evergreen', evergreenRoutes);
router.use('/v1/rss/feeds', rssFeedsRoutes);
router.use('/v1/rss/articles', rssArticlesRoutes);
router.use('/v1/blackout-dates', blackoutDateRoutes);
router.use('/v1/listening-rules', listeningRulesRoutes);
router.use('/v1/mentions', mentionsRoutes);
router.use('/v1/notifications', notificationsRoutes);
router.use('/v1/post-comments', postCommentsRoutes);
router.use('/v1/inbox', inboxRoutes);

export default router;
