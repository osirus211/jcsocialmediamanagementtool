import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { OnboardingController } from '../../controllers/OnboardingController';

const router = Router();

/**
 * GET /api/v1/onboarding/progress
 * Get current user's onboarding progress
 */
router.get('/progress', requireAuth, OnboardingController.getProgress);

/**
 * PUT /api/v1/onboarding/step
 * Update current user's onboarding step
 */
router.put('/step', requireAuth, OnboardingController.updateStep);

/**
 * POST /api/v1/onboarding/complete
 * Mark onboarding as completed
 */
router.post('/complete', requireAuth, OnboardingController.completeOnboarding);

/**
 * POST /api/v1/onboarding/skip
 * Skip onboarding entirely
 */
router.post('/skip', requireAuth, OnboardingController.skipOnboarding);

/**
 * GET /api/v1/onboarding/needs-onboarding
 * Check if current user needs onboarding
 */
router.get('/needs-onboarding', requireAuth, OnboardingController.needsOnboarding);

export { router as onboardingRoutes };