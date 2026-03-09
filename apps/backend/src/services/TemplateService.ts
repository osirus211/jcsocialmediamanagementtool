/**
 * Template Service
 * 
 * Handles variable substitution in workflow action templates
 * Supports nested object paths (e.g., {{post.title}}, {{rss.link}})
 */

import { logger } from '../utils/logger';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class TemplateService {
  /**
   * Substitute variables in template with data
   * 
   * Example:
   *   template: "New post: {{post.title}} - {{post.url}}"
   *   data: { post: { title: "Hello", url: "https://example.com" } }
   *   result: "New post: Hello - https://example.com"
   */
  static substituteVariables(template: string, data: Record<string, any>): string {
    if (!template) return '';

    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmedPath = path.trim();
      const value = this.getNestedValue(data, trimmedPath);
      
      if (value === undefined || value === null) {
        logger.warn('Template variable not found', {
          path: trimmedPath,
          template,
        });
        return match; // Keep original placeholder if value not found
      }
      
      return String(value);
    });
  }

  /**
   * Extract all variable paths from template
   * 
   * Example:
   *   template: "{{post.title}} - {{post.url}}"
   *   result: ["post.title", "post.url"]
   */
  static extractVariables(template: string): string[] {
    if (!template) return [];

    const variables: string[] = [];
    const regex = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      variables.push(match[1].trim());
    }

    return variables;
  }

  /**
   * Validate template syntax
   * 
   * Checks for:
   * - Balanced braces
   * - Valid variable syntax
   * - No empty variable names
   */
  static validateTemplate(template: string): ValidationResult {
    const errors: string[] = [];

    if (!template) {
      return { valid: true, errors: [] };
    }

    // Check for balanced braces
    const openBraces = (template.match(/\{\{/g) || []).length;
    const closeBraces = (template.match(/\}\}/g) || []).length;

    if (openBraces !== closeBraces) {
      errors.push('Unbalanced braces: opening and closing braces must match');
    }

    // Check for empty variable names
    const emptyVars = template.match(/\{\{\s*\}\}/g);
    if (emptyVars) {
      errors.push('Empty variable names are not allowed');
    }

    // Check for invalid characters in variable names
    const variables = this.extractVariables(template);
    for (const variable of variables) {
      if (!/^[a-zA-Z0-9_.]+$/.test(variable)) {
        errors.push(`Invalid variable name: ${variable} (only alphanumeric, dots, and underscores allowed)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get nested value from object using dot notation path
   * 
   * Example:
   *   data: { post: { title: "Hello" } }
   *   path: "post.title"
   *   result: "Hello"
   */
  private static getNestedValue(obj: Record<string, any>, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }
}
