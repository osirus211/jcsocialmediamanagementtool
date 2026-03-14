/**
 * Template Variables Utility
 * 
 * Handles template variable extraction and substitution
 * Supports variables like {{brand_name}}, {{product}}, {{cta}}
 */

export interface VariableSubstitution {
  [key: string]: string;
}

/**
 * Extract variables from template content
 * Returns array of variable names found in {{variable}} format
 */
export function extractVariables(content: string): string[] {
  const variableRegex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = variableRegex.exec(content)) !== null) {
    const variableName = match[1].trim();
    if (!variables.includes(variableName)) {
      variables.push(variableName);
    }
  }

  return variables;
}

/**
 * Substitute variables in template content
 * Replaces {{variable}} with provided values
 */
export function substituteVariables(
  content: string, 
  substitutions: VariableSubstitution
): string {
  let result = content;

  Object.entries(substitutions).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(regex, value);
  });

  return result;
}

/**
 * Get common template variables with descriptions
 */
export function getCommonVariables(): Array<{ name: string; description: string; example: string }> {
  return [
    { name: 'brand_name', description: 'Your brand or company name', example: 'Acme Corp' },
    { name: 'product', description: 'Product or service name', example: 'Premium Widget' },
    { name: 'cta', description: 'Call to action text', example: 'Shop Now' },
    { name: 'discount', description: 'Discount percentage or amount', example: '20% OFF' },
    { name: 'website', description: 'Website URL', example: 'www.example.com' },
    { name: 'email', description: 'Contact email', example: 'hello@example.com' },
    { name: 'phone', description: 'Phone number', example: '(555) 123-4567' },
    { name: 'location', description: 'Business location', example: 'New York, NY' },
    { name: 'date', description: 'Current date', example: 'March 14, 2026' },
    { name: 'time', description: 'Current time', example: '2:30 PM' },
    { name: 'season', description: 'Current season', example: 'Spring' },
    { name: 'month', description: 'Current month', example: 'March' },
    { name: 'year', description: 'Current year', example: '2026' },
    { name: 'customer_name', description: 'Customer or client name', example: 'John Smith' },
    { name: 'testimonial', description: 'Customer testimonial', example: 'Amazing service!' },
    { name: 'feature', description: 'Key product feature', example: 'AI-powered analytics' },
    { name: 'benefit', description: 'Main benefit', example: 'Save 10 hours per week' },
    { name: 'price', description: 'Product price', example: '$99' },
    { name: 'currency', description: 'Currency symbol', example: '$' },
    { name: 'hashtag', description: 'Branded hashtag', example: '#AcmeCorp' },
  ];
}

/**
 * Validate template content for proper variable syntax
 */
export function validateTemplateVariables(content: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for unmatched braces
  const openBraces = (content.match(/\{\{/g) || []).length;
  const closeBraces = (content.match(/\}\}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    errors.push('Unmatched template variable braces. Each {{ must have a corresponding }}');
  }

  // Check for empty variables
  const emptyVariables = content.match(/\{\{\s*\}\}/g);
  if (emptyVariables) {
    errors.push('Empty template variables found. Variables must have a name like {{brand_name}}');
  }

  // Check for nested variables
  const nestedVariables = content.match(/\{\{[^}]*\{\{/g);
  if (nestedVariables) {
    errors.push('Nested template variables are not supported');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}