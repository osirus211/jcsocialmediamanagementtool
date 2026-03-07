/**
 * UpgradeModal Component
 * Modal shown when plan limit is reached with upgrade CTA
 */

import { useNavigate } from 'react-router-dom';
import { X, Zap } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  limitType?: 'posts' | 'social_accounts' | 'team_members' | 'ai_credits';
  message?: string;
}

export default function UpgradeModal({ 
  isOpen, 
  onClose, 
  limitType = 'posts',
  message 
}: UpgradeModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const limitMessages = {
    posts: 'You\'ve reached your monthly post limit',
    social_accounts: 'You\'ve reached your social account limit',
    team_members: 'You\'ve reached your team member limit',
    ai_credits: 'You\'ve used all your AI credits for this month',
  };

  const displayMessage = message || limitMessages[limitType];

  const handleUpgrade = () => {
    onClose();
    navigate('/pricing');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
            <Zap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        {/* Content */}
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
          Upgrade Your Plan
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
          {displayMessage}. Upgrade to a higher plan to unlock more features and continue growing your social media presence.
        </p>

        {/* Benefits */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Upgrade to get:
          </h4>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>10x more posts per month</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>More social accounts</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Advanced AI features</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Priority support</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
          >
            Maybe Later
          </button>
          <button
            onClick={handleUpgrade}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            View Plans
          </button>
        </div>
      </div>
    </div>
  );
}
