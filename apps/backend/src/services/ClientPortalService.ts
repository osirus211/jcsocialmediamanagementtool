/**
 * Client Portal Service
 * 
 * Manages client review sessions and white-label branding
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { ClientReview, ClientReviewStatus, IClientReview } from '../models/ClientReview';
import { Workspace, IWorkspace } from '../models/Workspace';
import { ScheduledPost } from '../models/ScheduledPost';
import { logger } from '../utils/logger';

interface CreateReviewParams {
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  postIds: mongoose.Types.ObjectId[];
  clientEmail?: string;
  clientName?: string;
  expiresInDays?: number;
  createdBy: mongoose.Types.ObjectId;
}

interface SubmitFeedbackParams {
  token: string;
  status: ClientReviewStatus;
  feedback?: string;
}

interface UpdateBrandingParams {
  workspaceId: mongoose.Types.ObjectId;
  enabled?: boolean;
  brandName?: string;
  logoUrl?: string;
  primaryColor?: string;
  customDomain?: string;
  welcomeMessage?: string;
  requirePassword?: boolean;
  portalPassword?: string;
}

export class ClientPortalService {
  /**
   * Create a new client review session
   */
  async createReview(params: CreateReviewParams): Promise<IClientReview> {
    const {
      workspaceId,
      name,
      postIds,
      clientEmail,
      clientName,
      expiresInDays = 7,
      createdBy,
    } = params;

    // Validate posts exist and belong to workspace
    const posts = await ScheduledPost.find({
      _id: { $in: postIds },
      workspaceId,
    });

    if (posts.length !== postIds.length) {
      throw new Error('Some posts not found or do not belong to workspace');
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const review = new ClientReview({
      workspaceId,
      token,
      name,
      postIds,
      clientEmail,
      clientName,
      expiresAt,
      createdBy,
    });

    await review.save();

    logger.info('Client review created', {
      reviewId: review._id,
      workspaceId,
      postCount: postIds.length,
    });

    return review;
  }

  /**
   * Get review by token (public access)
   */
  async getReview(token: string): Promise<{
    review: IClientReview;
    posts: any[];
    branding: IWorkspace['clientPortal'];
  }> {
    const review = await ClientReview.findOne({ token })
      .populate('workspaceId')
      .populate('createdBy', 'firstName lastName');

    if (!review) {
      throw new Error('Review not found');
    }

    // Check if expired
    if (review.expiresAt && review.expiresAt < new Date()) {
      throw new Error('Review has expired');
    }

    // Get posts with populated data
    const posts = await ScheduledPost.find({
      _id: { $in: review.postIds },
    }).populate('socialAccountId', 'platform username profilePicture');

    // Get workspace branding
    const workspace = review.workspaceId as unknown as IWorkspace;
    const branding = workspace.clientPortal;

    // Increment view count if first view
    if (review.status === ClientReviewStatus.PENDING) {
      review.status = ClientReviewStatus.VIEWED;
      review.viewCount += 1;
      await review.save();
    } else if (review.status === ClientReviewStatus.VIEWED) {
      review.viewCount += 1;
      await review.save();
    }

    return {
      review,
      posts,
      branding,
    };
  }

  /**
   * Submit client feedback
   */
  async submitFeedback(params: SubmitFeedbackParams): Promise<IClientReview> {
    const { token, status, feedback } = params;

    const review = await ClientReview.findOne({ token });
    if (!review) {
      throw new Error('Review not found');
    }

    // Check if expired
    if (review.expiresAt && review.expiresAt < new Date()) {
      throw new Error('Review has expired');
    }

    // Update review
    review.status = status;
    review.clientFeedback = feedback;
    await review.save();

    logger.info('Client feedback submitted', {
      reviewId: review._id,
      status,
      hasFeedback: !!feedback,
    });

    return review;
  }

  /**
   * List reviews for workspace
   */
  async listReviews(params: {
    workspaceId: mongoose.Types.ObjectId;
    status?: ClientReviewStatus;
    page?: number;
    limit?: number;
  }): Promise<{
    reviews: IClientReview[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { workspaceId, status, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const filter: any = { workspaceId };
    if (status) {
      filter.status = status;
    }

    const [reviews, total] = await Promise.all([
      ClientReview.find(filter)
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ClientReview.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      reviews,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Delete review
   */
  async deleteReview(params: {
    reviewId: mongoose.Types.ObjectId;
    workspaceId: mongoose.Types.ObjectId;
  }): Promise<void> {
    const { reviewId, workspaceId } = params;

    const result = await ClientReview.deleteOne({
      _id: reviewId,
      workspaceId,
    });

    if (result.deletedCount === 0) {
      throw new Error('Review not found');
    }

    logger.info('Client review deleted', { reviewId, workspaceId });
  }

  /**
   * Update workspace branding
   */
  async updateBranding(params: UpdateBrandingParams): Promise<IWorkspace> {
    const { workspaceId, portalPassword, ...updates } = params;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Hash password if provided
    if (portalPassword) {
      const hashedPassword = await bcrypt.hash(portalPassword, 10);
      (updates as any).portalPassword = hashedPassword;
    }

    // Update branding settings
    Object.assign(workspace.clientPortal, updates);
    await workspace.save();

    logger.info('Client portal branding updated', {
      workspaceId,
      enabled: workspace.clientPortal.enabled,
    });

    return workspace;
  }

  /**
   * Get portal URL for review
   */
  getPortalUrl(token: string, customDomain?: string): string {
    const baseUrl = customDomain 
      ? `https://${customDomain}` 
      : process.env.FRONTEND_URL || 'http://localhost:3000';
    
    return `${baseUrl}/review/${token}`;
  }

  /**
   * Verify portal password
   */
  async verifyPortalPassword(
    workspaceId: mongoose.Types.ObjectId,
    password: string
  ): Promise<boolean> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace || !workspace.clientPortal.requirePassword || !workspace.clientPortal.portalPassword) {
      return true; // No password required
    }

    return bcrypt.compare(password, workspace.clientPortal.portalPassword);
  }
}