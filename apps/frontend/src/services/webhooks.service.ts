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
}

export const webhooksService = new WebhooksService();