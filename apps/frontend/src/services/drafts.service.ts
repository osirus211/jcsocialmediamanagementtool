/**
 * Drafts Service
 * 
 * Handles collaborative draft editing API calls
 */

import { apiClient } from '../lib/api-client';

export interface DraftPost {
  _id: string;
  workspaceId: string;
  content: string;
  platformContent: PlatformContent[];
  mediaIds: string[];
  socialAccountIds: string[];
  status: string;
  version: number;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  lastEditedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  lastEditedAt?: string;
  lockedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  lockedAt?: string;
  lockExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformContent {
  platform: string;
  text?: string;
  mediaIds?: string[];
  enabled: boolean;
}

export interface DraftsList {
  drafts: DraftPost[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
}

export interface LockResult {
  success: boolean;
  lockedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  lockedAt?: string;
  lockExpiresAt?: string;
}

export interface DraftStatus {
  lockedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  lockExpiresAt?: string;
  lastEditedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  lastEditedAt?: string;
  version: number;
}

export interface AutoSaveResult {
  saved: boolean;
  version: number;
  conflict?: boolean;
}

class DraftsService {
  /**
   * List all drafts for workspace
   */
  async listDrafts(params?: { limit?: number; skip?: number }): Promise<DraftsList> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.skip) queryParams.append('skip', params.skip.toString());

    const response = await apiClient.get(`/drafts?${queryParams.toString()}`);
    return response.data;
  }

  /**
   * Get single draft with full details
   */
  async getDraft(id: string): Promise<DraftPost> {
    const response = await apiClient.get(`/drafts/${id}`);
    return response.data;
  }

  /**
   * Get lightweight draft status (for polling)
   */
  async getDraftStatus(id: string): Promise<DraftStatus> {
    const response = await apiClient.get(`/drafts/${id}/status`);
    return response.data;
  }

  /**
   * Acquire edit lock for draft
   */
  async acquireLock(id: string): Promise<LockResult> {
    try {
      const response = await apiClient.post(`/drafts/${id}/lock`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Lock already held by another user
        return error.response.data.data;
      }
      throw error;
    }
  }

  /**
   * Release edit lock for draft
   */
  async releaseLock(id: string): Promise<void> {
    await apiClient.delete(`/drafts/${id}/lock`);
  }

  /**
   * Renew edit lock for draft
   */
  async renewLock(id: string): Promise<{ lockExpiresAt: string }> {
    const response = await apiClient.post(`/drafts/${id}/lock/renew`);
    return response.data;
  }

  /**
   * Auto-save draft content
   */
  async autoSave(
    id: string,
    content: string,
    platformContent?: PlatformContent[],
    version?: number
  ): Promise<AutoSaveResult> {
    try {
      const response = await apiClient.post(`/drafts/${id}/autosave`, {
        content,
        platformContent,
        version,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Version conflict
        return error.response.data.data;
      }
      throw error;
    }
  }
}

export const draftsService = new DraftsService();