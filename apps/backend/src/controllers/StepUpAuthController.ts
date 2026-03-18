import { Request, Response, NextFunction } from 'express'
import { AuthTokenService, TokenPayload } from '../services/AuthTokenService'
import { TwoFactorService } from '../services/TwoFactorService'
import { User } from '../models/User'
import { LoginHistory } from '../models/LoginHistory'

export class StepUpAuthController {
  static async stepUpAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.user as any
      const { totpCode, backupCode } = req.body

      if (!totpCode && !backupCode) {
        res.status(400).json({
          success: false,
          message: 'TOTP code or backup code required'
        })
        return
      }

      const user = await User.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes')
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        })
        return
      }

      let isValid = false

      if (totpCode && user.twoFactorEnabled && user.twoFactorSecret) {
        // Verify TOTP code
        isValid = TwoFactorService.verifyToken(totpCode, user.twoFactorSecret)
      } else if (backupCode && user.twoFactorBackupCodes?.length) {
        // Verify backup code
        const result = TwoFactorService.verifyBackupCode(backupCode, user.twoFactorBackupCodes)
        isValid = result.valid
        
        if (isValid) {
          // Remove used backup code
          const updatedCodes = [...user.twoFactorBackupCodes]
          updatedCodes.splice(result.index, 1)
          user.twoFactorBackupCodes = updatedCodes
          await user.save()
        }
      }

      if (!isValid) {
        res.status(400).json({
          success: false,
          message: 'Invalid authentication code'
        })
        return
      }

      // Update login history to mark MFA as completed
      const latestLogin = await LoginHistory.findOne(
        { 
          userId: user._id,
          success: true,
          mfaRequired: true,
          mfaCompleted: false
        },
        null,
        { sort: { createdAt: -1 } }
      )
      
      if (latestLogin) {
        latestLogin.mfaCompleted = true
        await latestLogin.save()
      }

      // Issue new token with stepUpVerified claim
      const tokenPayload: TokenPayload = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      }
      
      const tokens = AuthTokenService.generateTokenPair(tokenPayload)

      res.json({
        success: true,
        accessToken: tokens.accessToken,
        message: 'Step-up authentication completed'
      })
    } catch (error) {
      next(error)
    }
  }
}