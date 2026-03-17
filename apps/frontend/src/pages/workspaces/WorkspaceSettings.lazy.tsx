import { lazy } from 'react';

/**
 * Lazy-loaded WorkspaceSettings component for code splitting
 * This reduces the initial bundle size and improves performance
 */
export const WorkspaceSettingsPage = lazy(() => 
  import('./WorkspaceSettings').then(module => ({
    default: module.WorkspaceSettingsPage
  }))
);