/**
 * Jest Test Setup
 * 
 * Global setup for all tests
 */

// Increase timeout for property-based tests
jest.setTimeout(60000);

// Mock Sentry Node SDK to avoid initialization issues during tests
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
  addBreadcrumb: jest.fn(),
  Handlers: {
    requestHandler: jest.fn(() => (req: any, res: any, next: any) => next()),
    tracingHandler: jest.fn(() => (req: any, res: any, next: any) => next()),
    errorHandler: jest.fn(() => (err: any, req: any, res: any, next: any) => next(err)),
  },
  Integrations: {
    OnUncaughtException: jest.fn(),
    OnUnhandledRejection: jest.fn(),
  },
}));

// Mock Sentry monitoring module to avoid initialization issues during tests
jest.mock('../monitoring/sentry', () => ({
  initSentry: jest.fn(),
  sentryRequestHandler: jest.fn(() => (req: any, res: any, next: any) => next()),
  sentryTracingHandler: jest.fn(() => (req: any, res: any, next: any) => next()),
  sentryErrorHandler: jest.fn(() => (err: any, req: any, res: any, next: any) => next(err)),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// Mock WorkspaceMember model to provide WorkspaceRole and MemberRole enums
jest.mock('../models/WorkspaceMember', () => ({
  WorkspaceMember: jest.fn(),
  WorkspaceRole: {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    VIEWER: 'viewer',
  },
  MemberRole: {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    VIEWER: 'viewer',
  },
  MemberStatus: {
    ACTIVE: 'active',
    PENDING: 'pending',
    SUSPENDED: 'suspended',
  },
}));

// Mock Workspace model
jest.mock('../models/Workspace', () => ({
  Workspace: jest.fn(),
}));

// Mock OAuth providers to avoid compilation issues during infrastructure tests
jest.mock('../services/oauth/FacebookOAuthProvider', () => ({
  FacebookOAuthProvider: jest.fn(),
}));

jest.mock('../services/oauth/InstagramBusinessProvider', () => ({
  InstagramBusinessProvider: jest.fn(),
}));

jest.mock('../services/oauth/LinkedInOAuthProvider', () => ({
  LinkedInOAuthProvider: jest.fn(),
}));

jest.mock('../services/oauth/TikTokProvider', () => ({
  TikTokProvider: jest.fn(),
}));

jest.mock('../services/oauth/TwitterOAuthProvider', () => ({
  TwitterOAuthProvider: jest.fn(),
}));

// Mock AuthService to avoid EmailNotificationService dependency issues
jest.mock('../services/AuthService', () => ({
  AuthService: jest.fn(),
}));

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
