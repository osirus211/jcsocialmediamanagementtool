// Workspace types matching backend models

export enum WorkspacePlan {
  FREE = 'free',
  PRO = 'pro',
  TEAM = 'team',
  ENTERPRISE = 'enterprise',
}

export enum WorkspaceRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

export enum MemberStatus {
  ACTIVE = 'active',
  INVITED = 'invited',
  REMOVED = 'removed',
}

export interface WorkspaceSettings {
  allowMemberInvites?: boolean;
  requireEmailVerification?: boolean;
  defaultMemberRole?: string;
  [key: string]: any;
}

export interface Workspace {
  _id: string;
  name: string;
  slug: string;
  ownerId: string | User;
  membersCount: number;
  plan: WorkspacePlan;
  settings: WorkspaceSettings;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  userRole?: WorkspaceRole; // User's role in this workspace
}

export interface WorkspaceMember {
  _id: string;
  workspaceId: string;
  userId: string | User;
  role: WorkspaceRole;
  status: MemberStatus;
  invitedBy?: string | User;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  slug?: string;
  settings?: WorkspaceSettings;
}

export interface InviteMemberInput {
  email: string;
  role: WorkspaceRole;
}

export interface UpdateMemberRoleInput {
  role: WorkspaceRole;
}

export interface TransferOwnershipInput {
  newOwnerId: string;
}

// API Response types
export interface WorkspacesResponse {
  workspaces: Workspace[];
  count: number;
}

export interface WorkspaceResponse {
  workspace: Workspace;
}

export interface MembersResponse {
  members: WorkspaceMember[];
  count: number;
}

export interface MembershipResponse {
  membership: WorkspaceMember;
}
