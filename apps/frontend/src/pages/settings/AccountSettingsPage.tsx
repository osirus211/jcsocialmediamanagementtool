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
  Link as LinkIcon,
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
  
  // Connected OAuth Accounts State
  const [connectedProviders, setConnectedProviders] = useState<{
    google: boolean;
    github: boolean;
    apple: boolean;
  }>({
    google: false,
    github: false,
    apple: false,
  });

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
      
      // Load connected OAuth providers
      loadConnectedProviders();
    } catch (error) {
      console.error('Failed to load account data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConnectedProviders = async () => {
    try {
      const { apiClient } = await import('@/lib/api-client');
      const response = await apiClient.get('/auth/connected-providers');
      setConnectedProviders({
        google: response.google ?? false,
        github: response.github ?? false,
        apple: response.apple ?? false,
      });
    } catch (err) {
      // Silent fail - connected providers are non-critical UI
      console.error('Failed to load connected providers:', err);
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

  const handleConnectProvider = (provider: 'google' | 'github' | 'apple') => {
    const baseUrl = window.location.origin;
    window.location.href = `${baseUrl}/api/v1/oauth/${provider}`;
  };

  const handleDisconnectProvider = async (provider: 'google' | 'github' | 'apple') => {
    try {
      setIsLoading(true);
      // Call disconnect endpoint - will be added to backend
      await fetch(`/api/v1/auth/oauth/${provider}/disconnect`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      setConnectedProviders(prev => ({ ...prev, [provider]: false }));
      toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} account disconnected`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Failed to disconnect ${provider}`);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'email', label: 'Email Management', icon: Mail },
    { id: 'password', label: 'Password', icon: Key },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'connected', label: 'Connected Accounts', icon: LinkIcon },
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

        {/* Connected Accounts Tab */}
        {activeTab === 'connected' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                Connected OAuth Accounts
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Connect your account with OAuth providers for quick sign-in and enhanced features.
              </p>
              
              <div className="space-y-4">
                {/* Google */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-lg gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Google</p>
                      <p className="text-sm text-gray-500">
                        {connectedProviders.google ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  {connectedProviders.google ? (
                    <button
                      onClick={() => handleDisconnectProvider('google')}
                      disabled={isLoading}
                      className="w-full sm:w-auto px-4 py-2 min-h-[44px] border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      aria-label="Disconnect Google account"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnectProvider('google')}
                      disabled={isLoading}
                      className="w-full sm:w-auto px-4 py-2 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      aria-label="Connect Google account"
                    >
                      Connect
                    </button>
                  )}
                </div>

                {/* GitHub */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-lg gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">GitHub</p>
                      <p className="text-sm text-gray-500">
                        {connectedProviders.github ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  {connectedProviders.github ? (
                    <button
                      onClick={() => handleDisconnectProvider('github')}
                      disabled={isLoading}
                      className="w-full sm:w-auto px-4 py-2 min-h-[44px] border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      aria-label="Disconnect GitHub account"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnectProvider('github')}
                      disabled={isLoading}
                      className="w-full sm:w-auto px-4 py-2 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      aria-label="Connect GitHub account"
                    >
                      Connect
                    </button>
                  )}
                </div>

                {/* Apple */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-lg gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Apple</p>
                      <p className="text-sm text-gray-500">
                        {connectedProviders.apple ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  {connectedProviders.apple ? (
                    <button
                      onClick={() => handleDisconnectProvider('apple')}
                      disabled={isLoading}
                      className="w-full sm:w-auto px-4 py-2 min-h-[44px] border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      aria-label="Disconnect Apple account"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnectProvider('apple')}
                      disabled={isLoading}
                      className="w-full sm:w-auto px-4 py-2 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      aria-label="Connect Apple account"
                    >
                      Connect
                    </button>
                  )}
                </div>
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