/**
 * Template Import/Export Utility
 * 
 * Handles bulk template operations
 */

import { PostTemplate, CreateTemplateInput } from '@/services/template.service';

export interface TemplateExport {
  version: string;
  exportDate: string;
  templates: Omit<PostTemplate, 'id' | 'workspaceId' | 'createdBy' | 'createdAt' | 'updatedAt'>[];
}

/**
 * Export templates to JSON
 */
export function exportTemplates(templates: PostTemplate[]): string {
  const exportData: TemplateExport = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    templates: templates.map(template => ({
      name: template.name,
      content: template.content,
      hashtags: template.hashtags,
      platforms: template.platforms,
      mediaIds: template.mediaIds,
      category: template.category,
      variables: template.variables,
      isPrebuilt: false, // Imported templates are never pre-built
      industry: template.industry,
      rating: template.rating,
      isFavorite: false, // Reset favorite status on import
      isPersonal: template.isPersonal,
      tags: template.tags,
      description: template.description,
      previewImage: template.previewImage,
      characterCount: template.characterCount,
      language: template.language,
      usageCount: 0, // Reset usage count
      lastUsedAt: template.lastUsedAt,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Parse imported template data
 */
export function parseImportedTemplates(jsonData: string): CreateTemplateInput[] {
  try {
    const data = JSON.parse(jsonData) as TemplateExport;
    
    if (!data.templates || !Array.isArray(data.templates)) {
      throw new Error('Invalid template file format');
    }

    return data.templates.map(template => ({
      name: template.name,
      content: template.content,
      hashtags: template.hashtags,
      platforms: template.platforms,
      mediaIds: template.mediaIds,
      category: template.category,
      variables: template.variables,
      isPrebuilt: false,
      industry: template.industry,
      rating: template.rating,
      isFavorite: false,
      isPersonal: template.isPersonal,
      tags: template.tags,
      description: template.description,
      previewImage: template.previewImage,
    }));
  } catch (error) {
    throw new Error('Failed to parse template file. Please check the file format.');
  }
}

/**
 * Download templates as JSON file
 */
export function downloadTemplatesFile(templates: PostTemplate[], filename?: string): void {
  const jsonData = exportTemplates(templates);
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `templates-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}