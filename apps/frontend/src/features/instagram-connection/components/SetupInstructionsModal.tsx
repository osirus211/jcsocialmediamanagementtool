/**
 * SetupInstructionsModal Component
 * 
 * Provides step-by-step instructions for converting Instagram to Business account
 * and linking it to a Facebook Page.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { useState } from 'react';
import type { InstructionStep } from '../types';

interface SetupInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: 'convert' | 'link' | 'verify';
}

const INSTRUCTION_STEPS: InstructionStep[] = [
  {
    id: 'convert',
    title: 'Convert to Business Account',
    description: 'Convert your Instagram account to a Business or Creator account type.',
    mobileInstructions: [
      'Open the Instagram app on your phone',
      'Go to your profile and tap the menu (☰)',
      'Tap Settings → Account',
      'Tap "Switch to Professional Account"',
      'Choose "Business" or "Creator"',
      'Follow the on-screen prompts to complete setup',
    ],
    webInstructions: [
      'Log in to Instagram on your web browser',
      'Go to your profile',
      'Click Settings → Switch to Professional Account',
      'Choose "Business" or "Creator"',
      'Follow the prompts to complete setup',
    ],
  },
  {
    id: 'create_page',
    title: 'Create or Select Facebook Page',
    description: 'You need a Facebook Page to link your Instagram Business account.',
    mobileInstructions: [
      'Open Facebook app or go to facebook.com',
      'Tap Menu → Pages',
      'Tap "Create" to create a new page',
      'Choose a page type and fill in details',
      'Or select an existing page where you have admin access',
    ],
    webInstructions: [
      'Go to facebook.com/pages/create',
      'Choose a page category',
      'Fill in your page name and details',
      'Click "Create Page"',
      'Or navigate to an existing page where you have admin access',
    ],
  },
  {
    id: 'link',
    title: 'Link Instagram to Facebook Page',
    description: 'Connect your Instagram Business account to your Facebook Page.',
    mobileInstructions: [
      'Open Instagram app',
      'Go to Settings → Account → Linked Accounts',
      'Tap "Facebook"',
      'Log in to Facebook if prompted',
      'Select the Facebook Page you want to link',
      'Tap "Done" to confirm',
    ],
    webInstructions: [
      'Go to your Facebook Page',
      'Click Settings → Instagram',
      'Click "Connect Account"',
      'Log in to Instagram',
      'Authorize the connection',
      'Confirm the link',
    ],
  },
  {
    id: 'verify',
    title: 'Verify Connection',
    description: 'Confirm that your Instagram account is properly linked.',
    mobileInstructions: [
      'Go to your Facebook Page',
      'Tap Settings → Instagram',
      'You should see your Instagram account listed',
      'Status should show "Connected"',
      'Return to our app and try connecting again',
    ],
    webInstructions: [
      'Go to your Facebook Page',
      'Click Settings → Instagram',
      'You should see your Instagram account listed',
      'Status should show "Connected"',
      'Return to our app and try connecting again',
    ],
  },
];

export function SetupInstructionsModal({
  isOpen,
  onClose,
  initialStep = 'convert',
}: SetupInstructionsModalProps) {
  const [activeTab, setActiveTab] = useState<'mobile' | 'web'>('mobile');
  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    return INSTRUCTION_STEPS.findIndex(step => step.id === initialStep) || 0;
  });

  if (!isOpen) return null;

  const currentStep = INSTRUCTION_STEPS[currentStepIndex];
  const instructions = activeTab === 'mobile' 
    ? currentStep.mobileInstructions 
    : currentStep.webInstructions;

  const handleNext = () => {
    if (currentStepIndex < INSTRUCTION_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900">
                Instagram Setup Instructions
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress indicator */}
            <div className="mt-4 flex items-center gap-2">
              {INSTRUCTION_STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => setCurrentStepIndex(index)}
                    className={`
                      flex-1 h-2 rounded-full transition-colors
                      ${index === currentStepIndex ? 'bg-blue-600' : 'bg-gray-200 hover:bg-gray-300'}
                    `}
                    aria-label={`Go to step ${index + 1}: ${step.title}`}
                  />
                  {index < INSTRUCTION_STEPS.length - 1 && (
                    <div className="w-2" />
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Step {currentStepIndex + 1} of {INSTRUCTION_STEPS.length}
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {currentStep.title}
            </h3>
            <p className="text-gray-600 mb-6">
              {currentStep.description}
            </p>

            {/* Tab switcher */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('mobile')}
                className={`
                  px-4 py-2 font-medium text-sm transition-colors border-b-2
                  ${activeTab === 'mobile' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                📱 Mobile App
              </button>
              <button
                onClick={() => setActiveTab('web')}
                className={`
                  px-4 py-2 font-medium text-sm transition-colors border-b-2
                  ${activeTab === 'web' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                💻 Web Browser
              </button>
            </div>

            {/* Instructions list */}
            <ol className="space-y-4">
              {instructions.map((instruction, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <span className="text-gray-700 leading-relaxed pt-0.5">
                    {instruction}
                  </span>
                </li>
              ))}
            </ol>

            {/* Help links */}
            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900 font-medium mb-2">
                Need more help?
              </p>
              <div className="space-y-1">
                <a
                  href="https://help.instagram.com/502981923235522"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 block"
                >
                  → Instagram Business Account Guide
                </a>
                <a
                  href="https://www.facebook.com/business/help/898752960195806"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 block"
                >
                  → Link Instagram to Facebook Page
                </a>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStepIndex === 0}
              className={`
                px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${currentStepIndex === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              ← Previous
            </button>

            <div className="flex gap-2">
              {currentStepIndex === INSTRUCTION_STEPS.length - 1 ? (
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Done
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
