/**
 * API v2 Routes
 * 
 * Centralized router for all v2 API endpoints
 */

import { Router } from 'express';
import twoFactorRoutes from './twoFactor.routes';
import twoFactorRecoveryRoutes from './twoFactorRecovery.routes';
import authRoutes from './auth.routes';

const router = Router();

// Register route modules
router.use('/2fa', twoFactorRoutes);
router.use('/2fa/recovery', twoFactorRecoveryRoutes);
router.use('/auth', authRoutes);

export default router;