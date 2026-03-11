/**
 * Webhooks Service
 * Frontend service for managing outbound webhook endpoints
 */

import { apiClient } from '@/lib/api-client';

export interface WebhookEndpoint {
  _id: string;
  workspaceId: string;
  url: string;
  events: string[];
  description?: string;
  enabled: boolean;
  lastTriggeredAt?: string;
  successCount: number;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEndpointWithSecret extends WebhookEndpoint {
  secret: string;
}

export interface WebhookDelivery {
  _id: string;
  webhookId: string;
  workspaceId: string;
  event: string;
  payload: Record<string, any>;
  url: string;
  attempt: number;
  maxAttempts: number;
  status: 'pending' | 'success' | 'failed' | 'dead_letter';
  statusCode?: number;
  responseBody?: string;
  errorMessage?: string;
  deliveredAt?: string;
  nextRetryAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  deadLetterDeliveries: number;
}

export interface WebhookDeliveryHistory {
  deliveries: WebhookDelivery[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
  stats: WebhookDeliveryStats;
}

export interface WebhookDeliveries {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  lastTriggeredAt?: string;
  recentDeliveries: any[];
}

export interface WebhookTestResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

class WebhooksService {
  /**
   * List all webhook endpoints for workspace
   */
  async listEndpoints(): Promise<WebhookEndpoint[]> {
    const response = await apiClient.get<{ success: boolean; data: WebhookEndpoint[] }>(
      '/webhooks/outbound'
    );
    return response.data;
  }

  /**
   * Create new webhook endpoint
   */
  async createEndpoint(
    url: string,
    events: string[],
    description?: string
  ): Promise<WebhookEndpointWithSecret> {
    const response = await apiClient.post<{ success: boolean; data: WebhookEndpointWithSecret }>(
      '/webhooks/outbound',
      { url, events, description }
    );
    return response.data;
  }

  /**
   * Update webhook endpoint
   */
  async updateEndpoint(
    id: string,
    updates: Partial<{
      url: string;
      events: string[];
      description: string;
      enabled: boolean;
    }>
  ): Promise<WebhookEndpoint> {
    const response = await apiClient.patch<{ success: boolean; data: WebhookEndpoint }>(
      `/webhooks/outbound/${id}`,
      updates
    );
    return response.data;
  }

  /**
   * Delete webhook endpoint
   */
  async deleteEndpoint(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean; message: string }>(
      `/webhooks/outbound/${id}`
    );
  }

  /**
   * Rotate webhook signing secret
   */
  async rotateSecret(id: string): Promise<{ secret: string }> {
    const response = await apiClient.post<{ success: boolean; data: { secret: string } }>(
      `/webhooks/outbound/${id}/rotate-secret`
    );
    return response.data;
  }

  /**
   * Test webhook endpoint
   */
  async testEndpoint(id: string): Promise<WebhookTestResult> {
    const response = await apiClient.post<{ success: boolean; data: WebhookTestResult }>(
      `/webhooks/outbound/${id}/test`
    );
    return response.data;
  }

  /**
   * Get delivery history for webhook endpoint
   */
  async getDeliveries(id: string): Promise<WebhookDeliveries> {
    const response = await apiClient.get<{ success: boolean; data: WebhookDeliveries }>(
      `/webhooks/outbound/${id}/deliveries`
    );
    return response.data;
  }

  /**
   * Get detailed delivery history for webhook endpoint
   */
  async getDeliveryHistory(
    id: string,
    options: {
      limit?: number;
      skip?: number;
      event?: string;
      status?: string;
    } = {}
  ): Promise<WebhookDeliveryHistory> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.skip) params.append('skip', options.skip.toString());
    if (options.event) params.append('event', options.event);
    if (options.status) params.append('status', options.status);

    const response = await apiClient.get<{ success: boolean; data: WebhookDeliveryHistory }>(
      `/webhooks/outbound/${id}/deliveries?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Retry failed webhook deliveries
   */
  async retryFailedDeliveries(id: string): Promise<{ retriedCount: number; message: string }> {
    const response = await apiClient.post<{ 
      success: boolean; 
      data: { retriedCount: number; message: string } 
    }>(`/webhooks/outbound/${id}/retry`);
    return response.data;
  }
}

export const webhooksService = new WebhooksService();