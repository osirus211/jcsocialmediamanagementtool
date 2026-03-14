/**
 * Template Variables Utility (Frontend)
 * 
 * Client-side template variable handling
 */

export interface VariableInfo {
  name: string;
  description: string;
  example: string;
}

/**
 * Extract variables from template content
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
 * Get common template variables with descriptions
 */
export function getCommonVariables(): VariableInfo[] {
  return [
    { name: 'brand_name', description: 'Your brand or company name', example: 'Acme Corp' },
    { name: 'product', description: 'Product or service name', example: 'Premium Widget' },
    { name: 'cta', description: 'Call to action text', example: 'Shop Now' },
    { name: 'discount', description: 'Discount percentage or amount', example: '20% OFF' },
    { name: 'website', description: 'Website URL', example: 'www.example.com' },
    { name: 'email', description: 'Contact email', example: 'hello@example.com' },
    { name: 'phone', description: 'Phone number', example: '(555) 123-4567' },
    { name: 'location', description: 'Business location', example: 'New York, NY' },
    { name: 'customer_name', description: 'Customer or client name', example: 'John Smith' },
    { name: 'testimonial', description: 'Customer testimonial', example: 'Amazing service!' },
    { name: 'feature', description: 'Key product feature', example: 'AI-powered analytics' },
    { name: 'benefit', description: 'Main benefit', example: 'Save 10 hours per week' },
    { name: 'price', description: 'Product price', example: '$99' },
    { name: 'hashtag', description: 'Branded hashtag', example: '#AcmeCorp' },
  ];
}

/**
 * Get variable info by name
 */
export function getVariableInfo(variableName: string): VariableInfo | null {
  const commonVars = getCommonVariables();
  return commonVars.find(v => v.name === variableName) || null;
}

/**
 * Substitute variables in content
 */
export function substituteVariables(content: string, substitutions: Record<string, string>): string {
  let result = content;
  
  Object.entries(substitutions).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(regex, value);
  });
  
  return result;
}