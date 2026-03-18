import { Request, Response, NextFunction } from 'express'
import { SAMLService, SAMLConfig as SAMLConfigInterface } from '../services/SAMLService'
import { SAMLConfig } from '../models/SAMLConfig'
import { User } from '../models/User'
import { WorkspaceMember, MemberRole } from '../models/WorkspaceMember'
import { AuthTokenService, TokenPayload } from '../services/AuthTokenService'
import * as crypto from 'crypto'

export class SAMLController {
  static async configureSAML(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.user as any
      const { entryPoint, issuer, cert, emailDomain, autoProvision, defaultRole } = req.body

      // Validate cert is valid X.509 PEM
      if (!cert.includes('-----BEGIN CERTIFICATE-----') || !cert.includes('-----END CERTIFICATE-----')) {
        res.status(400).json({
          success: false,
          message: 'Invalid X.509 certificate format'
        })
        return
      }

      // Upsert SAML config for workspace
      const samlConfig = await SAMLConfig.findOneAndUpdate(
        { workspaceId },
        {
          entryPoint,
          issuer,
          cert,
          emailDomain,
          autoProvision: autoProvision ?? true,
          defaultRole: defaultRole || 'MEMBER',
          isEnabled: true
        },
        { upsert: true, new: true }
      )

      res.json({
        success: true,
        data: samlConfig
      })
    } catch (error) {
      next(error)
    }
  }

  static async getSAMLMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.user as any
      
      const samlConfig = await SAMLConfig.findOne({ workspaceId })
      if (!samlConfig) {
        res.status(404).json({
          success: false,
          message: 'SAML not configured for this workspace'
        })
        return
      }

      const samlService = new SAMLService({
        entryPoint: samlConfig.entryPoint,
        issuer: samlConfig.issuer,
        cert: samlConfig.cert,
        callbackUrl: `${process.env.API_BASE_URL}/v1/saml/callback`
      })

      const metadata = await samlService.generateMetadataXml()
      
      res.set('Content-Type', 'application/xml')
      res.send(metadata)
    } catch (error) {
      next(error)
    }
  }

  static async initiateSAMLLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceSlug, domain } = req.query

      let samlConfig
      if (workspaceSlug) {
        // Find workspace by slug - we'll need to import Workspace model
        const { Workspace } = await import('../models/Workspace')
        const workspace = await Workspace.findOne({ slug: workspaceSlug })
        if (!workspace) {
          res.status(404).json({
            success: false,
            message: 'Workspace not found'
          })
          return
        }
        samlConfig = await SAMLConfig.findOne({ workspaceId: workspace._id })
      } else if (domain) {
        samlConfig = await SAMLConfig.findOne({ emailDomain: domain })
      }

      if (!samlConfig || !samlConfig.isEnabled) {
        res.status(404).json({
          success: false,
          message: 'SAML not configured for this domain'
        })
        return
      }

      const samlService = new SAMLService({
        entryPoint: samlConfig.entryPoint,
        issuer: samlConfig.issuer,
        cert: samlConfig.cert,
        callbackUrl: `${process.env.API_BASE_URL}/v1/saml/callback`
      })

      const authorizeUrl = await samlService.generateAuthorizeUrl(samlConfig.workspaceId.toString())
      
      res.redirect(authorizeUrl)
    } catch (error) {
      next(error)
    }
  }

  static async handleSAMLCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { SAMLResponse, RelayState } = req.body

      if (!RelayState) {
        res.status(400).json({
          success: false,
          message: 'Missing workspace information'
        })
        return
      }

      const samlConfig = await SAMLConfig.findOne({ workspaceId: RelayState })
      if (!samlConfig) {
        res.status(404).json({
          success: false,
          message: 'SAML configuration not found'
        })
        return
      }

      const samlService = new SAMLService({
        entryPoint: samlConfig.entryPoint,
        issuer: samlConfig.issuer,
        cert: samlConfig.cert,
        callbackUrl: `${process.env.API_BASE_URL}/v1/saml/callback`
      })

      const profile = await samlService.validateResponse(SAMLResponse, RelayState)

      // Find or create user by email
      let user = await User.findOne({ email: profile.email })
      
      if (!user && samlConfig.autoProvision) {
        user = new User({
          email: profile.email,
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          isVerified: true,
          authProvider: 'saml'
        })
        await user.save()
      }

      if (!user) {
        res.status(403).json({
          success: false,
          message: 'User not found and auto-provisioning is disabled'
        })
        return
      }

      // Check if user is already a member of the workspace
      const existingMember = await WorkspaceMember.findOne({
        workspaceId: samlConfig.workspaceId,
        userId: user._id
      })

      if (!existingMember) {
        // Add user to workspace
        await WorkspaceMember.create({
          workspaceId: samlConfig.workspaceId,
          userId: user._id,
          role: samlConfig.defaultRole as MemberRole,
          joinedAt: new Date(),
          isActive: true
        })
      }

      // Issue JWT tokens
      const tokenPayload: TokenPayload = {
        userId: user._id.toString(),
        email: user.email,
        role: samlConfig.defaultRole
      }
      const tokens = AuthTokenService.generateTokenPair(tokenPayload)

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
      res.redirect(`${frontendUrl}/auth/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`)
    } catch (error) {
      next(error)
    }
  }

  static async deleteSAMLConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.user as any

      await SAMLConfig.findOneAndUpdate(
        { workspaceId },
        { isEnabled: false }
      )

      res.json({
        success: true,
        message: 'SAML configuration disabled'
      })
    } catch (error) {
      next(error)
    }
  }
}