/**
 * Template Service
 * Phase 2: Post Templates API client
 */

import { apiClient } from '@/lib/api-client';

export interface PostTemplate {
  id: string;
  workspaceId: string;
  name: string;
  content: string;
  hashtags: string[];
  platforms: string[];
  mediaIds: string[];
  createdBy: string;
  usageCount: number;
  lastUsedAt?: string;
  // New competitive features
  category: string;
  variables: string[];
  isPrebuilt: boolean;
  industry?: string;
  rating: number;
  isFavorite: boolean;
  isPersonal: boolean;
  tags: string[];
  description?: string;
  previewImage?: string;
  characterCount: number;
  language?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  content: string;
  hashtags?: string[];
  platforms?: string[];
  mediaIds?: string[];
  // New competitive features
  category?: string;
  variables?: string[];
  isPrebuilt?: boolean;
  industry?: string;
  rating?: number;
  isFavorite?: boolean;
  isPersonal?: boolean;
  tags?: string[];
  description?: string;
  previewImage?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  content?: string;
  hashtags?: string[];
  platforms?: string[];
  mediaIds?: string[];
  // New competitive features
  category?: string;
  variables?: string[];
  rating?: number;
  isFavorite?: boolean;
  isPersonal?: boolean;
  tags?: string[];
  description?: string;
  previewImage?: string;
}

export interface TemplateFilters {
  category?: string;
  industry?: string;
  platforms?: string[];
  isPrebuilt?: boolean;
  isFavorite?: boolean;
  isPersonal?: boolean;
  search?: string;
  tags?: string[];
}

export interface VariableSubstitution {
  [key: string]: string;
}

class TemplateService {
  private baseUrl = '/api/v1/templates';

  async createTemplate(input: CreateTemplateInput): Promise<PostTemplate> {
    const response = await apiClient.post<{ success: boolean; data: PostTemplate }>(
      this.baseUrl,
      input
    );
    return response.data;
  }

  async getTemplates(filters?: TemplateFilters): Promise<PostTemplate[]> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }

    const response = await apiClient.get<{ success: boolean; data: PostTemplate[] }>(
      `${this.baseUrl}${params.toString() ? `?${params.toString()}` : ''}`
    );
    return response.data;
  }

  async getTemplate(id: string): Promise<PostTemplate> {
    const response = await apiClient.get<{ success: boolean; data: PostTemplate }>(
      `${this.baseUrl}/${id}`
    );
    return response.data;
  }

  async updateTemplate(id: string, input: UpdateTemplateInput): Promise<PostTemplate> {
    const response = await apiClient.patch<{ success: boolean; data: PostTemplate }>(
      `${this.baseUrl}/${id}`,
      input
    );
    return response.data;
  }

  async deleteTemplate(id: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/${id}`);
  }

  async applyTemplate(id: string, variables?: VariableSubstitution): Promise<PostTemplate> {
    const response = await apiClient.post<{ success: boolean; data: PostTemplate }>(
      `${this.baseUrl}/${id}/apply`,
      variables ? { variables } : {}
    );
    return response.data;
  }

  async getCategories(): Promise<string[]> {
    const response = await apiClient.get<{ success: boolean; data: string[] }>(
      `${this.baseUrl}/categories`
    );
    return response.data;
  }

  async getTags(): Promise<string[]> {
    const response = await apiClient.get<{ success: boolean; data: string[] }>(
      `${this.baseUrl}/tags`
    );
    return response.data;
  }

  async duplicateTemplate(id: string, name: string): Promise<PostTemplate> {
    const response = await apiClient.post<{ success: boolean; data: PostTemplate }>(
      `${this.baseUrl}/${id}/duplicate`,
      { name }
    );
    return response.data;
  }

  async getAISuggestions(content: string, limit?: number): Promise<PostTemplate[]> {
    const response = await apiClient.post<{ success: boolean; data: PostTemplate[] }>(
      `${this.baseUrl}/suggestions`,
      { content, limit }
    );
    return response.data;
  }
}

export const templateService = new TemplateService();
