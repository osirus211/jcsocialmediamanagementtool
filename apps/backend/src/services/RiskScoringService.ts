export class RiskScoringService {
  static async calculateLoginRisk(context: {
    userId: string
    ipAddress: string
    userAgent: string
    country?: string
  }): Promise<{
    score: number  // 0-100
    factors: string[]
    requiresMFA: boolean
  }> {
    let score = 0
    const factors: string[] = []

    // Factor 1: New IP address (not seen before)
    const knownIp = await this.isKnownIp(context.userId, context.ipAddress)
    if (!knownIp) {
      score += 30
      factors.push('new_ip_address')
    }

    // Factor 2: New device/user agent
    const knownDevice = await this.isKnownDevice(context.userId, context.userAgent)
    if (!knownDevice) {
      score += 25
      factors.push('new_device')
    }

    // Factor 3: Unusual hour (2am-5am local)
    const hour = new Date().getUTCHours()
    if (hour >= 2 && hour <= 5) {
      score += 15
      factors.push('unusual_hour')
    }

    // Factor 4: Recent failed attempts
    const recentFailures = await this.getRecentFailures(context.userId)
    if (recentFailures > 0) {
      score += recentFailures * 10
      factors.push('recent_failures')
    }

    return {
      score: Math.min(score, 100),
      factors,
      requiresMFA: score >= 40,
    }
  }

  private static async isKnownIp(userId: string, ip: string): Promise<boolean> {
    const { LoginHistory } = await import('../models/LoginHistory')
    const count = await LoginHistory.countDocuments({
      userId,
      ipAddress: ip,
      success: true,
    })
    return count > 0
  }

  private static async isKnownDevice(userId: string, userAgent: string): Promise<boolean> {
    const { LoginHistory } = await import('../models/LoginHistory')
    const count = await LoginHistory.countDocuments({
      userId,
      userAgent,
      success: true,
    })
    return count > 0
  }

  private static async getRecentFailures(userId: string): Promise<number> {
    const { LoginHistory } = await import('../models/LoginHistory')
    const since = new Date(Date.now() - 3600000) // 1hr
    return LoginHistory.countDocuments({
      userId,
      success: false,
      createdAt: { $gte: since },
    })
  }
}