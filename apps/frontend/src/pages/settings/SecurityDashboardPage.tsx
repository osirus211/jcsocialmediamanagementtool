import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'

interface SecurityDashboardData {
  activeSessionCount: number
  trustedDeviceCount: number
  recentFailedLogins: Array<{
    _id: string
    userId: { firstName: string; lastName: string; email: string }
    ipAddress: string
    failureReason?: string
    createdAt: string
    riskScore: number
  }>
  highRiskLoginAttempts: Array<{
    _id: string
    userId: { firstName: string; lastName: string; email: string }
    ipAddress: string
    createdAt: string
    riskScore: number
  }>
  samlEnabled: boolean
  oidcEnabled: boolean
  mfaEnabledUserCount: number
  mfaDisabledUserCount: number
  breachAttempts: number
  ipBlockedCount: number
  lastBreachReport: any
  totalUsers: number
  mfaAdoptionRate: number
}

export const SecurityDashboardPage = () => {
  const { user } = useAuthStore()
  const [data, setData] = useState<SecurityDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSecurityData()
  }, [])

  const fetchSecurityData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/v1/admin/security/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch security data')
      }

      const result = await response.json()
      setData(result.data)
    } catch (err: any) {
      setError(err.message || 'Failed to load security dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Loading security dashboard...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-red-600 text-lg font-medium">{error}</div>
          <button
            onClick={fetchSecurityData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Security Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Monitor workspace security and authentication activity
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Sessions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.activeSessionCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">MFA Adoption</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.mfaAdoptionRate}%</p>
                <p className="text-xs text-gray-500">{data.mfaEnabledUserCount}/{data.totalUsers} users</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Breach Attempts</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.breachAttempts}</p>
                <p className="text-xs text-gray-500">Last 30 days</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Trusted Devices</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.trustedDeviceCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* SSO Configuration Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            SSO Configuration Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">SAML 2.0</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Enterprise SSO</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                data.samlEnabled 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {data.samlEnabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">OIDC</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">OpenID Connect</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                data.oidcEnabled 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {data.oidcEnabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Failed Login Attempts */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Failed Logins
            </h2>
            <div 
              className="space-y-3 max-h-96 overflow-y-auto"
              aria-label="Recent failed login attempts"
            >
              {data.recentFailedLogins.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No recent failed logins</p>
              ) : (
                data.recentFailedLogins.map((login) => (
                  <div key={login._id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {login.userId.firstName} {login.userId.lastName}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{login.userId.email}</p>
                      <p className="text-xs text-gray-500">IP: {login.ipAddress}</p>
                    </div>
                    <div className="text-right">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        login.riskScore >= 70 
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        Risk: {login.riskScore}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(login.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Visually hidden data table for accessibility */}
            <table className="sr-only">
              <caption>Recent failed login attempts</caption>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>IP Address</th>
                  <th>Risk Score</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentFailedLogins.map((login) => (
                  <tr key={login._id}>
                    <td>{login.userId.firstName} {login.userId.lastName}</td>
                    <td>{login.userId.email}</td>
                    <td>{login.ipAddress}</td>
                    <td>{login.riskScore}</td>
                    <td>{new Date(login.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* High Risk Login Attempts */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              High Risk Login Attempts
            </h2>
            <div 
              className="space-y-3 max-h-96 overflow-y-auto"
              aria-label="High risk login attempts"
            >
              {data.highRiskLoginAttempts.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No high risk attempts</p>
              ) : (
                data.highRiskLoginAttempts.map((login) => (
                  <div key={login._id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {login.userId.firstName} {login.userId.lastName}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{login.userId.email}</p>
                      <p className="text-xs text-gray-500">IP: {login.ipAddress}</p>
                    </div>
                    <div className="text-right">
                      <div className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                        Risk: {login.riskScore}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(login.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Visually hidden data table for accessibility */}
            <table className="sr-only">
              <caption>High risk login attempts</caption>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>IP Address</th>
                  <th>Risk Score</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.highRiskLoginAttempts.map((login) => (
                  <tr key={login._id}>
                    <td>{login.userId.firstName} {login.userId.lastName}</td>
                    <td>{login.userId.email}</td>
                    <td>{login.ipAddress}</td>
                    <td>{login.riskScore}</td>
                    <td>{new Date(login.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}