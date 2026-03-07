/**
 * Instagram Error Handler
 * 
 * Classifies Instagram API errors (via Facebook Graph API)
 * Instagram uses Facebook's error codes and structure
 */

import { FacebookErrorHandler } from './FacebookErrorHandler';

export class InstagramErrorHandler extends FacebookErrorHandler {
  // Instagram uses Facebook Graph API, so we can reuse Facebook error handling
  // This class exists for clarity and potential future Instagram-specific error handling
}
