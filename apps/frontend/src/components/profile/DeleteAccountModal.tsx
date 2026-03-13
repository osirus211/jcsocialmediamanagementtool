/**
 * Enhanced Delete Account Modal Component
 * 
 * Multi-step confirmation modal for account deletion with GDPR compliance
 * 
 * Steps:
 * 1. Warning with consequences list
 * 2. Password confirmation
 * 3. Type "DELETE" to confirm
 * 4. Final confirmation with countdown
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, X, Trash2, Eye, EyeOff, Clock, Shield, Download } from 'lucide-react';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
}

type DeleteStep = 1 | 2 | 3 | 4;

export function DeleteAccountModal({ isOpen, onClose, onConfirm }: DeleteAccountModalProps) {
  const [currentStep, setCurrentStep] = useState<DeleteStep>(1);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [canProceed, setCanProceed] = useState(false);

  const CONFIRM_TEXT = 'DELETE';

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setPassword('');
      setConfirmText('');
      setError(null);
      setCountdown(10);
      setCanProceed(false);
    }
  }, [isOpen]);

  // Countdown timer for final step
  useEffect(() => {
    if (currentStep === 4 && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (currentStep === 4 && countdown === 0) {
      setCanProceed(true);
    }
  }, [currentStep, countdown]);

  const handleNext = () => {
    setError(null);
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as DeleteStep);
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as DeleteStep);
    }
  };

  const handleSubmit = async () => {
    if (!canProceed) return;

    try {
      setIsLoading(true);
      setError(null);
      await onConfirm(password);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    setCurrentStep(1);
    setPassword('');
    setConfirmText('');
    setError(null);
    onClose();
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return true; // Just acknowledgment
      case 2:
        return password.length > 0;
      case 3:
        return confirmText === CONFIRM_TEXT;
      case 4:
        return canProceed;
      default:
        return false;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-semibold text-red-900">Delete Account</h2>
          </div>
          <div className="flex items-center gap-4">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Step {currentStep} of 4</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`w-2 h-2 rounded-full ${
                      step <= currentStep ? 'bg-red-500' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step 1: Warning and Consequences */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-medium text-red-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                ⚠️ This action cannot be undone
              </h3>
              <p className="text-sm text-red-800 mb-4">
                Deleting your account will permanently remove all of the following data:
              </p>
              <ul className="text-sm text-red-800 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">•</span>
                  <span><strong>All posts and drafts</strong> - Published and scheduled content across all platforms</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">•</span>
                  <span><strong>Connected social accounts</strong> - Twitter, Facebook, Instagram, LinkedIn, etc.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">•</span>
                  <span><strong>Analytics and performance data</strong> - All historical metrics and insights</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">•</span>
                  <span><strong>Account settings and preferences</strong> - Custom configurations and templates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">•</span>
                  <span><strong>Workspace data and team access</strong> - All collaborative content and permissions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">•</span>
                  <span><strong>Media library</strong> - All uploaded images, videos, and files</span>
                </li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Before you proceed
              </h4>
              <p className="text-sm text-blue-800 mb-3">
                Consider exporting your data first. You have the right to download all your information.
              </p>
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
                onClick={() => {
                  // TODO: Trigger data export
                  window.open('/settings/account#export', '_blank');
                }}
              >
                Export my data before deletion →
              </button>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                30-Day Grace Period
              </h4>
              <p className="text-sm text-yellow-800">
                Your account will be deactivated immediately, but permanently deleted after 30 days. 
                You can cancel this request and restore your account by logging in within this period.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Password Confirmation */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Verify Your Identity</h3>
              <p className="text-sm text-gray-600">
                Please enter your password to confirm your identity before proceeding.
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Current Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Enter your password"
                  disabled={isLoading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Type DELETE Confirmation */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Final Confirmation</h3>
              <p className="text-sm text-gray-600">
                To confirm deletion, please type <code className="bg-gray-100 px-2 py-1 rounded text-red-600 font-mono font-bold">{CONFIRM_TEXT}</code> in the field below.
              </p>
            </div>

            <div>
              <label htmlFor="confirmText" className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-mono font-bold text-red-600">{CONFIRM_TEXT}</span> to confirm *
              </label>
              <input
                type="text"
                id="confirmText"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono"
                placeholder={CONFIRM_TEXT}
                disabled={isLoading}
                autoFocus
              />
              {confirmText && confirmText !== CONFIRM_TEXT && (
                <p className="text-xs text-red-600 mt-1">
                  Please type exactly: {CONFIRM_TEXT}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Final Countdown */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Last Chance</h3>
              <p className="text-sm text-gray-600 mb-4">
                Your account will be permanently deleted. This action cannot be undone.
              </p>
              
              {countdown > 0 ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-2xl font-bold text-red-600 mb-2">{countdown}</div>
                  <p className="text-sm text-red-800">
                    Please wait {countdown} second{countdown !== 1 ? 's' : ''} before you can proceed...
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-red-100 border border-red-300 rounded-lg">
                  <p className="text-sm text-red-900 font-medium">
                    You can now permanently delete your account.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">What happens next:</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Your account will be immediately deactivated</li>
                <li>• All data will be permanently deleted after 30 days</li>
                <li>• You'll receive a confirmation email</li>
                <li>• You can cancel within 30 days by logging in</li>
              </ul>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handleBack}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
          )}
          
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!isStepValid() || isLoading}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed || isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {isLoading ? 'Deleting...' : 'Delete My Account Forever'}
            </button>
          )}
        </div>

        {/* GDPR Notice */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800 text-center">
            This deletion process complies with GDPR Article 17 (Right to Erasure). 
            Your data will be permanently removed from our systems within 30 days.
          </p>
        </div>
      </div>
    </div>
  );
}