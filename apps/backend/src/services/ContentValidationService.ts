/**
 * Content Validation Service
 * 
 * Handles content validation and moderation
 */

import { logger } from '../utils/logger';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ContentValidationService {
  /**
   * Validate post content
   */
  async validateContent(content: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!content || content.trim().length === 0) {
      errors.push('Content cannot be empty');
    }

    if (content.length > 2000) {
      errors.push('Content exceeds maximum length');
    }

    // Check for inappropriate content (stub)
    if (content.toLowerCase().includes('spam')) {
      warnings.push('Content may contain spam');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate media content
   */
  async validateMedia(mediaUrl: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!mediaUrl) {
      errors.push('Media URL is required');
    }

    try {
      new URL(mediaUrl);
    } catch {
      errors.push('Invalid media URL');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export const contentValidationService = new ContentValidationService();