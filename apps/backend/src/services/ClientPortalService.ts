/**
 * Client Portal Service
 * 
 * Manages client approval portals and white-label branding
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { 
  ClientPortal, 
  ClientReview, 
  ClientReviewStatus, 
  ClientPortalStatus,
  PostApprovalStatus,
  IClientPortal, 
  IClientReview,
  PostApproval,
  PostComment
} from '../models/ClientReview';
import { Workspace, IWorkspace } from '../models/Workspace';
import { ScheduledPost } from '../models/ScheduledPost';
import { logger } from '../utils/logger';

// Generate URL-safe slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 50);
}

// Generate secure access token
function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

interface CreatePortalParams {
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  clientEmail: string;
  clientName: string;
  clientCompany?: string;
  postIds: mongoose.Types.ObjectId[];
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
  createdBy: mongoose.Types.ObjectId;
}

interface UpdatePortalParams {
  portalId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
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
  expiresAt?: Date;
  passwordProtected?: boolean;
  password?: string;
  notifyOnAction?: boolean;
  status?: ClientPortalStatus;
}

interface ApprovePostParams {
  slug: string;
  postId: mongoose.Types.ObjectId;
  status: PostApprovalStatus;
  feedback?: string;
}

interface CommentOnPostParams {
  slug: string;
  postId: mongoose.Types.ObjectId;
  text: string;
  clientEmail: string;
}

// Legacy interfaces for backward compatibility
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
   * Create a new client portal
   */
  async createPortal(params: CreatePortalParams): Promise<IClientPortal> {
    const {
      workspaceId,
      name,
      clientEmail,
      clientName,
      clientCompany,
      postIds,
      allowedActions = { view: true, approve: true, reject: true, comment: true },
      branding,
      expiresInDays = 7,
      passwordProtected = false,
      password,
      notifyOnAction = true,
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

    // Generate unique slug
    let baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;
    
    while (await ClientPortal.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Generate access token
    const accessToken = generateAccessToken();

    // Set expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Hash password if provided
    let passwordHash: string | undefined;
    if (passwordProtected && password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Get workspace for default branding
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const defaultBranding = {
      primaryColor: '#3B82F6',
      accentColor: '#10B981',
      companyName: workspace.name,
      ...branding,
    };

    // Initialize post approvals
    const postApprovals: PostApproval[] = postIds.map(postId => ({
      postId,
      status: PostApprovalStatus.PENDING,
    }));

    const portal = new ClientPortal({
      workspaceId,
      name,
      slug,
      clientEmail,
      clientName,
      clientCompany,
      accessToken,
      allowedActions,
      branding: defaultBranding,
      posts: postIds,
      postApprovals,
      comments: [],
      expiresAt,
      passwordProtected,
      passwordHash,
      notifyOnAction,
      createdBy,
    });

    await portal.save();

    logger.info('Client portal created', {
      portalId: portal._id,
      slug: portal.slug,
      workspaceId,
      postCount: postIds.length,
    });

    return portal;
  }

  /**
   * Get portal by slug (public access)
   */
  async getPortalBySlug(slug: string): Promise<{
    portal: IClientPortal;
    posts: any[];
  }> {
    const portal = await ClientPortal.findOne({ slug })
      .populate('workspaceId')
      .populate('createdBy', 'firstName lastName');

    if (!portal) {
      throw new Error('Portal not found');
    }

    // Check if expired
    if (portal.expiresAt && portal.expiresAt < new Date()) {
      portal.status = ClientPortalStatus.EXPIRED;
      await portal.save();
      throw new Error('Portal has expired');
    }

    // Check if token is expired
    if (portal.tokenExpiresAt && portal.tokenExpiresAt < new Date()) {
      throw new Error('Portal access token has expired');
    }

    // Check if active
    if (portal.status !== ClientPortalStatus.ACTIVE) {
      throw new Error('Portal is not active');
    }

    // Get posts with populated data
    const posts = await ScheduledPost.find({
      _id: { $in: portal.posts },
    }).populate('socialAccountId', 'platform username profilePicture');

    // Update access tracking
    portal.lastAccessedAt = new Date();
    portal.accessCount += 1;
    await portal.save();

    return {
      portal,
      posts,
    };
  }

  /**
   * Get portal by ID (admin access)
   */
  async getPortalById(
    portalId: mongoose.Types.ObjectId,
    workspaceId: mongoose.Types.ObjectId
  ): Promise<IClientPortal> {
    const portal = await ClientPortal.findOne({
      _id: portalId,
      workspaceId,
    }).populate('createdBy', 'firstName lastName');

    if (!portal) {
      throw new Error('Portal not found');
    }

    return portal;
  }

  /**
   * List portals for workspace
   */
  async getWorkspacePortals(params: {
    workspaceId: mongoose.Types.ObjectId;
    status?: ClientPortalStatus;
    page?: number;
    limit?: number;
  }): Promise<{
    portals: IClientPortal[];
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

    const [portals, total] = await Promise.all([
      ClientPortal.find(filter)
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ClientPortal.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      portals,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Update portal
   */
  async updatePortal(params: UpdatePortalParams): Promise<IClientPortal> {
    const { portalId, workspaceId, password, ...updates } = params;

    const portal = await ClientPortal.findOne({
      _id: portalId,
      workspaceId,
    });

    if (!portal) {
      throw new Error('Portal not found');
    }

    // Hash password if provided
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      (updates as any).passwordHash = passwordHash;
    }

    // Update portal
    Object.assign(portal, updates);
    await portal.save();

    logger.info('Client portal updated', {
      portalId,
      workspaceId,
    });

    return portal;
  }

  /**
   * Delete portal
   */
  async deletePortal(params: {
    portalId: mongoose.Types.ObjectId;
    workspaceId: mongoose.Types.ObjectId;
  }): Promise<void> {
    const { portalId, workspaceId } = params;

    const result = await ClientPortal.deleteOne({
      _id: portalId,
      workspaceId,
    });

    if (result.deletedCount === 0) {
      throw new Error('Portal not found');
    }

    logger.info('Client portal deleted', { portalId, workspaceId });
  }

  /**
   * Add posts to portal
   */
  async addPostsToPortal(
    portalId: mongoose.Types.ObjectId,
    workspaceId: mongoose.Types.ObjectId,
    postIds: mongoose.Types.ObjectId[]
  ): Promise<IClientPortal> {
    const portal = await ClientPortal.findOne({
      _id: portalId,
      workspaceId,
    });

    if (!portal) {
      throw new Error('Portal not found');
    }

    // Validate posts exist and belong to workspace
    const posts = await ScheduledPost.find({
      _id: { $in: postIds },
      workspaceId,
    });

    if (posts.length !== postIds.length) {
      throw new Error('Some posts not found or do not belong to workspace');
    }

    // Add new posts (avoid duplicates)
    const newPostIds = postIds.filter(id => !portal.posts.includes(id));
    portal.posts.push(...newPostIds);

    // Add approval entries for new posts
    const newApprovals: PostApproval[] = newPostIds.map(postId => ({
      postId,
      status: PostApprovalStatus.PENDING,
    }));
    portal.postApprovals.push(...newApprovals);

    await portal.save();

    logger.info('Posts added to portal', {
      portalId,
      newPostCount: newPostIds.length,
    });

    return portal;
  }

  /**
   * Remove post from portal
   */
  async removePostFromPortal(
    portalId: mongoose.Types.ObjectId,
    workspaceId: mongoose.Types.ObjectId,
    postId: mongoose.Types.ObjectId
  ): Promise<IClientPortal> {
    const portal = await ClientPortal.findOne({
      _id: portalId,
      workspaceId,
    });

    if (!portal) {
      throw new Error('Portal not found');
    }

    // Remove post
    portal.posts = portal.posts.filter(id => !id.equals(postId));
    
    // Remove approval entry
    portal.postApprovals = portal.postApprovals.filter(
      approval => !approval.postId.equals(postId)
    );

    // Remove comments
    portal.comments = portal.comments.filter(
      comment => !comment.postId.equals(postId)
    );

    await portal.save();

    logger.info('Post removed from portal', { portalId, postId });

    return portal;
  }

  /**
   * Client approve/reject post
   */
  async clientApprovePost(params: ApprovePostParams): Promise<IClientPortal> {
    const { slug, postId, status, feedback } = params;

    const portal = await ClientPortal.findOne({ slug });
    if (!portal) {
      throw new Error('Portal not found');
    }

    // Check if expired or inactive
    if (portal.expiresAt && portal.expiresAt < new Date()) {
      throw new Error('Portal has expired');
    }

    if (portal.status !== ClientPortalStatus.ACTIVE) {
      throw new Error('Portal is not active');
    }

    // Check if post exists in portal
    if (!portal.posts.includes(postId)) {
      throw new Error('Post not found in portal');
    }

    // Check permissions
    if (status === PostApprovalStatus.APPROVED && !portal.allowedActions.approve) {
      throw new Error('Approval not allowed');
    }
    if (status === PostApprovalStatus.REJECTED && !portal.allowedActions.reject) {
      throw new Error('Rejection not allowed');
    }

    // Update approval status
    const approvalIndex = portal.postApprovals.findIndex(
      approval => approval.postId.equals(postId)
    );

    if (approvalIndex >= 0) {
      portal.postApprovals[approvalIndex].status = status;
      portal.postApprovals[approvalIndex].feedback = feedback;
      if (status === PostApprovalStatus.APPROVED) {
        portal.postApprovals[approvalIndex].approvedAt = new Date();
      }
    } else {
      // Create new approval entry
      portal.postApprovals.push({
        postId,
        status,
        feedback,
        approvedAt: status === PostApprovalStatus.APPROVED ? new Date() : undefined,
      });
    }

    await portal.save();

    logger.info('Client post approval', {
      portalId: portal._id,
      postId,
      status,
      hasFeedback: !!feedback,
    });

    return portal;
  }

  /**
   * Client comment on post
   */
  async clientCommentOnPost(params: CommentOnPostParams): Promise<IClientPortal> {
    const { slug, postId, text, clientEmail } = params;

    const portal = await ClientPortal.findOne({ slug });
    if (!portal) {
      throw new Error('Portal not found');
    }

    // Check if expired or inactive
    if (portal.expiresAt && portal.expiresAt < new Date()) {
      throw new Error('Portal has expired');
    }

    if (portal.status !== ClientPortalStatus.ACTIVE) {
      throw new Error('Portal is not active');
    }

    // Check if post exists in portal
    if (!portal.posts.includes(postId)) {
      throw new Error('Post not found in portal');
    }

    // Check permissions
    if (!portal.allowedActions.comment) {
      throw new Error('Comments not allowed');
    }

    // Add comment
    const comment: PostComment = {
      postId,
      text,
      clientEmail,
      createdAt: new Date(),
    };

    portal.comments.push(comment);
    await portal.save();

    logger.info('Client comment added', {
      portalId: portal._id,
      postId,
      clientEmail,
    });

    return portal;
  }

  /**
   * Validate portal access (password check)
   */
  async validatePortalAccess(slug: string, password?: string): Promise<boolean> {
    const portal = await ClientPortal.findOne({ slug });
    if (!portal) {
      throw new Error('Portal not found');
    }

    if (!portal.passwordProtected) {
      return true;
    }

    if (!password || !portal.passwordHash) {
      return false;
    }

    return bcrypt.compare(password, portal.passwordHash);
  }

  /**
   * Get portal activity/analytics
   */
  async getPortalActivity(
    portalId: mongoose.Types.ObjectId,
    workspaceId: mongoose.Types.ObjectId
  ): Promise<{
    portal: IClientPortal;
    stats: {
      totalPosts: number;
      approvedPosts: number;
      rejectedPosts: number;
      pendingPosts: number;
      totalComments: number;
      completionRate: number;
    };
  }> {
    const portal = await ClientPortal.findOne({
      _id: portalId,
      workspaceId,
    });

    if (!portal) {
      throw new Error('Portal not found');
    }

    const totalPosts = portal.posts.length;
    const approvedPosts = portal.postApprovals.filter(
      a => a.status === PostApprovalStatus.APPROVED
    ).length;
    const rejectedPosts = portal.postApprovals.filter(
      a => a.status === PostApprovalStatus.REJECTED
    ).length;
    const pendingPosts = totalPosts - approvedPosts - rejectedPosts;
    const totalComments = portal.comments.length;
    const completionRate = totalPosts > 0 ? ((approvedPosts + rejectedPosts) / totalPosts) * 100 : 0;

    return {
      portal,
      stats: {
        totalPosts,
        approvedPosts,
        rejectedPosts,
        pendingPosts,
        totalComments,
        completionRate,
      },
    };
  }

  /**
   * Regenerate access token
   */
  async regenerateAccessToken(
    portalId: mongoose.Types.ObjectId,
    workspaceId: mongoose.Types.ObjectId
  ): Promise<IClientPortal> {
    const portal = await ClientPortal.findOne({
      _id: portalId,
      workspaceId,
    });

    if (!portal) {
      throw new Error('Portal not found');
    }

    portal.accessToken = generateAccessToken();
    // Reset token expiry to 30 days from now
    portal.tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await portal.save();

    logger.info('Portal access token regenerated', { portalId });

    return portal;
  }

  /**
   * Get portal URL
   */
  getPortalUrl(slug: string, customDomain?: string): string {
    const baseUrl = customDomain 
      ? `https://${customDomain}` 
      : process.env.FRONTEND_URL || 'http://localhost:3000';
    
    return `${baseUrl}/portal/${slug}`;
  }

  // LEGACY METHODS FOR BACKWARD COMPATIBILITY

  /**
   * Create a new client review session (legacy)
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
   * Get review by token (public access) (legacy)
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
   * Submit client feedback (legacy)
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
   * List reviews for workspace (legacy)
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
   * Delete review (legacy)
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
   * Update workspace branding (legacy)
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
   * Verify portal password (legacy)
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