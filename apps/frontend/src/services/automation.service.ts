/**
 * Automation Service
 * 
 * Frontend service for managing Zapier/Make.com integrations
 */

import { apiClient } from '@/lib/api-client';

export interface AutomationApiKey {
  _id: string;
  name: string;
  prefix: string;
  scopes: string[];
  status: string;
  createdAt: string;
  lastUsedAt?: string;
  requestCount: number;
}

export interface WebhookEndpoint {
  _id: string;
  url: string;
  events: string[];
  enabled: boolean;
  successCount: number;
  failureCount: number;
  lastTriggeredAt?: string;
  createdAt: string;
}

export class AutomationService {
  /**
   * Get API keys suitable for automation (with required scopes)
   */
  static async getAutomationApiKeys(): Promise<AutomationApiKey[]> {
    try {
      const response = await apiClient.get('/api/v1/api-keys');
      
      // Filter for keys with automation-relevant scopes
      const automationScopes = ['posts:read', 'posts:write', 'analytics:read', 'webhooks:write', 'media:write'];
      
      return response.data.filter((key: AutomationApiKey) => 
        automationScopes.some(scope => key.scopes.includes(scope))
      );
    } catch (error) {
      console.error('Failed to get automation API keys:', error);
      throw error;
    }
  }

  /**
   * Create API key for automation with required scopes
   */
  static async createAutomationApiKey(name: string): Promise<{ apiKey: AutomationApiKey; key: string }> {
    try {
      const response = await apiClient.post('/api/v1/api-keys', {
        name,
        scopes: [
          'posts:read',
          'posts:write',
          'analytics:read',
          'webhooks:read',
          'webhooks:write',
          'media:read',
          'media:write',
        ],
        rateLimit: {
          maxRequests: 1000,
          windowMs: 3600000, // 1 hour
        },
      });

      return response.data;
    } catch (error) {
      console.error('Failed to create automation API key:', error);
      throw error;
    }
  }

  /**
   * Get registered webhooks
   */
  static async getWebhooks(): Promise<WebhookEndpoint[]> {
    try {
      const response = await apiClient.get('/api/v2/webhooks');
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to get webhooks:', error);
      throw error;
    }
  }

  /**
   * Delete webhook
   */
  static async deleteWebhook(id: string): Promise<void> {
    try {
      await apiClient.delete(`/api/v2/webhooks/${id}`);
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      throw error;
    }
  }

  /**
   * Test webhook endpoint (if supported)
   */
  static async testWebhook(id: string): Promise<any> {
    try {
      const response = await apiClient.post(`/api/v2/webhooks/${id}/test`);
      return response.data;
    } catch (error) {
      // Test endpoint might not exist, that's okay
      console.warn('Webhook test not available:', error);
      return null;
    }
  }

  /**
   * Get Zapier connection instructions
   */
  static getZapierInstructions(): string[] {
    return [
      'Copy your API key from above',
      'Go to Zapier.com and create a new Zap',
      'Search for "Social Media Scheduler" in the app directory',
      'Choose a trigger (New Post Published, Post Scheduled, etc.)',
      'Paste your API key when prompted',
      'Test the connection and continue building your Zap',
    ];
  }

  /**
   * Get Make.com connection instructions
   */
  static getMakeInstructions(): string[] {
    return [
      'Copy your API key from above',
      'Go to Make.com and create a new scenario',
      'Add a "Social Media Scheduler" module',
      'Choose "Watch Posts" or another trigger',
      'Enter your API key in the connection settings',
      'Configure the webhook URL if needed',
      'Test the connection and continue building',
    ];
  }

  /**
   * Get available triggers for documentation
   */
  static getAvailableTriggers(): Array<{ name: string; description: string }> {
    return [
      {
        name: 'New Post Published',
        description: 'Triggers when a post is successfully published to social media',
      },
      {
        name: 'Post Scheduled',
        description: 'Triggers when a new post is scheduled for future publishing',
      },
      {
        name: 'Analytics Milestone',
        description: 'Triggers when follower or engagement milestones are reached',
      },
      {
        name: 'Post Failed',
        description: 'Triggers when a post fails to publish',
      },
    ];
  }

  /**
   * Get available actions for documentation
   */
  static getAvailableActions(): Array<{ name: string; description: string }> {
    return [
      {
        name: 'Create Post',
        description: 'Create and optionally schedule a new social media post',
      },
      {
        name: 'Schedule Post',
        description: 'Schedule an existing draft post for publishing',
      },
      {
        name: 'Upload Media',
        description: 'Upload media from URL to your media library',
      },
      {
        name: 'Approve Post',
        description: 'Approve a post that is pending approval',
      },
    ];
  }

  /**
   * Generate webhook URL for Make.com
   */
  static getMakeWebhookUrl(): string {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.socialmediascheduler.com'
      : 'http://localhost:3001';
    
    return `${baseUrl}/api/v2/make/hooks/register`;
  }
}