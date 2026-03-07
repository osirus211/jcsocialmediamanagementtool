/**
 * Fast-check Arbitraries for Property-Based Testing
 * 
 * Generators for test data used in property-based tests
 */

import * as fc from 'fast-check';
import type {
  DiscoveredInstagramAccount,
  ConnectionError,
  ConnectionErrorType,
  DiagnosticData,
} from '../types';

/**
 * Instagram account arbitrary
 */
export const instagramAccountArbitrary = fc.record({
  id: fc.string({ minLength: 10, maxLength: 20 }),
  username: fc.string({ minLength: 3, maxLength: 30 }).map(s => s.replace(/[^a-z0-9._]/gi, '')),
  name: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
  profilePictureUrl: fc.option(fc.webUrl()),
  followersCount: fc.option(fc.nat({ max: 10000000 })),
  followsCount: fc.option(fc.nat({ max: 10000 })),
  mediaCount: fc.option(fc.nat({ max: 10000 })),
  biography: fc.option(fc.string({ maxLength: 150 })),
  website: fc.option(fc.webUrl()),
  pageId: fc.string({ minLength: 10, maxLength: 20 }),
  pageName: fc.string({ minLength: 3, maxLength: 50 }),
  alreadyConnected: fc.boolean(),
}) as fc.Arbitrary<DiscoveredInstagramAccount>;

/**
 * Connection error type arbitrary
 */
export const connectionErrorTypeArbitrary = fc.constantFrom<ConnectionErrorType>(
  'no_accounts',
  'no_pages',
  'no_instagram_linked',
  'permission_denied',
  'personal_account',
  'token_exchange_failed',
  'network_error',
  'unknown'
);

/**
 * Connection error arbitrary
 */
export const connectionErrorArbitrary = fc.record({
  type: connectionErrorTypeArbitrary,
  message: fc.string({ minLength: 10, maxLength: 200 }),
  userMessage: fc.string({ minLength: 10, maxLength: 200 }),
  technicalDetails: fc.option(fc.anything()),
  recoverable: fc.boolean(),
  suggestedAction: fc.string({ minLength: 10, maxLength: 100 }),
  helpUrl: fc.option(fc.webUrl()),
  retryable: fc.boolean(),
  timestamp: fc.date(),
}) as fc.Arbitrary<ConnectionError>;

/**
 * Diagnostic data arbitrary
 */
export const diagnosticDataArbitrary = fc.record({
  facebookPagesFound: fc.nat({ max: 20 }),
  facebookPagesWithAdmin: fc.nat({ max: 20 }),
  instagramAccountsFound: fc.nat({ max: 20 }),
  permissionsGranted: fc.array(fc.string(), { maxLength: 10 }),
  permissionsMissing: fc.array(fc.string(), { maxLength: 5 }),
  tokenExchangeSuccess: fc.boolean(),
  timestamp: fc.date(),
}) as fc.Arbitrary<DiagnosticData>;

/**
 * Checklist state arbitrary (all items checked or not)
 */
export const checklistStateArbitrary = fc.record({
  businessAccount: fc.boolean(),
  facebookPageLinked: fc.boolean(),
  adminAccess: fc.boolean(),
});
