/**
 * Activity Icon Component
 * 
 * Maps ActivityAction enum values to icons and colors
 */

import React from 'react';

interface ActivityIconProps {
  action: string;
  className?: string;
}

export const ActivityIcon: React.FC<ActivityIconProps> = ({ action, className = "w-5 h-5" }) => {
  const getIconAndColor = (action: string) => {
    switch (action) {
      // Post actions
      case 'post_created':
        return { icon: '✏️', color: 'text-blue-600', bgColor: 'bg-blue-100' };
      case 'post_updated':
        return { icon: '📝', color: 'text-blue-600', bgColor: 'bg-blue-100' };
      case 'post_published':
        return { icon: '🚀', color: 'text-green-600', bgColor: 'bg-green-100' };
      case 'post_deleted':
        return { icon: '🗑️', color: 'text-red-600', bgColor: 'bg-red-100' };
      case 'post_failed':
        return { icon: '❌', color: 'text-red-600', bgColor: 'bg-red-100' };
      case 'post_submitted_for_approval':
        return { icon: '📋', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
      case 'post_approved':
        return { icon: '✅', color: 'text-green-600', bgColor: 'bg-green-100' };
      case 'post_rejected':
        return { icon: '❌', color: 'text-red-600', bgColor: 'bg-red-100' };
      
      // Member actions
      case 'member_invited':
        return { icon: '👋', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
      case 'member_joined':
        return { icon: '🎉', color: 'text-green-600', bgColor: 'bg-green-100' };
      case 'member_removed':
        return { icon: '👋', color: 'text-red-600', bgColor: 'bg-red-100' };
      case 'member_role_changed':
        return { icon: '🔑', color: 'text-orange-600', bgColor: 'bg-orange-100' };
      
      // Social account actions
      case 'account_connected':
        return { icon: '🔗', color: 'text-green-600', bgColor: 'bg-green-100' };
      case 'account_disconnected':
        return { icon: '🔗', color: 'text-red-600', bgColor: 'bg-red-100' };
      case 'account_reconnected':
        return { icon: '🔄', color: 'text-blue-600', bgColor: 'bg-blue-100' };
      
      // Workspace actions
      case 'workspace_created':
        return { icon: '🏢', color: 'text-green-600', bgColor: 'bg-green-100' };
      case 'workspace_updated':
        return { icon: '⚙️', color: 'text-blue-600', bgColor: 'bg-blue-100' };
      case 'workspace_deleted':
        return { icon: '🗑️', color: 'text-red-600', bgColor: 'bg-red-100' };
      case 'workspace_plan_changed':
        return { icon: '💳', color: 'text-purple-600', bgColor: 'bg-purple-100' };
      
      // Media actions
      case 'media_uploaded':
        return { icon: '📷', color: 'text-blue-600', bgColor: 'bg-blue-100' };
      case 'media_deleted':
        return { icon: '🗑️', color: 'text-red-600', bgColor: 'bg-red-100' };
      
      // Security actions
      case 'login_success':
        return { icon: '🔐', color: 'text-green-600', bgColor: 'bg-green-100' };
      case 'login_failed':
        return { icon: '🚫', color: 'text-red-600', bgColor: 'bg-red-100' };
      case 'password_changed':
        return { icon: '🔑', color: 'text-blue-600', bgColor: 'bg-blue-100' };
      case 'two_factor_enabled':
        return { icon: '🛡️', color: 'text-green-600', bgColor: 'bg-green-100' };
      case 'two_factor_disabled':
        return { icon: '🛡️', color: 'text-red-600', bgColor: 'bg-red-100' };
      
      // Billing actions
      case 'subscription_created':
        return { icon: '💳', color: 'text-green-600', bgColor: 'bg-green-100' };
      case 'subscription_updated':
        return { icon: '💳', color: 'text-blue-600', bgColor: 'bg-blue-100' };
      case 'subscription_cancelled':
        return { icon: '💳', color: 'text-red-600', bgColor: 'bg-red-100' };
      case 'payment_success':
        return { icon: '💰', color: 'text-green-600', bgColor: 'bg-green-100' };
      case 'payment_failed':
        return { icon: '💰', color: 'text-red-600', bgColor: 'bg-red-100' };
      
      // API actions
      case 'api_key_created':
        return { icon: '🔧', color: 'text-green-600', bgColor: 'bg-green-100' };
      case 'api_key_deleted':
        return { icon: '🔧', color: 'text-red-600', bgColor: 'bg-red-100' };
      case 'webhook_created':
        return { icon: '🔗', color: 'text-green-600', bgColor: 'bg-green-100' };
      case 'webhook_deleted':
        return { icon: '🔗', color: 'text-red-600', bgColor: 'bg-red-100' };
      
      // Default
      default:
        return { icon: '⚡', color: 'text-gray-600', bgColor: 'bg-gray-100' };
    }
  };

  const { icon, color, bgColor } = getIconAndColor(action);

  return (
    <div className={`flex items-center justify-center rounded-full p-2 ${bgColor} ${className}`}>
      <span className={`text-sm ${color}`} role="img" aria-label={action}>
        {icon}
      </span>
    </div>
  );
};