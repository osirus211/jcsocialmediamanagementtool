import { api } from './api';

export interface Category {
  _id: string;
  workspaceId: string;
  name: string;
  color: string;
  description?: string;
  icon?: string;
  postCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryData {
  name: string;
  color?: string;
  description?: string;
  icon?: string;
}

export interface UpdateCategoryData {
  name?: string;
  color?: string;
  description?: string;
  icon?: string;
}

export const categoriesService = {
  /**
   * Get all categories for the current workspace
   */
  async getCategories(): Promise<Category[]> {
    const response = await api.get('/categories');
    return response.data.data;
  },

  /**
   * Create a new category
   */
  async createCategory(data: CreateCategoryData): Promise<Category> {
    const response = await api.post('/categories', data);
    return response.data.data;
  },

  /**
   * Update a category
   */
  async updateCategory(id: string, data: UpdateCategoryData): Promise<Category> {
    const response = await api.patch(`/categories/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<void> {
    await api.delete(`/categories/${id}`);
  },
};