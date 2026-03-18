import { Request, Response, NextFunction } from 'express'
import { LoginHistory } from '../models/LoginHistory'
import { TrustedDevice } from '../models/TrustedDevice'
import { User } from '../models/User'
import { WorkspaceMember } from '../models/WorkspaceMember'
import { SAMLConfig } from '../models/SAMLConfig'
import { OIDCConfig } from '../models/OIDCConfig'

export class SecurityDashboardController {
  static async getSecurityDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.user as any

      // Get workspace members
      const workspaceMembers = await WorkspaceMember.find({ 
        workspaceId,
        isActive: true 
      }).populate('userId')

      const memberUserIds = workspaceMembers.map(m => m.userId)

      // Active session count (approximate - users with recent activity)
      const recentActivityThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours
      const activeSessionCount = await LoginHistory.countDocuments({
        userId: { $in: memberUserIds },
        success: true,
        createdAt: { $gte: recentActivityThreshold }
      })

      // Trusted device count
      const trustedDeviceCount = await TrustedDevice.countDocuments({
        userId: { $in: memberUserIds },
        expiresAt: { $gt: new Date() }
      })

      // Recent failed logins (last 24 hours)
      const recentFailedLogins = await LoginHistory.find({
        userId: { $in: memberUserIds },
        success: false,
        createdAt: { $gte: recentActivityThreshold }
      }).populate('userId', 'firstName lastName email').sort({ createdAt: -1 }).limit(10)

      // High risk login attempts (risk score >= 70)
      const highRiskLoginAttempts = await LoginHistory.find({
        userId: { $in: memberUserIds },
        riskScore: { $gte: 70 },
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      }).populate('userId', 'firstName lastName email').sort({ createdAt: -1 }).limit(10)

      // Check if SAML is enabled
      const samlConfig = await SAMLConfig.findOne({ workspaceId })
      const samlEnabled = samlConfig?.isEnabled || false

      // Check if OIDC is enabled
      const oidcConfig = await OIDCConfig.findOne({ workspaceId })
      const oidcEnabled = oidcConfig?.isEnabled || false

      // MFA adoption rates
      const totalUsers = workspaceMembers.length
      const mfaEnabledUsers = await User.countDocuments({
        _id: { $in: memberUserIds },
        twoFactorEnabled: true
      })
      const mfaDisabledUserCount = totalUsers - mfaEnabledUsers

      // Breach attempts (failed logins with high risk scores in last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const breachAttempts = await LoginHistory.countDocuments({
        userId: { $in: memberUserIds },
        success: false,
        riskScore: { $gte: 80 },
        createdAt: { $gte: thirtyDaysAgo }
      })

      // IP blocked count (approximate - unique IPs with multiple failed attempts)
      const suspiciousIPs = await LoginHistory.aggregate([
        {
          $match: {
            userId: { $in: memberUserIds },
            success: false,
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: '$ipAddress',
            failureCount: { $sum: 1 }
          }
        },
        {
          $match: {
            failureCount: { $gte: 5 } // 5+ failures from same IP
          }
        }
      ])
      const ipBlockedCount = suspiciousIPs.length

      // Last breach report (most recent high-risk failed login)
      const lastBreachReport = await LoginHistory.findOne({
        userId: { $in: memberUserIds },
        success: false,
        riskScore: { $gte: 90 }
      }).populate('userId', 'firstName lastName email').sort({ createdAt: -1 })

      res.json({
        success: true,
        data: {
          activeSessionCount,
          trustedDeviceCount,
          recentFailedLogins,
          highRiskLoginAttempts,
          samlEnabled,
          oidcEnabled: oidcEnabled,
          mfaEnabledUserCount: mfaEnabledUsers,
          mfaDisabledUserCount,
          breachAttempts,
          ipBlockedCount,
          lastBreachReport,
          totalUsers,
          mfaAdoptionRate: totalUsers > 0 ? Math.round((mfaEnabledUsers / totalUsers) * 100) : 0
        }
      })
    } catch (error) {
      next(error)
    }
  }
}