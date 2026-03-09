/**
 * API Scope Registry
 * 
 * Centralized configuration for all Public API permission scopes
 * 
 * Features:
 * - Defines all available scopes with metadata
 * - Provides scope hierarchy (write implies read)
 * - Groups scopes by category for UI
 * - Validates scope strings
 * - Generates documentation
 * 
 * Usage:
 * - API key creation/update validation
 * - Scope middleware authorization
 * - Developer portal UI
 * - API documentation generation
 */

/**
 * Scope definition interface
 */
export interface ScopeDefinition {
  name: string;
  description: string;
  category: string;
  implies?: string[];
  endpoints?: string[];
}

/**
 * Scope category definition
 */
export interface ScopeCategory {
  name: string;
  description: string;
  scopes: string[];
}

/**
 * API Scope Registry
 * 
 * Defines all available scopes with complete metadata
 */
export const API_SCOPES: Record<string, ScopeDefinition> = {
  // Posts scopes
  'posts:read': {
    name: 'posts:read',
    description: 'Read posts and drafts',
    category: 'posts',
    endpoints: [
      'GET /api/public/v1/posts',
      'GET /api/public/v1/posts/:id',
    ],
  },
  'posts:write': {
    name: 'posts:write',
    description: 'Create, update, and delete posts',
    category: 'posts',
    implies: ['posts:read'],
    endpoints: [
      'POST /api/public/v1/posts',
      'PUT /api/public/v1/posts/:id',
      'PATCH /api/public/v1/posts/:id',
      'DELETE /api/public/v1/posts/:id',
    ],
  },

  // Analytics scopes
  'analytics:read': {
    name: 'analytics:read',
    description: 'Read analytics data and metrics',
    category: 'analytics',
    endpoints: [
      'GET /api/public/v1/analytics',
      'GET /api/public/v1/analytics/posts/:id',
    ],
  },

  // Media scopes
  'media:read': {
    name: 'media:read',
    description: 'Read media library and assets',
    category: 'media',
    endpoints: [
      'GET /api/public/v1/media',
      'GET /api/public/v1/media/:id',
    ],
  },
  'media:write': {
    name: 'media:write',
    description: 'Upload, update, and delete media',
    category: 'media',
    implies: ['media:read'],
    endpoints: [
      'POST /api/public/v1/media',
      'PUT /api/public/v1/media/:id',
      'DELETE /api/public/v1/media/:id',
    ],
  },

  // Accounts scopes
  'accounts:read': {
    name: 'accounts:read',
    description: 'Read connected social media accounts',
    category: 'accounts',
    endpoints: [
      'GET /api/public/v1/accounts',
      'GET /api/public/v1/accounts/:id',
    ],
  },
  'accounts:write': {
    name: 'accounts:write',
    description: 'Connect and disconnect social media accounts',
    category: 'accounts',
    implies: ['accounts:read'],
    endpoints: [
      'POST /api/public/v1/accounts',
      'DELETE /api/public/v1/accounts/:id',
    ],
  },

  // Workspaces scopes
  'workspaces:read': {
    name: 'workspaces:read',
    description: 'Read workspace information and settings',
    category: 'workspaces',
    endpoints: [
      'GET /api/public/v1/workspace',
    ],
  },

  // Integrations scopes
  'integrations:read': {
    name: 'integrations:read',
    description: 'Read OAuth integrations and connections',
    category: 'integrations',
    endpoints: [
      'GET /api/public/v1/integrations',
      'GET /api/public/v1/integrations/:id',
    ],
  },
  'integrations:write': {
    name: 'integrations:write',
    description: 'Create, update, and delete OAuth integrations',
    category: 'integrations',
    implies: ['integrations:read'],
    endpoints: [
      'POST /api/public/v1/integrations',
      'PUT /api/public/v1/integrations/:id',
      'PATCH /api/public/v1/integrations/:id',
      'DELETE /api/public/v1/integrations/:id',
    ],
  },
};

/**
 * Scope categories with descriptions
 */
export const SCOPE_CATEGORIES: Record<string, ScopeCategory> = {
  posts: {
    name: 'Posts',
    description: 'Manage social media posts and drafts',
    scopes: ['posts:read', 'posts:write'],
  },
  analytics: {
    name: 'Analytics',
    description: 'Access analytics data and metrics',
    scopes: ['analytics:read'],
  },
  media: {
    name: 'Media',
    description: 'Manage media library and assets',
    scopes: ['media:read', 'media:write'],
  },
  accounts: {
    name: 'Accounts',
    description: 'Manage connected social media accounts',
    scopes: ['accounts:read', 'accounts:write'],
  },
  workspaces: {
    name: 'Workspaces',
    description: 'Access workspace information',
    scopes: ['workspaces:read'],
  },
  integrations: {
    name: 'Integrations',
    description: 'Manage OAuth integrations',
    scopes: ['integrations:read', 'integrations:write'],
  },
};

/**
 * Get all valid scope strings
 */
export const VALID_SCOPES = Object.keys(API_SCOPES);

/**
 * Check if a scope is valid
 */
export function isValidScope(scope: string): boolean {
  return VALID_SCOPES.includes(scope);
}

/**
 * Validate an array of scopes
 * Returns array of invalid scopes (empty if all valid)
 */
export function validateScopes(scopes: string[]): string[] {
  return scopes.filter(scope => !isValidScope(scope));
}

/**
 * Get scope definition
 */
export function getScopeDefinition(scope: string): ScopeDefinition | undefined {
  return API_SCOPES[scope];
}

/**
 * Get all scopes in a category
 */
export function getScopesByCategory(category: string): ScopeDefinition[] {
  return Object.values(API_SCOPES).filter(scope => scope.category === category);
}

/**
 * Get scopes grouped by category
 */
export function getAllScopesGroupedByCategory(): Record<string, ScopeDefinition[]> {
  const grouped: Record<string, ScopeDefinition[]> = {};
  
  for (const scope of Object.values(API_SCOPES)) {
    if (!grouped[scope.category]) {
      grouped[scope.category] = [];
    }
    grouped[scope.category].push(scope);
  }
  
  return grouped;
}

/**
 * Check if a scope implies another scope
 * Example: posts:write implies posts:read
 */
export function scopeImplies(scope: string, impliedScope: string): boolean {
  const definition = API_SCOPES[scope];
  if (!definition) {
    return false;
  }
  
  return definition.implies?.includes(impliedScope) || false;
}

/**
 * Get all scopes implied by a given scope
 * Example: posts:write returns ['posts:read']
 */
export function getImpliedScopes(scope: string): string[] {
  const definition = API_SCOPES[scope];
  if (!definition || !definition.implies) {
    return [];
  }
  
  return definition.implies;
}

/**
 * Expand scopes to include implied scopes
 * Example: ['posts:write'] returns ['posts:write', 'posts:read']
 */
export function expandScopes(scopes: string[]): string[] {
  const expanded = new Set<string>(scopes);
  
  for (const scope of scopes) {
    const implied = getImpliedScopes(scope);
    for (const impliedScope of implied) {
      expanded.add(impliedScope);
    }
  }
  
  return Array.from(expanded);
}

/**
 * Check if a user has a required scope (considering implications)
 * Example: hasScope(['posts:write'], 'posts:read') returns true
 */
export function hasScope(userScopes: string[], requiredScope: string): boolean {
  // Check exact match
  if (userScopes.includes(requiredScope)) {
    return true;
  }
  
  // Check if any user scope implies the required scope
  for (const userScope of userScopes) {
    if (scopeImplies(userScope, requiredScope)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get scope documentation for API docs
 */
export function getScopeDocumentation(): {
  scope: string;
  description: string;
  category: string;
  implies?: string[];
  endpoints?: string[];
}[] {
  return Object.values(API_SCOPES).map(scope => ({
    scope: scope.name,
    description: scope.description,
    category: scope.category,
    implies: scope.implies,
    endpoints: scope.endpoints,
  }));
}

/**
 * Get category documentation
 */
export function getCategoryDocumentation(): ScopeCategory[] {
  return Object.values(SCOPE_CATEGORIES);
}

/**
 * Format scopes for display
 * Groups by category and sorts
 */
export function formatScopesForDisplay(scopes: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  
  for (const scope of scopes) {
    const definition = API_SCOPES[scope];
    if (!definition) continue;
    
    const category = definition.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(scope);
  }
  
  // Sort scopes within each category
  for (const category in grouped) {
    grouped[category].sort();
  }
  
  return grouped;
}
