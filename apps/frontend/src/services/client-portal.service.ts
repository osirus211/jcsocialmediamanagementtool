/**
 * Client Portal Service
 * 
 * API client for client review sessions and branding management
 */

import { apiClient } from '@/lib/api-client';

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
  /**
   * Create a new client review session
   */
  async createReview(input: CreateReviewInput): Promise<{
    review: ClientReview;
    portalUrl: string;
  }> {
    const response = await apiClient.post('/client-portal/reviews', input);
    return response;
  }

  /**
   * List client reviews
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
   * Delete a client review
   */
  async deleteReview(reviewId: string): Promise<void> {
    await apiClient.delete(`/client-portal/reviews/${reviewId}`);
  }

  /**
   * Get client portal branding settings
   */
  async getBranding(): Promise<{ branding: ClientPortalBranding }> {
    const response = await apiClient.get('/client-portal/branding');
    return response;
  }

  /**
   * Update client portal branding settings
   */
  async updateBranding(input: UpdateBrandingInput): Promise<{ branding: ClientPortalBranding }> {
    const response = await apiClient.patch('/client-portal/branding', input);
    return response;
  }

  /**
   * Get public review (no auth required)
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
   * Submit client feedback (no auth required)
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
   * Record review view (no auth required)
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