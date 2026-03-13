/**
 * Notification Preferences Page
 * 
 * Comprehensive notification settings page for managing all notification preferences
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { UserProfileService } from '@/services/user-profile.service';
import { toast } from '@/lib/notifications';
import { 
  Bell, 
  Mail, 
  Smartphone, 
  Monitor, 
  Users, 
  CreditCard, 
  Shield, 
  Megaphone,
  Clock,
  BellOff,
  Save,
  Loader2
} from 'lucide-react';
import type { User, UpdateNotificationPreferencesData } from '@/types/auth.types';

export function NotificationPrefsPage() {
  const { user, setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState(user?.notificationPreferences || {
    email: {
      postPublished: true,
      postFailed: true,
      weeklyReport: true,
      accountIssues: true,
    },
    push: {
      postPublished: false,
      postFailed: true,
      accountIssues: true,
    },
  });

  useEffect(() => {
    if (user?.notificationPreferences) {
      setFormData(user.notificationPreferences);
    }
  }, [user]);

  const handleEmailChange = (key: keyof typeof formData.email, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      email: {
        ...prev.email,
        [key]: value,
      },
    }));
  };

  const handlePushChange = (key: keyof typeof formData.push, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      push: {
        ...prev.push,
        [key]: value,
      },
    }));
  };

  const handleUnsubscribeAll = () => {
    setFormData({
      email: {
        postPublished: false,
        postFailed: false,
        weeklyReport: false,
        accountIssues: false,
      },
      push: {
        postPublished: false,
        postFailed: false,
        accountIssues: false,
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    setIsLoading(true);
    
    try {
      // Only send changed preferences
      const changes: UpdateNotificationPreferencesData = {};
      
      // Check email preferences
      const emailChanged = Object.keys(formData.email).some(
        key => formData.email[key as keyof typeof formData.email] !== user.notificationPreferences.email[key as keyof typeof user.notificationPreferences.email]
      );
      if (emailChanged) {
        changes.email = formData.email;
      }
      
      // Check push preferences
      const pushChanged = Object.keys(formData.push).some(
        key => formData.push[key as keyof typeof formData.push] !== user.notificationPreferences.push[key as keyof typeof user.notificationPreferences.push]
      );
      if (pushChanged) {
        changes.push = formData.push;
      }

      if (Object.keys(changes).length === 0) {
        toast.success('No changes to save');
        return;
      }

      const response = await UserProfileService.updateNotificationPreferences(changes);
      
      // Update user in store
      setUser({
        ...user,
        notificationPreferences: response.notificationPreferences,
      });

      toast.success('Notification preferences updated successfully');
    } catch (error: any) {
      console.error('Error updating notification preferences:', error);
      toast.error(error.response?.data?.message || 'Failed to update notification preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const emailNotifications = [
    {
      key: 'postPublished' as const,
      title: 'Post Published',
      description: 'When your scheduled posts are successfully published',
      icon: <Bell className="w-5 h-5 text-green-600" />,
    },
    {
      key: 'postFailed' as const,
      title: 'Post Failed',
      description: 'When a scheduled post fails to publish',
      icon: <Bell className="w-5 h-5 text-red-600" />,
    },
    {
      key: 'weeklyReport' as const,
      title: 'Weekly Report',
      description: 'Weekly summary of your account activity and performance',
      icon: <Bell className="w-5 h-5 text-blue-600" />,
    },
    {
      key: 'accountIssues' as const,
      title: 'Account Issues',
      description: 'Important notifications about your account or connected social accounts',
      icon: <Shield className="w-5 h-5 text-orange-600" />,
    },
  ];

  const pushNotifications = [
    {
      key: 'postPublished' as const,
      title: 'Post Published',
      description: 'When your scheduled posts are successfully published',
      icon: <Bell className="w-5 h-5 text-green-600" />,
    },
    {
      key: 'postFailed' as const,
      title: 'Post Failed',
      description: 'When a scheduled post fails to publish',
      icon: <Bell className="w-5 h-5 text-red-600" />,
    },
    {
      key: 'accountIssues' as const,
      title: 'Account Issues',
      description: 'Important notifications about your account or connected social accounts',
      icon: <Shield className="w-5 h-5 text-orange-600" />,
    },
  ];

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Notification Preferences</h1>
        </div>
        <p className="text-gray-600">
          Manage how and when you receive notifications about your account activity.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Email Notifications */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <Mail className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Email Notifications</h2>
              <p className="text-sm text-gray-600 mt-1">
                Receive notifications via email at {user.email}
              </p>
            </div>
          </div>
          
          <div className="space-y-6">
            {emailNotifications.map((notification) => (
              <div key={notification.key} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 mt-1">
                  {notification.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        {notification.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.description}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`email-${notification.key}`}
                        checked={formData.email[notification.key]}
                        onChange={(e) => handleEmailChange(notification.key, e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Push Notifications */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <Smartphone className="w-6 h-6 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Push Notifications</h2>
              <p className="text-sm text-gray-600 mt-1">
                Receive instant notifications in your browser
              </p>
            </div>
          </div>
          
          <div className="space-y-6">
            {pushNotifications.map((notification) => (
              <div key={notification.key} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 mt-1">
                  {notification.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        {notification.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.description}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`push-${notification.key}`}
                        checked={formData.push[notification.key]}
                        onChange={(e) => handlePushChange(notification.key, e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Monitor className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">Browser Permission Required</h4>
                <p className="text-sm text-blue-800 mt-1">
                  Push notifications require browser permission. You may need to enable notifications 
                  in your browser settings if you haven't already.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <BellOff className="w-6 h-6 text-gray-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage all notifications at once
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Unsubscribe from All</h3>
              <p className="text-sm text-gray-600 mt-1">
                Turn off all email and push notifications
              </p>
            </div>
            <button
              type="button"
              onClick={handleUnsubscribeAll}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-lg hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Unsubscribe All
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isLoading ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>
    </div>
  );
}