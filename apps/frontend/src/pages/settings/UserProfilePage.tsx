/**
 * User Profile Page
 * 
 * Complete user profile management interface
 * 
 * Features:
 * - View/edit profile (name, email, avatar, bio, timezone, language)
 * - Avatar upload with cropping
 * - Change password
 * - Connected social accounts display
 * - Notification preferences
 * - Active sessions management
 * - 2FA status with enable/disable
 * - Delete account option
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Settings,
  Camera,
  Shield,
  Bell,
  Smartphone,
  Trash2,
  Save,
  X,
  AlertTriangle,
  CheckCircle,
  Globe,
  Clock,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { UserProfileService } from '@/services/user-profile.service';
import { TwoFactorService } from '@/services/two-factor.service';
import { toast } from '@/lib/notifications';
import { ProfileEditForm } from '@/components/profile/ProfileEditForm';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { ConnectedAccountsList } from '@/components/profile/ConnectedAccountsList';
import { NotificationPreferences } from '@/components/profile/NotificationPreferences';
import { ActiveSessions } from '@/components/profile/ActiveSessions';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import type { UserSession } from '@/types/auth.types';

export function UserProfilePage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const sessionsData = await UserProfileService.getSessions();
      setSessions(sessionsData);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const handleProfileUpdate = async (data: any) => {
    try {
      setIsLoading(true);
      const response = await UserProfileService.updateProfile(data);
      setUser(response.user);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    try {
      setIsLoading(true);
      const response = await UserProfileService.uploadAvatar(file);
      
      // Update user with new avatar URL
      if (user) {
        setUser({ ...user, avatar: response.avatarUrl });
      }
      
      toast.success('Avatar updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload avatar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationUpdate = async (preferences: any) => {
    try {
      setIsLoading(true);
      const response = await UserProfileService.updateNotificationPreferences(preferences);
      
      // Update user with new preferences
      if (user) {
        setUser({ ...user, notificationPreferences: response.notificationPreferences });
      }
      
      toast.success('Notification preferences updated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionRevoke = async (sessionId: string) => {
    try {
      await UserProfileService.revokeSession(sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
      toast.success('Session revoked successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to revoke session');
    }
  };

  const handleDeleteAccount = async (password: string) => {
    try {
      await UserProfileService.deleteAccount({ password });
      toast.success('Account deleted successfully');
      navigate('/auth/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete account');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'accounts', label: 'Connected Accounts', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'sessions', label: 'Sessions', icon: Smartphone },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
  ];

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">User Profile</h1>
        <p className="text-gray-600 mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
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
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Avatar Section */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Profile Picture
              </h2>
              <AvatarUpload
                currentAvatar={user.avatar}
                onUpload={handleAvatarUpload}
                isLoading={isLoading}
              />
            </div>

            {/* Profile Form */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </h2>
              <ProfileEditForm
                user={user}
                onSubmit={handleProfileUpdate}
                isLoading={isLoading}
              />
            </div>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Connected Social Accounts
            </h2>
            <ConnectedAccountsList />
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Change Password */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Change Password
              </h2>
              <ChangePasswordForm />
            </div>

            {/* 2FA Status */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Two-Factor Authentication
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    {user.twoFactorEnabled
                      ? 'Two-factor authentication is enabled'
                      : 'Two-factor authentication is disabled'}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {user.twoFactorEnabled ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    )}
                    <span className={`text-sm font-medium ${
                      user.twoFactorEnabled ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => navigate(user.twoFactorEnabled ? '/settings/security' : '/settings/2fa/setup')}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    user.twoFactorEnabled
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {user.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Preferences
            </h2>
            <NotificationPreferences
              preferences={user.notificationPreferences}
              onUpdate={handleNotificationUpdate}
              isLoading={isLoading}
            />
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Active Sessions
            </h2>
            <ActiveSessions
              sessions={sessions}
              onRevoke={handleSessionRevoke}
            />
          </div>
        )}

        {activeTab === 'danger' && (
          <div className="bg-white rounded-lg border border-red-200 p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h3 className="font-medium text-red-900 mb-2">Delete Account</h3>
                <p className="text-sm text-red-700 mb-4">
                  Once you delete your account, there is no going back. Please be certain.
                  All your data, posts, and settings will be permanently removed.
                </p>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}