import { Router } from 'express'
import { SAMLController } from '../../controllers/SAMLController'
import { requireAuth } from '../../middleware/auth'
import { requireOwner } from '../../middleware/rbac'

const router = Router()

// Configure SAML (Owner only)
router.post('/configure', requireAuth, requireOwner, SAMLController.configureSAML)

// Get SAML metadata (Owner only)
router.get('/metadata', requireAuth, requireOwner, SAMLController.getSAMLMetadata)

// Initiate SAML login (public)
router.get('/login', SAMLController.initiateSAMLLogin)

// Handle SAML callback (public)
router.post('/callback', SAMLController.handleSAMLCallback)

// Delete SAML config (Owner only)
router.delete('/configure', requireAuth, requireOwner, SAMLController.deleteSAMLConfig)

export default router