/**
 * Notification Preferences Component
 * 
 * Manages user notification preferences
 */

import { useState } from 'react';
import { Save, Mail, Smartphone } from 'lucide-react';
import type { User, UpdateNotificationPreferencesData } from '@/types/auth.types';

interface NotificationPreferencesProps {
  preferences: User['notificationPreferences'];
  onUpdate: (preferences: UpdateNotificationPreferencesData) => Promise<void>;
  isLoading: boolean;
}

export function NotificationPreferences({ preferences, onUpdate, isLoading }: NotificationPreferencesProps) {
  const [formData, setFormData] = useState(preferences);

  const handleEmailChange = (key: keyof typeof preferences.email, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      email: {
        ...prev.email,
        [key]: value,
      },
    }));
  };

  const handlePushChange = (key: keyof typeof preferences.push, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      push: {
        ...prev.push,
        [key]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only send changed preferences
    const changes: UpdateNotificationPreferencesData = {};
    
    // Check email preferences
    const emailChanged = Object.keys(formData.email).some(
      key => formData.email[key as keyof typeof formData.email] !== preferences.email[key as keyof typeof preferences.email]
    );
    if (emailChanged) {
      changes.email = formData.email;
    }
    
    // Check push preferences
    const pushChanged = Object.keys(formData.push).some(
      key => formData.push[key as keyof typeof formData.push] !== preferences.push[key as keyof typeof preferences.push]
    );
    if (pushChanged) {
      changes.push = formData.push;
    }

    if (Object.keys(changes).length === 0) {
      return; // No changes
    }

    await onUpdate(changes);
  };

  const emailNotifications = [
    {
      key: 'postPublished' as const,
      title: 'Post Published',
      description: 'When your scheduled posts are successfully published',
    },
    {
      key: 'postFailed' as const,
      title: 'Post Failed',
      description: 'When a scheduled post fails to publish',
    },
    {
      key: 'weeklyReport' as const,
      title: 'Weekly Report',
      description: 'Weekly summary of your account activity and performance',
    },
    {
      key: 'accountIssues' as const,
      title: 'Account Issues',
      description: 'Important notifications about your account or connected social accounts',
    },
  ];

  const pushNotifications = [
    {
      key: 'postPublished' as const,
      title: 'Post Published',
      description: 'When your scheduled posts are successfully published',
    },
    {
      key: 'postFailed' as const,
      title: 'Post Failed',
      description: 'When a scheduled post fails to publish',
    },
    {
      key: 'accountIssues' as const,
      title: 'Account Issues',
      description: 'Important notifications about your account or connected social accounts',
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Email Notifications */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Email Notifications</h3>
        </div>
        
        <div className="space-y-4">
          {emailNotifications.map((notification) => (
            <div key={notification.key} className="flex items-start gap-3">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  id={`email-${notification.key}`}
                  checked={formData.email[notification.key]}
                  onChange={(e) => handleEmailChange(notification.key, e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor={`email-${notification.key}`}
                  className="text-sm font-medium text-gray-900 cursor-pointer"
                >
                  {notification.title}
                </label>
                <p className="text-sm text-gray-600 mt-1">
                  {notification.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Push Notifications */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Push Notifications</h3>
        </div>
        
        <div className="space-y-4">
          {pushNotifications.map((notification) => (
            <div key={notification.key} className="flex items-start gap-3">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  id={`push-${notification.key}`}
                  checked={formData.push[notification.key]}
                  onChange={(e) => handlePushChange(notification.key, e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor={`push-${notification.key}`}
                  className="text-sm font-medium text-gray-900 cursor-pointer"
                >
                  {notification.title}
                </label>
                <p className="text-sm text-gray-600 mt-1">
                  {notification.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Push notifications require browser permission. 
            You may need to enable notifications in your browser settings.
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isLoading ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </form>
  );
}