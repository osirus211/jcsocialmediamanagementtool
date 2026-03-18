/**
 * Client Portal Service
 * 
 * API client for client approval portals and branding management
 */

import { apiClient } from '@/lib/api-client';

// New Portal System Types
export interface ClientPortal {
  _id: string;
  workspaceId: string;
  name: string;
  slug: string;
  clientEmail: string;
  clientName: string;
  clientCompany?: string;
  accessToken: string;
  tokenExpiresAt?: string;
  allowedActions: {
    view: boolean;
    approve: boolean;
    reject: boolean;
    comment: boolean;
  };
  branding: {
    logo?: string;
    primaryColor: string;
    accentColor: string;
    companyName: string;
    customMessage?: string;
  };
  posts: string[];
  postApprovals: PostApproval[];
  comments: PostComment[];
  status: 'active' | 'inactive' | 'expired';
  expiresAt?: string;
  lastAccessedAt?: string;
  accessCount: number;
  passwordProtected: boolean;
  notifyOnAction: boolean;
  reminderSentAt?: string;
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PostApproval {
  postId: string;
  status: 'pending' | 'approved' | 'rejected' | 'commented';
  feedback?: string;
  approvedAt?: string;
}

export interface PostComment {
  postId: string;
  text: string;
  clientEmail: string;
  createdAt: string;
}

export interface CreatePortalInput {
  name: string;
  clientEmail: string;
  clientName: string;
  clientCompany?: string;
  postIds: string[];
  allowedActions?: {
    view?: boolean;
    approve?: boolean;
    reject?: boolean;
    comment?: boolean;
  };
  branding?: {
    logo?: string;
    primaryColor?: string;
    accentColor?: string;
    companyName?: string;
    customMessage?: string;
  };
  expiresInDays?: number;
  passwordProtected?: boolean;
  password?: string;
  notifyOnAction?: boolean;
}

export interface UpdatePortalInput {
  name?: string;
  clientEmail?: string;
  clientName?: string;
  clientCompany?: string;
  allowedActions?: {
    view?: boolean;
    approve?: boolean;
    reject?: boolean;
    comment?: boolean;
  };
  branding?: {
    logo?: string;
    primaryColor?: string;
    accentColor?: string;
    companyName?: string;
    customMessage?: string;
  };
  expiresAt?: string;
  passwordProtected?: boolean;
  password?: string;
  notifyOnAction?: boolean;
  status?: 'active' | 'inactive' | 'expired';
}

export interface PortalsResponse {
  portals: ClientPortal[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PublicPortalResponse {
  portal: ClientPortal;
  posts: any[];
}

export interface PortalActivityResponse {
  portal: ClientPortal;
  stats: {
    totalPosts: number;
    approvedPosts: number;
    rejectedPosts: number;
    pendingPosts: number;
    totalComments: number;
    completionRate: number;
  };
}

// Legacy Types (keep for backward compatibility)
export interface ClientReview {
  _id: string;
  workspaceId: string;
  token: string;
  name: string;
  clientEmail?: string;
  clientName?: string;
  postIds: string[];
  status: 'pending' | 'viewed' | 'approved' | 'rejected' | 'changes_requested';
  clientFeedback?: string;
  reviewedAt?: string;
  expiresAt?: string;
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPortalBranding {
  enabled: boolean;
  brandName?: string;
  logoUrl?: string;
  primaryColor?: string;
  customDomain?: string;
  welcomeMessage?: string;
  requirePassword: boolean;
}

export interface CreateReviewInput {
  name: string;
  postIds: string[];
  clientEmail?: string;
  clientName?: string;
  expiresInDays?: number;
}

export interface SubmitFeedbackInput {
  status: 'approved' | 'rejected' | 'changes_requested';
  feedback?: string;
}

export interface UpdateBrandingInput {
  enabled?: boolean;
  brandName?: string;
  logoUrl?: string;
  primaryColor?: string;
  customDomain?: string;
  welcomeMessage?: string;
  requirePassword?: boolean;
  portalPassword?: string;
}

export interface ReviewsResponse {
  reviews: ClientReview[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PublicReviewResponse {
  review: ClientReview;
  posts: any[];
  branding: ClientPortalBranding;
}

class ClientPortalService {
  // NEW PORTAL SYSTEM METHODS

  /**
   * Create a new client portal
   */
  async createPortal(input: CreatePortalInput): Promise<{
    portal: ClientPortal;
    portalUrl: string;
  }> {
    const response = await apiClient.post('/client-portals', input);
    return response;
  }

  /**
   * List client portals
   */
  async listPortals(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PortalsResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.status) searchParams.append('status', params.status);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const response = await apiClient.get(
      `/client-portals?${searchParams.toString()}`
    );
    return response;
  }

  /**
   * Get portal by ID
   */
  async getPortal(portalId: string): Promise<{ portal: ClientPortal }> {
    const response = await apiClient.get(`/client-portals/${portalId}`);
    return response;
  }

  /**
   * Update portal
   */
  async updatePortal(portalId: string, input: UpdatePortalInput): Promise<{ portal: ClientPortal }> {
    const response = await apiClient.patch(`/client-portals/${portalId}`, input);
    return response;
  }

  /**
   * Delete portal
   */
  async deletePortal(portalId: string): Promise<void> {
    await apiClient.delete(`/client-portals/${portalId}`);
  }

  /**
   * Add posts to portal
   */
  async addPostsToPortal(portalId: string, postIds: string[]): Promise<{ portal: ClientPortal }> {
    const response = await apiClient.post(`/client-portals/${portalId}/posts`, { postIds });
    return response;
  }

  /**
   * Remove post from portal
   */
  async removePostFromPortal(portalId: string, postId: string): Promise<{ portal: ClientPortal }> {
    const response = await apiClient.delete(`/client-portals/${portalId}/posts/${postId}`);
    return response;
  }

  /**
   * Regenerate portal access token
   */
  async regenerateAccessToken(portalId: string): Promise<{
    portal: ClientPortal;
    portalUrl: string;
  }> {
    const response = await apiClient.post(`/client-portals/${portalId}/regenerate-token`);
    return response;
  }

  /**
   * Get portal activity and analytics
   */
  async getPortalActivity(portalId: string): Promise<PortalActivityResponse> {
    const response = await apiClient.get(`/client-portals/${portalId}/activity`);
    return response;
  }

  // PUBLIC PORTAL METHODS (no auth required)

  /**
   * Get public portal (no auth required)
   */
  async getPublicPortal(slug: string): Promise<PublicPortalResponse> {
    const response = await fetch(`/api/public/portal/${slug}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch portal');
    }

    return response.json();
  }

  /**
   * Verify portal password (no auth required)
   */
  async verifyPortalPassword(slug: string, password: string): Promise<{ valid: boolean }> {
    const response = await fetch(`/api/public/portal/${slug}/verify-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to verify password');
    }

    return response.json();
  }

  /**
   * Approve post (no auth required)
   */
  async approvePost(slug: string, postId: string, feedback?: string): Promise<{ message: string }> {
    const response = await fetch(`/api/public/portal/${slug}/posts/${postId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ feedback }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to approve post');
    }

    return response.json();
  }

  /**
   * Reject post (no auth required)
   */
  async rejectPost(slug: string, postId: string, feedback?: string): Promise<{ message: string }> {
    const response = await fetch(`/api/public/portal/${slug}/posts/${postId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ feedback }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reject post');
    }

    return response.json();
  }

  /**
   * Comment on post (no auth required)
   */
  async commentOnPost(slug: string, postId: string, text: string): Promise<{ message: string }> {
    const response = await fetch(`/api/public/portal/${slug}/posts/${postId}/comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to add comment');
    }

    return response.json();
  }

  // LEGACY METHODS (keep for backward compatibility)

  /**
   * Create a new client review session (legacy)
   */
  async createReview(input: CreateReviewInput): Promise<{
    review: ClientReview;
    portalUrl: string;
  }> {
    const response = await apiClient.post('/client-portal/reviews', input);
    return response;
  }

  /**
   * List client reviews (legacy)
   */
  async listReviews(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ReviewsResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.status) searchParams.append('status', params.status);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const response = await apiClient.get(
      `/client-portal/reviews?${searchParams.toString()}`
    );
    return response;
  }

  /**
   * Delete a client review (legacy)
   */
  async deleteReview(reviewId: string): Promise<void> {
    await apiClient.delete(`/client-portal/reviews/${reviewId}`);
  }

  /**
   * Get client portal branding settings (legacy)
   */
  async getBranding(): Promise<{ branding: ClientPortalBranding }> {
    const response = await apiClient.get('/client-portal/branding');
    return response;
  }

  /**
   * Update client portal branding settings (legacy)
   */
  async updateBranding(input: UpdateBrandingInput): Promise<{ branding: ClientPortalBranding }> {
    const response = await apiClient.patch('/client-portal/branding', input);
    return response;
  }

  /**
   * Get public review (no auth required) (legacy)
   */
  async getPublicReview(token: string): Promise<PublicReviewResponse> {
    const response = await fetch(`/api/v1/client-portal/review/${token}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch review');
    }

    return response.json();
  }

  /**
   * Submit client feedback (no auth required) (legacy)
   */
  async submitFeedback(token: string, input: SubmitFeedbackInput): Promise<{ review: ClientReview }> {
    const response = await fetch(`/api/v1/client-portal/review/${token}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to submit feedback');
    }

    return response.json();
  }

  /**
   * Record review view (no auth required) (legacy)
   */
  async recordView(token: string): Promise<void> {
    await fetch(`/api/v1/client-portal/review/${token}/view`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

export const clientPortalService = new ClientPortalService();