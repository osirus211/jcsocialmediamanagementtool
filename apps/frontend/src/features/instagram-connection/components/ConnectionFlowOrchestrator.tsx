/**
 * ConnectionFlowOrchestrator Component
 * 
 * Manages the multi-step Instagram connection process with status feedback
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { useEffect } from 'react';
import type { ConnectionState } from '../types';

interface ConnectionFlowOrchestratorProps {
  connectionState: ConnectionState;
  onComplete?: () => void;
  onError?: (error: any) => void;
}

const STEP_MESSAGES: Record<string, string> = {
  idle: 'Ready to connect',
  authorizing: 'Redirecting to Facebook for authorization...',
  exchanging: 'Exchanging authorization code for access token...',
  discovering: 'Discovering Instagram Business accounts...',
  saving: 'Saving connected channels...',
  complete: 'Connection successful!',
  error: 'Connection failed',
};

const STEP_PROGRESS: Record<string, number> = {
  idle: 0,
  authorizing: 20,
  exchanging: 40,
  discovering: 60,
  saving: 80,
  complete: 100,
  error: 0,
};

export function ConnectionFlowOrchestrator({
  connectionState,
  onComplete,
  onError,
}: ConnectionFlowOrchestratorProps) {
  const { step, progress, message, error, accounts } = connectionState;

  // Handle completion
  useEffect(() => {
    if (step === 'complete' && onComplete) {
      onComplete();
    }
  }, [step, onComplete]);

  // Handle error
  useEffect(() => {
    if (step === 'error' && error && onError) {
      onError(error);
    }
  }, [step, error, onError]);

  // Don't render if idle
  if (step === 'idle') {
    return null;
  }

  const displayMessage = message || STEP_MESSAGES[step] || 'Processing...';
  const displayProgress = progress ?? STEP_PROGRESS[step] ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {step === 'complete' ? 'Success!' : step === 'error' ? 'Connection Failed' : 'Connecting Instagram'}
          </h3>
          <p className="text-sm text-gray-600">
            {displayMessage}
          </p>
        </div>

        {/* Progress bar */}
        {step !== 'complete' && step !== 'error' && (
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {displayProgress}% complete
            </p>
          </div>
        )}

        {/* Status icon */}
        <div className="flex justify-center mb-4">
          {step === 'complete' && (
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {step === 'error' && (
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}

          {step !== 'complete' && step !== 'error' && (
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Account count for discovery/saving steps */}
        {(step === 'discovering' || step === 'saving' || step === 'complete') && accounts && accounts.length > 0 && (
          <div className="text-center mb-4">
            <p className="text-sm text-gray-700">
              Found <span className="font-semibold text-blue-600">{accounts.length}</span> Instagram Business {accounts.length === 1 ? 'account' : 'accounts'}
            </p>
          </div>
        )}

        {/* Error details */}
        {step === 'error' && error && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-800">
              {error.userMessage || error.message}
            </p>
            {error.suggestedAction && (
              <p className="text-xs text-red-600 mt-2">
                → {error.suggestedAction}
              </p>
            )}
          </div>
        )}

        {/* Step indicators */}
        {step !== 'complete' && step !== 'error' && (
          <div className="mt-6 space-y-2">
            <StepIndicator label="Authorizing" active={step === 'authorizing'} completed={['exchanging', 'discovering', 'saving'].includes(step)} />
            <StepIndicator label="Exchanging token" active={step === 'exchanging'} completed={['discovering', 'saving'].includes(step)} />
            <StepIndicator label="Discovering accounts" active={step === 'discovering'} completed={['saving'].includes(step)} />
            <StepIndicator label="Saving accounts" active={step === 'saving'} completed={false} />
          </div>
        )}
      </div>
    </div>
  );
}

interface StepIndicatorProps {
  label: string;
  active: boolean;
  completed: boolean;
}

function StepIndicator({ label, active, completed }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`
          w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
          ${completed ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}
        `}
      >
        {completed ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <div className={active ? 'w-2 h-2 bg-white rounded-full' : ''} />
        )}
      </div>
      <span className={`text-sm ${active ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}
