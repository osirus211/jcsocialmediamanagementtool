/**
 * Error Categorization Utility
 * 
 * Categorizes connection errors and generates user-friendly messages
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

import type { ConnectionError } from '../types';

export type ErrorCategory =
  | 'no_accounts'
  | 'no_pages'
  | 'no_instagram_linked'
  | 'permission_denied'
  | 'personal_account'
  | 'token_exchange_failed'
  | 'network_error'
  | 'unknown';

interface ErrorCategoryInfo {
  type: ErrorCategory;
  userMessage: string;
  suggestedAction: string;
  recoverable: boolean;
  retryable: boolean;
}

const ERROR_PATTERNS: Array<{
  pattern: RegExp | string;
  category: ErrorCategory;
  userMessage: string;
  suggestedAction: string;
  recoverable: boolean;
  retryable: boolean;
}> = [
  {
    pattern: /no.*instagram.*business.*account/i,
    category: 'no_accounts',
    userMessage: 'No Instagram Business accounts found',
    suggestedAction: 'Please ensure your Instagram account is converted to a Business account and linked to a Facebook Page',
    recoverable: true,
    retryable: true,
  },
  {
    pattern: /no.*facebook.*page/i,
    category: 'no_pages',
    userMessage: 'No Facebook Pages found',
    suggestedAction: 'Please create a Facebook Page and link it to your Instagram Business account',
    recoverable: true,
    retryable: true,
  },
  {
    pattern: /instagram.*not.*linked/i,
    category: 'no_instagram_linked',
    userMessage: 'Instagram account not linked to Facebook Page',
    suggestedAction: 'Please link your Instagram Business account to a Facebook Page in your Instagram settings',
    recoverable: true,
    retryable: true,
  },
  {
    pattern: /permission.*denied|access.*denied/i,
    category: 'permission_denied',
    userMessage: 'Required permissions were not granted',
    suggestedAction: 'Please grant all required permissions when authorizing with Facebook',
    recoverable: true,
    retryable: true,
  },
  {
    pattern: /personal.*account/i,
    category: 'personal_account',
    userMessage: 'Instagram account is a Personal account',
    suggestedAction: 'Please convert your Instagram account to a Business or Creator account',
    recoverable: true,
    retryable: true,
  },
  {
    pattern: /token.*exchange.*failed|invalid.*code|state.*parameter/i,
    category: 'token_exchange_failed',
    userMessage: 'Failed to complete authorization',
    suggestedAction: 'Please try connecting again',
    recoverable: true,
    retryable: true,
  },
  {
    pattern: /network.*error|timeout|connection.*failed/i,
    category: 'network_error',
    userMessage: 'Network connection failed',
    suggestedAction: 'Please check your internet connection and try again',
    recoverable: true,
    retryable: true,
  },
];

/**
 * Categorize an error and generate user-friendly information
 */
export function categorizeError(error: Error | string): ConnectionError {
  const errorMessage = typeof error === 'string' ? error : error.message;

  // Try to match error message against known patterns
  for (const pattern of ERROR_PATTERNS) {
    const regex = typeof pattern.pattern === 'string' 
      ? new RegExp(pattern.pattern, 'i')
      : pattern.pattern;

    if (regex.test(errorMessage)) {
      return {
        type: pattern.category,
        message: errorMessage,
        userMessage: pattern.userMessage,
        suggestedAction: pattern.suggestedAction,
        recoverable: pattern.recoverable,
        retryable: pattern.retryable,
        timestamp: new Date(),
      };
    }
  }

  // Default to unknown error
  return {
    type: 'unknown',
    message: errorMessage,
    userMessage: 'An unexpected error occurred',
    suggestedAction: 'Please try again or contact support if the problem persists',
    recoverable: true,
    retryable: true,
    timestamp: new Date(),
  };
}

/**
 * Get detailed error information for a specific error category
 */
export function getErrorDetails(category: ErrorCategory): {
  title: string;
  description: string;
  steps: string[];
} {
  switch (category) {
    case 'no_accounts':
      return {
        title: 'No Instagram Business Accounts Found',
        description: 'We couldn\'t find any Instagram Business accounts linked to your Facebook account.',
        steps: [
          'Convert your Instagram account to a Business or Creator account',
          'Create or select a Facebook Page',
          'Link your Instagram Business account to the Facebook Page',
          'Ensure you have admin access to the Facebook Page',
          'Try connecting again',
        ],
      };

    case 'no_pages':
      return {
        title: 'No Facebook Pages Found',
        description: 'You need a Facebook Page to connect an Instagram Business account.',
        steps: [
          'Create a Facebook Page for your business',
          'Link your Instagram Business account to the Page',
          'Try connecting again',
        ],
      };

    case 'no_instagram_linked':
      return {
        title: 'Instagram Not Linked to Facebook Page',
        description: 'Your Instagram Business account needs to be linked to a Facebook Page.',
        steps: [
          'Open Instagram app and go to Settings',
          'Tap "Account" → "Linked Accounts"',
          'Select "Facebook" and link your account',
          'Ensure your Instagram is linked to a Facebook Page (not just your personal profile)',
          'Try connecting again',
        ],
      };

    case 'permission_denied':
      return {
        title: 'Required Permissions Not Granted',
        description: 'Some required permissions were not granted during authorization.',
        steps: [
          'Click "Try Again" below',
          'When prompted by Facebook, grant all requested permissions',
          'These permissions are required to manage your Instagram posts',
        ],
      };

    case 'personal_account':
      return {
        title: 'Personal Instagram Account',
        description: 'Only Instagram Business or Creator accounts can be connected.',
        steps: [
          'Open Instagram app and go to Settings',
          'Tap "Account" → "Switch to Professional Account"',
          'Choose "Business" or "Creator"',
          'Complete the setup process',
          'Try connecting again',
        ],
      };

    case 'token_exchange_failed':
      return {
        title: 'Authorization Failed',
        description: 'We couldn\'t complete the authorization process.',
        steps: [
          'Try connecting again',
          'Make sure you complete the Facebook authorization',
          'Don\'t close the browser during the process',
        ],
      };

    case 'network_error':
      return {
        title: 'Network Connection Failed',
        description: 'We couldn\'t connect to the server.',
        steps: [
          'Check your internet connection',
          'Try again in a few moments',
          'If the problem persists, contact support',
        ],
      };

    case 'unknown':
    default:
      return {
        title: 'Unexpected Error',
        description: 'An unexpected error occurred during the connection process.',
        steps: [
          'Try connecting again',
          'If the problem persists, contact support',
        ],
      };
  }
}

/**
 * Check if an error is recoverable
 */
export function isRecoverableError(error: ConnectionError): boolean {
  return error.recoverable;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: ConnectionError): boolean {
  return error.retryable;
}
