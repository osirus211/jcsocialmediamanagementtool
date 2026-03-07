/**
 * RBAC Validation Test Suite
 * 
 * Validates Role-Based Access Control (RBAC) enforcement across:
 * 1. Post ownership validation (schedule/cancel/retry)
 * 2. Cross-user post manipulation prevention
 * 3. Cross-workspace post access prevention
 * 4. Workspace role enforcement
 * 5. RBAC middleware consistency
 * 
 * CRITICAL: These tests validate security boundaries that prevent
 * unauthorized post manipulation and data breaches.
 */

import mongoose from 'mongoose';
import { Post, PostStatus } from '../../models/Post';
import { Workspace } from '../../models/Workspace';
import { WorkspaceMember, WorkspaceRole, MemberStatus } from '../../models/WorkspaceMember';
import { User } from '../../models/User';
import { SocialAccount } from '../../models/SocialAccount';
import { permissionService } from '../../services/PermissionService';
import { postService } from '../../services/PostService';

describe('RBAC Validation Suite', () => {
  let workspace1: any;
  let workspace2: any;
  let owner1: any;
  let member1: any;
  let admin1: any;
  let viewer1: any;
  let owner2: any;
  let socialAccount1: any;
  let socialAccount2: any;

  beforeEach(async () => {
    // Create test users
    owner1 = await User.create({
      email: 'owner1@test.com',
      password: 'password123',
      firstName: 'Owner',
      lastName: 'One',
    });

    member1 = await User.create({
      email: 'member1@test.com',
      password: 'password123',
      firstName: 'Member',
      lastName: 'One',
    });

    admin1 = await User.create({
      email: 'admin1@test.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'One',
    });

    viewer1 = await User.create({
      email: 'viewer1@test.com',
      password: 'password123',
      firstName: 'Viewer',
      lastName: 'One',
    });

    owner2 = await User.create({
      email: 'owner2@test.com',
      password: 'password123',
      firstName: 'Owner',
      lastName: 'Two',
    });

    // Create workspace 1
    workspace1 = await Workspace.create({
      name: 'Workspace 1',
      slug: 'workspace-1',
      ownerId: owner1._id,
      membersCount: 4,
    });

    // Create workspace 2
    workspace2 = await Workspace.create({
      name: 'Workspace 2',
      slug: 'workspace-2',
      ownerId: owner2._id,
      membersCount: 1,
    });

    // Create memberships for workspace 1
    await WorkspaceMember.create({
      workspaceId: workspace1._id,
      userId: owner1._id,
      role: WorkspaceRole.OWNER,
      status: MemberStatus.ACTIVE,
    });

    await WorkspaceMember.create({
      workspaceId: workspace1._id,
      userId: member1._id,
      role: WorkspaceRole.MEMBER,
      status: MemberStatus.ACTIVE,
    });

    await WorkspaceMember.create({
      workspaceId: workspace1._id,
      userId: admin1._id,
      role: WorkspaceRole.ADMIN,
      status: MemberStatus.ACTIVE,
    });

    await WorkspaceMember.create({
      workspaceId: workspace1._id,
      userId: viewer1._id,
      role: WorkspaceRole.VIEWER,
      status: MemberStatus.ACTIVE,
    });

    // Create membership for workspace 2
    await WorkspaceMember.create({
      workspaceId: workspace2._id,
      userId: owner2._id,
      role: WorkspaceRole.OWNER,
      status: MemberStatus.ACTIVE,
    });

    // Create social accounts
    socialAccount1 = await SocialAccount.create({
      workspaceId: workspace1._id,
      provider: 'twitter',
      accountName: 'test_account_1',
      accountId: 'twitter_123',
      accessToken: 'token123',
      refreshToken: 'refresh123',
    });

    socialAccount2 = await SocialAccount.create({
      workspaceId: workspace2._id,
      provider: 'twitter',
      accountName: 'test_account_2',
      accountId: 'twitter_456',
      accessToken: 'token456',
      refreshToken: 'refresh456',
    });
  });

  afterEach(async () => {
    await Post.deleteMany({});
    await WorkspaceMember.deleteMany({});
    await Workspace.deleteMany({});
    await User.deleteMany({});
    await SocialAccount.deleteMany({});
  });

  describe('1. Post Ownership Validation', () => {
    it('should allow post owner to schedule their own post', async () => {
      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.DRAFT,
        createdBy: member1._id,
      });

      const hasAccess = await permissionService.canAccessPost(
        member1._id.toString(),
        post._id.toString()
      );

      expect(hasAccess).toBe(true);
    });

    it('should allow workspace admin to schedule any post', async () => {
      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.DRAFT,
        createdBy: member1._id,
      });

      const hasAccess = await permissionService.canAccessPost(
        admin1._id.toString(),
        post._id.toString()
      );

      expect(hasAccess).toBe(true);
    });

    it('should allow workspace owner to schedule any post', async () => {
      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.DRAFT,
        createdBy: member1._id,
      });

      const hasAccess = await permissionService.canAccessPost(
        owner1._id.toString(),
        post._id.toString()
      );

      expect(hasAccess).toBe(true);
    });

    it('should deny viewer from scheduling any post', async () => {
      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.DRAFT,
        createdBy: member1._id,
      });

      const hasAccess = await permissionService.canAccessPost(
        viewer1._id.toString(),
        post._id.toString()
      );

      expect(hasAccess).toBe(false);
    });
  });

  describe('2. Cross-User Post Manipulation Prevention', () => {
    it('should deny member from scheduling another member\'s post', async () => {
      const otherMember = await User.create({
        email: 'member2@test.com',
        password: 'password123',
        firstName: 'Member',
        lastName: 'Two',
      });

      await WorkspaceMember.create({
        workspaceId: workspace1._id,
        userId: otherMember._id,
        role: WorkspaceRole.MEMBER,
        status: MemberStatus.ACTIVE,
      });

      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.DRAFT,
        createdBy: member1._id,
      });

      const hasAccess = await permissionService.canAccessPost(
        otherMember._id.toString(),
        post._id.toString()
      );

      expect(hasAccess).toBe(false);
    });

    it('should deny member from canceling another member\'s scheduled post', async () => {
      const otherMember = await User.create({
        email: 'member3@test.com',
        password: 'password123',
        firstName: 'Member',
        lastName: 'Three',
      });

      await WorkspaceMember.create({
        workspaceId: workspace1._id,
        userId: otherMember._id,
        role: WorkspaceRole.MEMBER,
        status: MemberStatus.ACTIVE,
      });

      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() + 3600000),
        createdBy: member1._id,
      });

      const hasAccess = await permissionService.canAccessPost(
        otherMember._id.toString(),
        post._id.toString()
      );

      expect(hasAccess).toBe(false);
    });

    it('should deny member from retrying another member\'s failed post', async () => {
      const otherMember = await User.create({
        email: 'member4@test.com',
        password: 'password123',
        firstName: 'Member',
        lastName: 'Four',
      });

      await WorkspaceMember.create({
        workspaceId: workspace1._id,
        userId: otherMember._id,
        role: WorkspaceRole.MEMBER,
        status: MemberStatus.ACTIVE,
      });

      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.FAILED,
        errorMessage: 'Test error',
        createdBy: member1._id,
      });

      const hasAccess = await permissionService.canAccessPost(
        otherMember._id.toString(),
        post._id.toString()
      );

      expect(hasAccess).toBe(false);
    });
  });

  describe('3. Cross-Workspace Post Access Prevention', () => {
    it('should deny access to post from different workspace', async () => {
      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.DRAFT,
        createdBy: member1._id,
      });

      const hasAccess = await permissionService.canAccessPost(
        owner2._id.toString(),
        post._id.toString()
      );

      expect(hasAccess).toBe(false);
    });

    it('should prevent scheduling post from different workspace', async () => {
      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.DRAFT,
        createdBy: member1._id,
      });

      // Attempt to schedule from workspace 2
      await expect(
        postService.schedulePost(
          post._id.toString(),
          workspace2._id.toString(),
          new Date(Date.now() + 3600000)
        )
      ).rejects.toThrow('Post not found');
    });

    it('should prevent canceling post from different workspace', async () => {
      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() + 3600000),
        createdBy: member1._id,
      });

      // Attempt to cancel from workspace 2
      await expect(
        postService.cancelScheduledPost(
          post._id.toString(),
          workspace2._id.toString()
        )
      ).rejects.toThrow('Post not found');
    });

    it('should prevent retrying post from different workspace', async () => {
      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.FAILED,
        errorMessage: 'Test error',
        createdBy: member1._id,
      });

      // Attempt to retry from workspace 2
      await expect(
        postService.retryFailedPost(
          post._id.toString(),
          workspace2._id.toString()
        )
      ).rejects.toThrow('Post not found');
    });
  });

  describe('4. Workspace Role Enforcement', () => {
    it('should validate workspace owner permissions', async () => {
      const isOwner = await permissionService.isWorkspaceOwner(
        owner1._id.toString(),
        workspace1._id.toString()
      );

      expect(isOwner).toBe(true);
    });

    it('should validate workspace admin permissions', async () => {
      const isAdminOrOwner = await permissionService.isAdminOrOwner(
        admin1._id.toString(),
        workspace1._id.toString()
      );

      expect(isAdminOrOwner).toBe(true);
    });

    it('should deny member from having admin permissions', async () => {
      const isAdminOrOwner = await permissionService.isAdminOrOwner(
        member1._id.toString(),
        workspace1._id.toString()
      );

      expect(isAdminOrOwner).toBe(false);
    });

    it('should deny viewer from having admin permissions', async () => {
      const isAdminOrOwner = await permissionService.isAdminOrOwner(
        viewer1._id.toString(),
        workspace1._id.toString()
      );

      expect(isAdminOrOwner).toBe(false);
    });

    it('should deny non-member from having any permissions', async () => {
      const nonMember = await User.create({
        email: 'nonmember@test.com',
        password: 'password123',
        firstName: 'Non',
        lastName: 'Member',
      });

      const isAdminOrOwner = await permissionService.isAdminOrOwner(
        nonMember._id.toString(),
        workspace1._id.toString()
      );

      expect(isAdminOrOwner).toBe(false);
    });
  });

  describe('5. RBAC Middleware Consistency', () => {
    it('should validate post access for post owner', async () => {
      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.DRAFT,
        createdBy: member1._id,
      });

      const hasAccess = await permissionService.canAccessPost(
        member1._id.toString(),
        post._id.toString()
      );

      expect(hasAccess).toBe(true);
    });

    it('should validate post access for workspace admin', async () => {
      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.DRAFT,
        createdBy: member1._id,
      });

      const hasAccess = await permissionService.canAccessPost(
        admin1._id.toString(),
        post._id.toString()
      );

      expect(hasAccess).toBe(true);
    });

    it('should deny post access for non-owner member', async () => {
      const otherMember = await User.create({
        email: 'member5@test.com',
        password: 'password123',
        firstName: 'Member',
        lastName: 'Five',
      });

      await WorkspaceMember.create({
        workspaceId: workspace1._id,
        userId: otherMember._id,
        role: WorkspaceRole.MEMBER,
        status: MemberStatus.ACTIVE,
      });

      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.DRAFT,
        createdBy: member1._id,
      });

      const hasAccess = await permissionService.canAccessPost(
        otherMember._id.toString(),
        post._id.toString()
      );

      expect(hasAccess).toBe(false);
    });

    it('should deny post access for user from different workspace', async () => {
      const post = await Post.create({
        workspaceId: workspace1._id,
        socialAccountId: socialAccount1._id,
        content: 'Test post',
        status: PostStatus.DRAFT,
        createdBy: member1._id,
      });

      const hasAccess = await permissionService.canAccessPost(
        owner2._id.toString(),
        post._id.toString()
      );

      expect(hasAccess).toBe(false);
    });

    it('should handle non-existent post gracefully', async () => {
      const fakePostId = new mongoose.Types.ObjectId().toString();

      const hasAccess = await permissionService.canAccessPost(
        member1._id.toString(),
        fakePostId
      );

      expect(hasAccess).toBe(false);
    });
  });
});
