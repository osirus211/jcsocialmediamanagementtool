/**
 * OAuth Environment Validation Module
 * 
 * Validates required OAuth environment variables at startup.
 * Fails fast if critical OAuth credentials are missing.
 * 
 * Security:
 * - Does NOT log secret values
 * - Does NOT expose credentials in error messages
 * - Provides clear error messages for missing configuration
 */

import { logger } from '../utils/logger';

export interface OAuthEnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidatedOAuthConfig {
  facebook: {
    appId: string;
    appSecret: string;
    callbackUrl: string;
  };
  instagram: {
    clientId: string;
    clientSecret: string;
  };
  instagramBasic?: {
    appId?: string;
    appSecret?: string;
    redirectUri?: string;
  };
  twitter?: {
    clientId?: string;
    clientSecret?: string;
    callbackUrl?: string;
  };
}

/**
 * Validate OAuth environment variables
 * 
 * Required variables:
 * - FACEBOOK_APP_ID
 * - FACEBOOK_APP_SECRET
 * - INSTAGRAM_CLIENT_ID
 * - INSTAGRAM_CLIENT_SECRET
 * 
 * Optional variables:
 * - INSTAGRAM_BASIC_APP_ID
 * - INSTAGRAM_BASIC_APP_SECRET
 * - INSTAGRAM_BASIC_REDIRECT_URI
 * - TWITTER_CLIENT_ID
 * - TWITTER_CLIENT_SECRET
 * - TWITTER_CALLBACK_URL
 * 
 * VALIDATION_MODE:
 * - When VALIDATION_MODE=true, skip strict validation for testing
 * - Production behavior unchanged when VALIDATION_MODE is not set
 */
export function validateOAuthEnvironment(): OAuthEnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // VALIDATION_MODE: Skip strict validation for distributed testing
  // Production behavior unchanged - all checks still enforced when VALIDATION_MODE is not set
  const isValidationMode = process.env.VALIDATION_MODE === 'true';

  if (isValidationMode) {
    logger.info('[OAuth Config] VALIDATION_MODE enabled - skipping strict OAuth validation');
    return {
      valid: true,
      errors: [],
      warnings: ['VALIDATION_MODE enabled - using test OAuth configuration'],
    };
  }

  // Validate Facebook OAuth
  if (!process.env.FACEBOOK_APP_ID) {
    errors.push('FACEBOOK_APP_ID is required but not set');
  } else if (!/^\d+$/.test(process.env.FACEBOOK_APP_ID)) {
    errors.push('FACEBOOK_APP_ID must be a numeric string');
  }

  if (!process.env.FACEBOOK_APP_SECRET) {
    errors.push('FACEBOOK_APP_SECRET is required but not set');
  } else if (process.env.FACEBOOK_APP_SECRET.length < 32) {
    errors.push('FACEBOOK_APP_SECRET appears to be invalid (too short)');
  }

  if (!process.env.FACEBOOK_CALLBACK_URL) {
    warnings.push('FACEBOOK_CALLBACK_URL not set, will use default');
  } else {
    try {
      const callbackUrl = new URL(process.env.FACEBOOK_CALLBACK_URL);
      
      // PRODUCTION: Must use HTTPS
      if (process.env.NODE_ENV === 'production' && callbackUrl.protocol !== 'https:') {
        errors.push('FACEBOOK_CALLBACK_URL must use HTTPS in production (found: ' + callbackUrl.protocol + ')');
      }
    } catch {
      errors.push('FACEBOOK_CALLBACK_URL is not a valid URL');
    }
  }

  // Validate Instagram OAuth (Business via Facebook)
  if (!process.env.INSTAGRAM_CLIENT_ID) {
    errors.push('INSTAGRAM_CLIENT_ID is required but not set');
  } else if (!/^\d+$/.test(process.env.INSTAGRAM_CLIENT_ID)) {
    errors.push('INSTAGRAM_CLIENT_ID must be a numeric string');
  }

  if (!process.env.INSTAGRAM_CLIENT_SECRET) {
    errors.push('INSTAGRAM_CLIENT_SECRET is required but not set');
  } else if (process.env.INSTAGRAM_CLIENT_SECRET.length < 32) {
    errors.push('INSTAGRAM_CLIENT_SECRET appears to be invalid (too short)');
  }

  // Validate Instagram Basic Display OAuth
  // PRODUCTION: Required in production environment
  // DEVELOPMENT: Optional in development environment
  const isProduction = process.env.NODE_ENV === 'production';
  const hasBasicAppId = !!process.env.INSTAGRAM_BASIC_APP_ID;
  const hasBasicAppSecret = !!process.env.INSTAGRAM_BASIC_APP_SECRET;
  const hasBasicRedirectUri = !!process.env.INSTAGRAM_BASIC_REDIRECT_URI;

  // Check if values are placeholders
  const isPlaceholderAppId = process.env.INSTAGRAM_BASIC_APP_ID?.includes('your_instagram_basic_app_id');
  const isPlaceholderSecret = process.env.INSTAGRAM_BASIC_APP_SECRET?.includes('your_instagram_basic_app_secret');

  // Skip validation if all values are placeholders (not configured)
  const isBasicDisplayConfigured = hasBasicAppId && hasBasicAppSecret && !isPlaceholderAppId && !isPlaceholderSecret;

  if (isProduction) {
    // PRODUCTION: Instagram Basic Display is REQUIRED
    if (!hasBasicAppId) {
      errors.push('INSTAGRAM_BASIC_APP_ID is required in production but not set');
    } else if (!/^\d+$/.test(process.env.INSTAGRAM_BASIC_APP_ID!)) {
      errors.push('INSTAGRAM_BASIC_APP_ID must be a numeric string');
    }

    if (!hasBasicAppSecret) {
      errors.push('INSTAGRAM_BASIC_APP_SECRET is required in production but not set');
    } else if (process.env.INSTAGRAM_BASIC_APP_SECRET!.length < 32) {
      errors.push('INSTAGRAM_BASIC_APP_SECRET appears to be invalid (too short, minimum 32 characters)');
    }

    if (!hasBasicRedirectUri) {
      errors.push('INSTAGRAM_BASIC_REDIRECT_URI is required in production but not set');
    } else {
      try {
        const redirectUrl = new URL(process.env.INSTAGRAM_BASIC_REDIRECT_URI!);
        
        // PRODUCTION: Must use HTTPS
        if (redirectUrl.protocol !== 'https:') {
          errors.push('INSTAGRAM_BASIC_REDIRECT_URI must use HTTPS in production (found: ' + redirectUrl.protocol + ')');
        }
      } catch {
        errors.push('INSTAGRAM_BASIC_REDIRECT_URI is not a valid URL');
      }
    }
  } else {
    // DEVELOPMENT: Optional, but validate if provided AND not placeholders
    if (isBasicDisplayConfigured) {
      // If any Instagram Basic Display variable is set, validate all of them
      if (!hasBasicAppId) {
        warnings.push('INSTAGRAM_BASIC_APP_SECRET or INSTAGRAM_BASIC_REDIRECT_URI is set but INSTAGRAM_BASIC_APP_ID is missing');
      } else if (!/^\d+$/.test(process.env.INSTAGRAM_BASIC_APP_ID!)) {
        errors.push('INSTAGRAM_BASIC_APP_ID must be a numeric string');
      }

      if (!hasBasicAppSecret) {
        warnings.push('INSTAGRAM_BASIC_APP_ID or INSTAGRAM_BASIC_REDIRECT_URI is set but INSTAGRAM_BASIC_APP_SECRET is missing');
      } else if (process.env.INSTAGRAM_BASIC_APP_SECRET!.length < 32) {
        errors.push('INSTAGRAM_BASIC_APP_SECRET appears to be invalid (too short, minimum 32 characters)');
      }

      if (!hasBasicRedirectUri) {
        warnings.push('INSTAGRAM_BASIC_APP_ID or INSTAGRAM_BASIC_APP_SECRET is set but INSTAGRAM_BASIC_REDIRECT_URI is missing');
      } else {
        try {
          new URL(process.env.INSTAGRAM_BASIC_REDIRECT_URI!);
        } catch {
          errors.push('INSTAGRAM_BASIC_REDIRECT_URI is not a valid URL');
        }
      }
    }
  }

  // Validate Twitter OAuth (optional)
  if (process.env.TWITTER_CLIENT_ID && !process.env.TWITTER_CLIENT_SECRET) {
    warnings.push('TWITTER_CLIENT_ID is set but TWITTER_CLIENT_SECRET is missing');
  }

  if (process.env.TWITTER_CLIENT_SECRET && !process.env.TWITTER_CLIENT_ID) {
    warnings.push('TWITTER_CLIENT_SECRET is set but TWITTER_CLIENT_ID is missing');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get validated OAuth configuration
 * 
 * Throws an error if validation fails
 */
export function getValidatedOAuthConfig(): ValidatedOAuthConfig {
  const validation = validateOAuthEnvironment();

  // Log warnings (non-blocking)
  if (validation.warnings.length > 0) {
    validation.warnings.forEach(warning => {
      logger.warn(`[OAuth Config] ${warning}`);
    });
  }

  // Throw on errors (blocking)
  if (!validation.valid) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const errorMessage = [
      'OAuth environment validation failed:',
      ...validation.errors.map(err => `  - ${err}`),
      '',
      'Please ensure all required OAuth credentials are set in your .env file.',
      isProduction ? 'Required variables (PRODUCTION):' : 'Required variables:',
      '  - FACEBOOK_APP_ID',
      '  - FACEBOOK_APP_SECRET',
      '  - INSTAGRAM_CLIENT_ID',
      '  - INSTAGRAM_CLIENT_SECRET',
      ...(isProduction ? [
        '  - INSTAGRAM_BASIC_APP_ID',
        '  - INSTAGRAM_BASIC_APP_SECRET',
        '  - INSTAGRAM_BASIC_REDIRECT_URI (must be HTTPS)',
      ] : []),
    ].join('\n');

    logger.error('[OAuth Config] Validation failed', {
      errors: validation.errors,
      warnings: validation.warnings,
      environment: process.env.NODE_ENV,
    });

    throw new Error(errorMessage);
  }

  logger.info('[OAuth Config] Validation passed', {
    facebook: {
      appIdSet: !!process.env.FACEBOOK_APP_ID,
      appSecretSet: !!process.env.FACEBOOK_APP_SECRET,
      callbackUrlSet: !!process.env.FACEBOOK_CALLBACK_URL,
    },
    instagram: {
      clientIdSet: !!process.env.INSTAGRAM_CLIENT_ID,
      clientSecretSet: !!process.env.INSTAGRAM_CLIENT_SECRET,
    },
    instagramBasic: {
      appIdSet: !!process.env.INSTAGRAM_BASIC_APP_ID,
      appSecretSet: !!process.env.INSTAGRAM_BASIC_APP_SECRET,
      redirectUriSet: !!process.env.INSTAGRAM_BASIC_REDIRECT_URI,
    },
    twitter: {
      clientIdSet: !!process.env.TWITTER_CLIENT_ID,
      clientSecretSet: !!process.env.TWITTER_CLIENT_SECRET,
    },
  });

  return {
    facebook: {
      appId: process.env.FACEBOOK_APP_ID!,
      appSecret: process.env.FACEBOOK_APP_SECRET!,
      callbackUrl: process.env.FACEBOOK_CALLBACK_URL || '',
    },
    instagram: {
      clientId: process.env.INSTAGRAM_CLIENT_ID!,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET!,
    },
    instagramBasic: {
      appId: process.env.INSTAGRAM_BASIC_APP_ID,
      appSecret: process.env.INSTAGRAM_BASIC_APP_SECRET,
      redirectUri: process.env.INSTAGRAM_BASIC_REDIRECT_URI,
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      callbackUrl: process.env.TWITTER_CALLBACK_URL,
    },
  };
}

/**
 * Validate OAuth configuration at startup
 * 
 * Call this early in server initialization to fail fast
 */
export function validateOAuthConfigAtStartup(): void {
  try {
    getValidatedOAuthConfig();
    console.log('[OAuth Config] ✅ OAuth environment validation passed');
  } catch (error) {
    console.error('[OAuth Config] ❌ OAuth environment validation failed');
    throw error;
  }
}
