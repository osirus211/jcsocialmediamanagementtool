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
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  content: string;
  hashtags?: string[];
  platforms?: string[];
  mediaIds?: string[];
}

export interface UpdateTemplateInput {
  name?: string;
  content?: string;
  hashtags?: string[];
  platforms?: string[];
  mediaIds?: string[];
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

  async getTemplates(): Promise<PostTemplate[]> {
    const response = await apiClient.get<{ success: boolean; data: PostTemplate[] }>(
      this.baseUrl
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

  async applyTemplate(id: string): Promise<PostTemplate> {
    const response = await apiClient.post<{ success: boolean; data: PostTemplate }>(
      `${this.baseUrl}/${id}/apply`
    );
    return response.data;
  }
}

export const templateService = new TemplateService();
