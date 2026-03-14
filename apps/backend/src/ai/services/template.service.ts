/**
 * Template Generation Service
 * Generates industry-specific content templates
 */

import { IAIProvider } from '../types';
import { TemplateGenerationInput, TemplateGenerationOutput } from '../types';
import { buildTemplatePrompt } from '../prompts/template.prompt';
import { logger } from '../../utils/logger';

export class TemplateService {
  constructor(private provider: IAIProvider) {}

  async generateTemplates(input: TemplateGenerationInput): Promise<TemplateGenerationOutput> {
    try {
      const prompt = buildTemplatePrompt(input);
      
      logger.info('Generating templates', {
        provider: this.provider.getProviderName(),
        industry: input.industry,
        platform: input.platform,
        contentType: input.contentType,
      });

      const response = await this.provider.generateCompletion(prompt);
      const tokensUsed = this.provider.getTokenCount(prompt + response);

      // Parse the AI response to extract structured templates
      const templates = this.parseTemplates(response);

      return {
        templates,
        tokensUsed,
        provider: this.provider.getProviderName(),
        model: this.provider.getModelName(),
      };
    } catch (error: any) {
      logger.error('Template generation error:', error);
      throw new Error(`Failed to generate templates: ${error.message}`);
    }
  }

  private parseTemplates(response: string): TemplateGenerationOutput['templates'] {
    try {
      // Try to parse JSON response first
      const parsed = JSON.parse(response);
      return parsed.templates || [];
    } catch {
      // Fallback to text parsing if JSON fails
      return this.parseTemplatesFromText(response);
    }
  }

  private parseTemplatesFromText(text: string): TemplateGenerationOutput['templates'] {
    const templates: TemplateGenerationOutput['templates'] = [];
    
    // Split by template sections (looking for numbered items or template markers)
    const sections = text.split(/(?:\d+\.|Template \d+:|##)/);
    
    sections.forEach((section, index) => {
      if (section.trim() && index > 0) { // Skip first empty section
        const lines = section.trim().split('\n');
        const name = lines[0]?.trim() || `Template ${index}`;
        
        // Find template content (usually after "Template:" or similar)
        let templateContent = '';
        let description = '';
        const placeholders: string[] = [];
        
        let inTemplate = false;
        for (const line of lines) {
          if (line.toLowerCase().includes('template:') || line.toLowerCase().includes('content:')) {
            inTemplate = true;
            continue;
          }
          
          if (inTemplate && !line.toLowerCase().includes('description:') && !line.toLowerCase().includes('placeholders:')) {
            templateContent += line + '\n';
          } else if (line.toLowerCase().includes('description:')) {
            description = line.replace(/description:/i, '').trim();
            inTemplate = false;
          } else if (line.toLowerCase().includes('placeholders:')) {
            const placeholderText = line.replace(/placeholders:/i, '').trim();
            placeholders.push(...placeholderText.split(',').map(p => p.trim()));
          }
        }
        
        // Extract placeholders from template content if not explicitly listed
        if (placeholders.length === 0) {
          const matches = templateContent.match(/\{([^}]+)\}/g);
          if (matches) {
            placeholders.push(...matches.map(m => m.replace(/[{}]/g, '')));
          }
        }
        
        if (templateContent.trim()) {
          templates.push({
            name: name.replace(/[:\-]/g, '').trim(),
            template: templateContent.trim(),
            placeholders: [...new Set(placeholders)], // Remove duplicates
            description: description || `${name} template`,
          });
        }
      }
    });
    
    return templates;
  }
}