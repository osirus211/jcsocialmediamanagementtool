import { apiClient } from '@/lib/api-client';

export interface ContentModification {
  prefix?: string;
  suffix?: string;
  hashtagReplacement?: Record<string, string>;
}

export interface EvergreenRule {
  _id: string;
  workspaceId: string;
  postId: string;
  repostInterval: number;
  maxReposts: number;
  repostCount: number;
  lastRepostedAt?: string;
  enabled: boolean;
  contentModification?: ContentModification;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateRuleInput {
  postId: string;
  repostInterval: number;
  maxReposts: number;
  enabled: boolean;
  contentModification?: ContentModification;
}

export interface UpdateRuleInput {
  repostInterval?: number;
  maxReposts?: number;
  enabled?: boolean;
  contentModification?: ContentModification;
}

export interface ListRulesParams {
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export interface ListRulesResponse {
  rules: EvergreenRule[];
  total: number;
  page: number;
  limit: number;
}

class EvergreenService {
  async createRule(input: CreateRuleInput): Promise<EvergreenRule> {
    const response = await apiClient.post<{ success: boolean; data: EvergreenRule }>(
      '/evergreen',
      input
    );
    return response.data;
  }

  async listRules(params?: ListRulesParams): Promise<ListRulesResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.enabled !== undefined) queryParams.append('enabled', params.enabled.toString());

    const response = await apiClient.get<ListRulesResponse>(
      `/evergreen?${queryParams.toString()}`
    );
    return response;
  }

  async getRule(id: string): Promise<EvergreenRule> {
    const response = await apiClient.get<{ success: boolean; data: EvergreenRule }>(
      `/evergreen/${id}`
    );
    return response.data;
  }

  async updateRule(id: string, updates: UpdateRuleInput): Promise<EvergreenRule> {
    const response = await apiClient.put<{ success: boolean; data: EvergreenRule }>(
      `/evergreen/${id}`,
      updates
    );
    return response.data;
  }

  async deleteRule(id: string): Promise<void> {
    await apiClient.delete(`/evergreen/${id}`);
  }
}

export const evergreenService = new EvergreenService();
