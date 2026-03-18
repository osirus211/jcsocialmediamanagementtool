import { Router } from 'express'
import { OIDCController } from '../../controllers/OIDCController'
import { requireAuth } from '../../middleware/auth'
import { requireOwner } from '../../middleware/rbac'

const router = Router()

// Configure OIDC (Owner only)
router.post('/configure', requireAuth, requireOwner, OIDCController.configureOIDC)

// Initiate OIDC login (public)
router.get('/login', OIDCController.initiateOIDCLogin)

// Handle OIDC callback (public)
router.get('/callback', OIDCController.handleOIDCCallback)

// Delete OIDC config (Owner only)
router.delete('/configure', requireAuth, requireOwner, OIDCController.deleteOIDCConfig)

export default router