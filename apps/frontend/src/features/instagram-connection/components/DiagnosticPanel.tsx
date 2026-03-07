/**
 * DiagnosticPanel Component
 * 
 * Displays diagnostic information and actionable guidance for connection errors
 * 
 * Requirements: 3.1, 3.3, 3.4, 3.5, 6.2, 6.3, 6.5
 */

import { useState } from 'react';
import type { ConnectionError, DiagnosticData } from '../types';
import { getErrorDetails } from '../utils/error-categorization';

interface DiagnosticPanelProps {
  error: ConnectionError;
  diagnosticData?: DiagnosticData | null;
  onRetry: () => void;
  onOpenInstructions?: () => void;
}

export function DiagnosticPanel({
  error,
  diagnosticData,
  onRetry,
  onOpenInstructions,
}: DiagnosticPanelProps) {
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const errorDetails = getErrorDetails(error.type);

  const handleRetry = () => {
    if (retryCount >= maxRetries) {
      alert('Maximum retry attempts reached. Please follow the setup instructions or contact support.');
      return;
    }

    setRetryCount(prev => prev + 1);
    onRetry();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      {/* Error Icon and Title */}
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {errorDetails.title}
          </h3>
          <p className="text-sm text-gray-600">
            {errorDetails.description}
          </p>
        </div>
      </div>

      {/* Error Message */}
      <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg">
        <p className="text-sm text-red-800">
          {error.userMessage}
        </p>
      </div>

      {/* Diagnostic Information */}
      {diagnosticData && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Diagnostic Information
          </h4>
          <div className="space-y-2 text-sm">
            {diagnosticData.facebookPagesFound !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Facebook Pages Found:</span>
                <span className="font-medium text-gray-900">
                  {diagnosticData.facebookPagesFound}
                </span>
              </div>
            )}
            {diagnosticData.facebookPagesWithAdmin !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Pages with Admin Access:</span>
                <span className={`font-medium ${diagnosticData.facebookPagesWithAdmin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {diagnosticData.facebookPagesWithAdmin}
                </span>
              </div>
            )}
            {diagnosticData.instagramAccountsFound !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Instagram Accounts Found:</span>
                <span className={`font-medium ${diagnosticData.instagramAccountsFound > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {diagnosticData.instagramAccountsFound}
                </span>
              </div>
            )}
            {diagnosticData.permissionsMissing && diagnosticData.permissionsMissing.length > 0 && (
              <div>
                <span className="text-gray-600">Missing Permissions:</span>
                <ul className="mt-1 ml-4 list-disc text-red-600">
                  {diagnosticData.permissionsMissing.map(permission => (
                    <li key={permission}>{permission}</li>
                  ))}
                </ul>
              </div>
            )}
            {diagnosticData.tokenExchangeSuccess !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Token Exchange:</span>
                <span className={`font-medium ${diagnosticData.tokenExchangeSuccess ? 'text-green-600' : 'text-red-600'}`}>
                  {diagnosticData.tokenExchangeSuccess ? 'Success' : 'Failed'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Steps to Resolve */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          Steps to Resolve
        </h4>
        <ol className="space-y-2">
          {errorDetails.steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                {index + 1}
              </span>
              <span className="text-sm text-gray-700 pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Retry Warning */}
      {retryCount > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
          <p className="text-sm text-yellow-800">
            Retry attempt {retryCount} of {maxRetries}. 
            {retryCount >= maxRetries - 1 && ' This is your last attempt.'}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        {error.retryable && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={retryCount >= maxRetries}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {error.type === 'permission_denied' ? 'Retry with Permissions' : 'Try Again'}
          </button>
        )}
        {onOpenInstructions && (
          <button
            type="button"
            onClick={onOpenInstructions}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:ring-gray-200"
          >
            View Setup Instructions
          </button>
        )}
      </div>

      {/* Help Link */}
      <div className="mt-4 text-center">
        <a
          href="/help/instagram-connection"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
        >
          Need more help? View detailed troubleshooting guide →
        </a>
      </div>
    </div>
  );
}
