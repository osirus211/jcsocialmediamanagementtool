import { Request, Response, NextFunction } from 'express'
import { OIDCService } from '../services/OIDCService'
import { OIDCConfig } from '../models/OIDCConfig'
import { User } from '../models/User'
import { WorkspaceMember, MemberRole } from '../models/WorkspaceMember'
import { AuthTokenService, TokenPayload } from '../services/AuthTokenService'
import * as openidClient from 'openid-client'
import * as crypto from 'crypto'

export class OIDCController {
  static async configureOIDC(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.user as any
      const { issuerUrl, clientId, clientSecret, redirectUri, emailDomain, autoProvision, defaultRole } = req.body

      // Upsert OIDC config for workspace
      const oidcConfig = await OIDCConfig.findOneAndUpdate(
        { workspaceId },
        {
          issuerUrl,
          clientId,
          clientSecret,
          redirectUri,
          emailDomain,
          autoProvision: autoProvision ?? true,
          defaultRole: defaultRole || 'MEMBER',
          isEnabled: true
        },
        { upsert: true, new: true }
      )

      res.json({
        success: true,
        data: oidcConfig
      })
    } catch (error) {
      next(error)
    }
  }

  static async initiateOIDCLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceSlug, domain } = req.query

      let oidcConfig
      if (workspaceSlug) {
        const { Workspace } = await import('../models/Workspace')
        const workspace = await Workspace.findOne({ slug: workspaceSlug })
        if (!workspace) {
          res.status(404).json({
            success: false,
            message: 'Workspace not found'
          })
          return
        }
        oidcConfig = await OIDCConfig.findOne({ workspaceId: workspace._id })
      } else if (domain) {
        oidcConfig = await OIDCConfig.findOne({ emailDomain: domain })
      }

      if (!oidcConfig || !oidcConfig.isEnabled) {
        res.status(404).json({
          success: false,
          message: 'OIDC not configured for this domain'
        })
        return
      }

      const oidcService = await OIDCService.create({
        issuerUrl: oidcConfig.issuerUrl,
        clientId: oidcConfig.clientId,
        clientSecret: oidcConfig.clientSecret,
        redirectUri: oidcConfig.redirectUri
      })

      const state = openidClient.randomState()
      const nonce = openidClient.randomNonce()
      
      // Encode workspace info in state parameter
      const stateData = {
        workspaceId: oidcConfig.workspaceId.toString(),
        nonce,
        timestamp: Date.now()
      }
      const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64')

      const authorizeUrl = await oidcService.generateAuthorizationUrl(encodedState, nonce)
      
      res.redirect(authorizeUrl)
    } catch (error) {
      next(error)
    }
  }

  static async handleOIDCCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state } = req.query

      if (!state || !code) {
        res.status(400).json({
          success: false,
          message: 'Missing required parameters'
        })
        return
      }

      // Decode state parameter
      let stateData
      try {
        stateData = JSON.parse(Buffer.from(state as string, 'base64').toString())
      } catch (err) {
        res.status(400).json({
          success: false,
          message: 'Invalid state parameter'
        })
        return
      }

      const { workspaceId, nonce } = stateData

      if (!workspaceId) {
        res.status(400).json({
          success: false,
          message: 'Missing workspace information'
        })
        return
      }

      const oidcConfig = await OIDCConfig.findOne({ workspaceId })
      if (!oidcConfig) {
        res.status(404).json({
          success: false,
          message: 'OIDC configuration not found'
        })
        return
      }

      const oidcService = await OIDCService.create({
        issuerUrl: oidcConfig.issuerUrl,
        clientId: oidcConfig.clientId,
        clientSecret: oidcConfig.clientSecret,
        redirectUri: oidcConfig.redirectUri
      })

      const userinfo = await oidcService.handleCallback(
        oidcConfig.redirectUri,
        { code: code as string },
        state as string,
        nonce
      )

      // Find or create user by email
      let user = await User.findOne({ email: userinfo.email })
      
      if (!user && oidcConfig.autoProvision) {
        user = new User({
          email: userinfo.email as string,
          firstName: userinfo.given_name as string || '',
          lastName: userinfo.family_name as string || '',
          isVerified: true,
          authProvider: 'oidc'
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
        workspaceId: oidcConfig.workspaceId,
        userId: user._id
      })

      if (!existingMember) {
        // Add user to workspace
        await WorkspaceMember.create({
          workspaceId: oidcConfig.workspaceId,
          userId: user._id,
          role: oidcConfig.defaultRole as MemberRole,
          joinedAt: new Date(),
          isActive: true
        })
      }

      // Issue JWT tokens
      const tokenPayload: TokenPayload = {
        userId: user._id.toString(),
        email: user.email,
        role: oidcConfig.defaultRole
      }
      const tokens = AuthTokenService.generateTokenPair(tokenPayload)

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
      res.redirect(`${frontendUrl}/auth/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`)
    } catch (error) {
      next(error)
    }
  }

  static async deleteOIDCConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.user as any

      await OIDCConfig.findOneAndUpdate(
        { workspaceId },
        { isEnabled: false }
      )

      res.json({
        success: true,
        message: 'OIDC configuration disabled'
      })
    } catch (error) {
      next(error)
    }
  }
}