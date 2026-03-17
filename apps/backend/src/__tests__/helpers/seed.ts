import mongoose from 'mongoose';
import { Workspace } from '../../models/Workspace';
import { WorkspaceMember, MemberRole } from '../../models/WorkspaceMember';

export const seedWorkspace = async (workspaceId: mongoose.Types.ObjectId, memberIds: mongoose.Types.ObjectId[]) => {
  const workspace = new Workspace({
    _id: workspaceId,
    name: 'Test Workspace',
    slug: 'test-workspace',
    ownerId: memberIds[0],
    plan: 'free',
    isActive: true,
    deletedAt: null,
    settings: {
      timezone: 'UTC',
      industry: 'saas',
      requireApproval: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await workspace.save();

  // Create members
  const members = memberIds.map((userId, index) => new WorkspaceMember({
    workspaceId,
    userId,
    role: index === 0 ? MemberRole.OWNER : index === 1 ? MemberRole.ADMIN : MemberRole.MEMBER,
    isActive: true,
    joinedAt: new Date(),
  }));

  await WorkspaceMember.insertMany(members);

  return { workspace, members };
};