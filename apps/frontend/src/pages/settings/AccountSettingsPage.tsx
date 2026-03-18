/**
 * Account Settings Page
 * 
 * Comprehensive account management interface for Buffer competitor SaaS
 * 
 * Features:
 * - Email Management (change with verification)
 * - Password Management (change, strength indicator, forgot password)
 * - Account Security (login history, trusted devices, account status)
 * - Danger Zone (deactivate, delete, export data)
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Shield,
  Key,
  AlertTriangle,
  Download,
  Trash2,
  UserX,
  Clock,
  Monitor,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  Database,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { AccountService } from '@/services/account.service';
import { UserProfileService } from '@/services/user-profile.service';
import { toast } from '@/lib/notifications';
import { GDPRSettings } from '@/components/settings/GDPRSettings';
import type { 
  LoginActivity, 
  TrustedDevice, 
  AccountStatus,
  EmailChangeRequest
} from '@/types/account.types';
import type { UserSession } from '@/types/auth.types';

export function AccountSettingsPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('email');
  const [isLoading, setIsLoading] = useState(false);
  
  // Email Management State
  const [emailChangeData, setEmailChangeData] = useState({
    newEmail: '',
    password: '',
  });
  const [pendingEmailChange, setPendingEmailChange] = useState<EmailChangeRequest | null>(null);
  
  // Password Management State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  // Security State
  const [loginHistory, setLoginHistory] = useState<LoginActivity[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [activeSessions, setActiveSessions] = useState<UserSession[]>([]);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  
  // Danger Zone State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadAccountData();
  }, []);

  const loadAccountData = async () => {
    try {
      setIsLoading(true);
      const [history, devices, sessions, status, pendingEmail] = await Promise.all([
        AccountService.getLoginHistory(),
        AccountService.getTrustedDevices(),
        UserProfileService.getSessions(),
        AccountService.getAccountStatus(),
        AccountService.getPendingEmailChange(),
      ]);
      
      setLoginHistory(history);
      setTrustedDevices(devices);
      setActiveSessions(sessions);
      setAccountStatus(status);
      setPendingEmailChange(pendingEmail);
    } catch (error) {
      console.error('Failed to load account data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    return Math.min(strength, 100);
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    if (field === 'newPassword') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailChangeData.newEmail || !emailChangeData.password) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);
      await AccountService.requestEmailChange(emailChangeData);
      toast.success('Verification email sent to your new address');
      setEmailChangeData({ newEmail: '', password: '' });
      loadAccountData(); // Refresh to show pending change
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to request email change');
    } finally {
      setIsLoading(false);
    }
  };
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordStrength < 75) {
      toast.error('Password is too weak. Please choose a stronger password.');
      return;
    }

    try {
      setIsLoading(true);
      await AccountService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success('Password changed successfully. Please login again.');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      navigate('/auth/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmailVerification = async () => {
    if (!pendingEmailChange) return;
    
    try {
      setIsLoading(true);
      await AccountService.resendEmailVerification();
      toast.success('Verification email resent');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to resend verification');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEmailChange = async () => {
    try {
      setIsLoading(true);
      await AccountService.cancelEmailChange();
      toast.success('Email change cancelled');
      setPendingEmailChange(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel email change');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeTrustedDevice = async (deviceId: string) => {
    try {
      await AccountService.revokeTrustedDevice(deviceId);
      setTrustedDevices(devices => devices.filter(d => d.id !== deviceId));
      toast.success('Device revoked successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to revoke device');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await UserProfileService.revokeSession(sessionId);
      setActiveSessions(sessions => sessions.filter(s => s.id !== sessionId));
      toast.success('Session revoked successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to revoke session');
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    try {
      // Revoke all sessions except current
      const otherSessions = activeSessions.filter(s => !s.current);
      await Promise.all(otherSessions.map(s => UserProfileService.revokeSession(s.id)));
      setActiveSessions(sessions => sessions.filter(s => s.current));
      toast.success('All other sessions revoked successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to revoke sessions');
    }
  };

  const handleExportData = async () => {
    try {
      setIsLoading(true);
      const blob = await AccountService.exportAccountData();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `account-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Account data exported successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to export data');
    } finally {
      setIsLoading(false);
    }
  };
  const handleDeactivateAccount = async () => {
    if (!confirmPassword) {
      toast.error('Please enter your password to confirm');
      return;
    }

    try {
      setIsLoading(true);
      await AccountService.deactivateAccount({ password: confirmPassword });
      toast.success('Account deactivated successfully');
      navigate('/auth/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to deactivate account');
    } finally {
      setIsLoading(false);
      setShowDeactivateModal(false);
      setConfirmPassword('');
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmPassword) {
      toast.error('Please enter your password to confirm');
      return;
    }

    try {
      setIsLoading(true);
      await AccountService.deleteAccount({ password: confirmPassword });
      toast.success('Account deleted successfully');
      navigate('/auth/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete account');
    } finally {
      setIsLoading(false);
      setShowDeleteModal(false);
      setConfirmPassword('');
    }
  };

  const getPasswordStrengthColor = (strength: number) => {
    if (strength < 25) return 'bg-red-500';
    if (strength < 50) return 'bg-orange-500';
    if (strength < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = (strength: number) => {
    if (strength < 25) return 'Very Weak';
    if (strength < 50) return 'Weak';
    if (strength < 75) return 'Good';
    return 'Strong';
  };

  const tabs = [
    { id: 'email', label: 'Email Management', icon: Mail },
    { id: 'password', label: 'Password', icon: Key },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'gdpr', label: 'Data & Privacy', icon: Database },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
  ];

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading account settings...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-4xl w-full mx-auto px-4 p-6 overflow-x-hidden">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your account security, email, and privacy settings
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Email Management Tab */}
        {activeTab === 'email' && (
          <div className="space-y-6">
            {/* Current Email */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Current Email Address
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Your current email address</p>
                  <p className="font-medium text-gray-900">{user.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {user.isEmailVerified ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-600 font-medium">Verified</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-red-600 font-medium">Not Verified</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Email Change */}
            {pendingEmailChange && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                  Pending Email Change
                </h3>
                <p className="text-sm text-yellow-700 mb-4">
                  We've sent a verification email to <strong>{pendingEmailChange.newEmail}</strong>.
                  Please check your inbox and click the verification link to complete the change.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleResendEmailVerification}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Resend Email
                  </button>
                  <button
                    onClick={handleCancelEmailChange}
                    disabled={isLoading}
                    className="px-4 py-2 border border-yellow-600 text-yellow-600 rounded-lg hover:bg-yellow-50"
                  >
                    Cancel Change
                  </button>
                </div>
              </div>
            )}
            {/* Change Email Form */}
            {!pendingEmailChange && (
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Change Email Address
                </h3>
                <form onSubmit={handleEmailChange} className="space-y-4">
                  <div>
                    <label htmlFor="newEmail" className="block text-sm font-medium text-gray-700 mb-1">
                      New Email Address
                    </label>
                    <input
                      type="email"
                      id="newEmail"
                      value={emailChangeData.newEmail}
                      onChange={(e) => setEmailChangeData(prev => ({ ...prev, newEmail: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter new email address"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="emailPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      id="emailPassword"
                      value={emailChangeData.password}
                      onChange={(e) => setEmailChangeData(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your current password"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Mail className="w-4 h-4" />
                    {isLoading ? 'Sending...' : 'Send Verification Email'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Password Management Tab */}
        {activeTab === 'password' && (
          <div className="space-y-6">
            {/* Change Password */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Key className="w-5 h-5" />
                Change Password
              </h2>
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      id="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter current password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      id="newPassword"
                      value={passwordData.newPassword}
                      onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {passwordData.newPassword && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">Password Strength</span>
                        <span className={`text-xs font-medium ${
                          passwordStrength < 50 ? 'text-red-600' : 
                          passwordStrength < 75 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {getPasswordStrengthText(passwordStrength)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor(passwordStrength)}`}
                          style={{ width: `${passwordStrength}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      id="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Confirm new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                    <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || passwordStrength < 75}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Key className="w-4 h-4" />
                  {isLoading ? 'Changing Password...' : 'Change Password'}
                </button>
              </form>
            </div>
            {/* Forgot Password Link */}
            <div className="bg-gray-50 rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Forgot Your Password?
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                If you can't remember your current password, you can reset it using your email address.
              </p>
              <button
                onClick={() => navigate('/auth/forgot-password')}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <ExternalLink className="w-4 h-4" />
                Reset Password via Email
              </button>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Account Status */}
            {accountStatus && (
              <div className="bg-white rounded-lg border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Account Status
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Account Status</p>
                    <p className={`font-semibold ${
                      accountStatus.status === 'active' ? 'text-green-600' : 
                      accountStatus.status === 'suspended' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {accountStatus.status.charAt(0).toUpperCase() + accountStatus.status.slice(1)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Member Since</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(accountStatus.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Last Login</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(accountStatus.lastLoginAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Active Sessions */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  Active Sessions
                </h3>
                {activeSessions.filter(s => !s.current).length > 0 && (
                  <button
                    onClick={handleRevokeAllOtherSessions}
                    className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                  >
                    Revoke All Other Sessions
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {activeSessions.length > 0 ? (
                  activeSessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <Monitor className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{session.device}</p>
                          <p className="text-xs text-gray-500">
                            {session.location} • Last active: {new Date(session.lastActive).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.current && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            Current Session
                          </span>
                        )}
                        {!session.current ? (
                          <button
                            onClick={() => handleRevokeSession(session.id)}
                            className="px-3 py-1 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50"
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            disabled
                            className="px-3 py-1 text-xs text-gray-400 border border-gray-200 rounded cursor-not-allowed"
                            aria-label="Cannot revoke current session"
                          >
                            Current
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No active sessions</p>
                )}
              </div>
            </div>

            {/* Login History */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Login Activity
              </h3>
              <div className="space-y-3">
                {loginHistory.length > 0 ? (
                  loginHistory.slice(0, 10).map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          activity.success ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {activity.success ? 'Successful login' : 'Failed login attempt'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {activity.ipAddress} • {activity.userAgent}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          {new Date(activity.timestamp).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No recent login activity</p>
                )}
              </div>
            </div>
            {/* Trusted Devices */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Trusted Devices
              </h3>
              <div className="space-y-3">
                {trustedDevices.length > 0 ? (
                  trustedDevices.map((device) => (
                    <div key={device.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <Monitor className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{device.name}</p>
                          <p className="text-xs text-gray-500">
                            {device.browser} on {device.os} • Last used: {new Date(device.lastUsed).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {device.isCurrent && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            Current Device
                          </span>
                        )}
                        {!device.isCurrent && (
                          <button
                            onClick={() => handleRevokeTrustedDevice(device.id)}
                            className="px-3 py-1 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No trusted devices</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* GDPR & Data Privacy Tab */}
        {activeTab === 'gdpr' && (
          <GDPRSettings />
        )}

        {/* Danger Zone Tab */}
        {activeTab === 'danger' && (
          <div className="space-y-6">
            {/* Export Data */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export Account Data
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Download a copy of all your account data including posts, analytics, and settings.
                Use our advanced export tool for more options and better control.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleExportData}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {isLoading ? 'Preparing Export...' : 'Quick Export'}
                </button>
                <Link
                  to="/settings/data-export"
                  className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
                >
                  <Download className="w-4 h-4" />
                  Advanced Export
                </Link>
              </div>
            </div>

            {/* Deactivate Account */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                <UserX className="w-5 h-5" />
                Deactivate Account
              </h3>
              <p className="text-sm text-yellow-700 mb-4">
                Temporarily deactivate your account. You can reactivate it later by logging in.
                Your data will be preserved but your account will be hidden from other users.
              </p>
              <button
                onClick={() => setShowDeactivateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                <UserX className="w-4 h-4" />
                Deactivate Account
              </button>
            </div>
            {/* Delete Account */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-red-900 mb-2 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Delete Account Permanently
              </h3>
              <p className="text-sm text-red-700 mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
                All your posts, analytics, and settings will be permanently removed.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Delete Account
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Deactivate Account Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <UserX className="w-6 h-6 text-yellow-600" />
              <h2 className="text-xl font-semibold text-yellow-900">Deactivate Account</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to deactivate your account? You can reactivate it later by logging in.
            </p>
            <div className="mb-4">
              <label htmlFor="deactivatePassword" className="block text-sm font-medium text-gray-700 mb-1">
                Enter your password to confirm
              </label>
              <input
                type="password"
                id="deactivatePassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeactivateAccount}
                disabled={isLoading || !confirmPassword}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                <UserX className="w-4 h-4" />
                {isLoading ? 'Deactivating...' : 'Deactivate'}
              </button>
              <button
                onClick={() => {
                  setShowDeactivateModal(false);
                  setConfirmPassword('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-semibold text-red-900">Delete Account</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              This action cannot be undone. All your data will be permanently deleted.
            </p>
            <div className="mb-4">
              <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-700 mb-1">
                Enter your password to confirm
              </label>
              <input
                type="password"
                id="deletePassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={isLoading || !confirmPassword}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {isLoading ? 'Deleting...' : 'Delete Forever'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmPassword('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}