import { apiClient } from '@/lib/api-client';

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

export interface Campaign {
  _id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color: string;
  status: CampaignStatus;
  startDate?: string;
  endDate?: string;
  goals?: string;
  postCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignWithStats extends Campaign {
  stats: {
    totalPosts: number;
    published: number;
    scheduled: number;
    draft: number;
    platforms: string[];
  };
}

export interface CreateCampaignData {
  name: string;
  description?: string;
  color?: string;
  status?: CampaignStatus;
  startDate?: string;
  endDate?: string;
  goals?: string;
}

export interface UpdateCampaignData {
  name?: string;
  description?: string;
  color?: string;
  status?: CampaignStatus;
  startDate?: string;
  endDate?: string;
  goals?: string;
}

export interface CampaignFilters {
  status?: CampaignStatus;
}

export const campaignsService = {
  /**
   * Get all campaigns for the current workspace
   */
  async getCampaigns(filters?: CampaignFilters): Promise<Campaign[]> {
    const params = new URLSearchParams();
    if (filters?.status) {
      params.append('status', filters.status);
    }
    
    const response = await apiClient.get(`/campaigns?${params.toString()}`);
    return response.data.data;
  },

  /**
   * Get a single campaign with stats
   */
  async getCampaign(id: string): Promise<CampaignWithStats> {
    const response = await apiClient.get(`/campaigns/${id}`);
    return response.data.data;
  },

  /**
   * Create a new campaign
   */
  async createCampaign(data: CreateCampaignData): Promise<Campaign> {
    const response = await apiClient.post('/campaigns', data);
    return response.data.data;
  },

  /**
   * Update a campaign
   */
  async updateCampaign(id: string, data: UpdateCampaignData): Promise<Campaign> {
    const response = await apiClient.patch(`/campaigns/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete a campaign
   */
  async deleteCampaign(id: string): Promise<void> {
    await apiClient.delete(`/campaigns/${id}`);
  },

  /**
   * Get all posts for a campaign
   */
  async getCampaignPosts(id: string): Promise<any[]> {
    const response = await apiClient.get(`/campaigns/${id}/posts`);
    return response.data.data;
  },

  /**
   * Get campaign statistics
   */
  async getCampaignStats(id: string): Promise<{
    totalPosts: number;
    published: number;
    scheduled: number;
    draft: number;
    platforms: string[];
  }> {
    const campaign = await this.getCampaign(id);
    return campaign.stats;
  },
};