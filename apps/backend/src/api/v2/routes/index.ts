/**
 * API v2 Routes
 * 
 * Centralized router for all v2 API endpoints
 */

import { Router } from 'express';
import twoFactorRoutes from './twoFactor.routes';
import authRoutes from './auth.routes';

const router = Router();

// Register route modules
router.use('/2fa', twoFactorRoutes);
router.use('/auth', authRoutes);

export default router;