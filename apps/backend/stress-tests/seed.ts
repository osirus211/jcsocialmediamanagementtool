import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

// Import your models - adjust paths as needed
// You'll need to update these imports based on your actual model locations
interface User {
  _id?: string;
  email: string;
  password: string;
  name: string;
  isVerified: boolean;
  createdAt: Date;
}

interface Workspace {
  _id?: string;
  name: string;
  slug: string;
  ownerId: string;
  plan: string;
  memberLimit: number;
  createdAt: Date;
}

interface Member {
  _id?: string;
  workspaceId: string;
  userId: string;
  role: string;
  joinedAt: Date;
}

interface Post {
  _id?: string;
  userId: string;
  workspaceId: string;
  content: string;
  status: string;
  createdAt: Date;
}

export interface SeedData {
  userId: string;
  workspaceId: string;
  memberIds: string[];
  roleUserIds: string[];
  heavyMemberId: string;
  token: string;
}

export async function seedStressTestData(): Promise<SeedData> {
  console.log('🌱 Seeding stress test data...');
  
  // Connect to stress test database ONLY
  const STRESS_DB = 'jcsocial_stress_test';
  await mongoose.connect(`mongodb://localhost:27017/${STRESS_DB}`);
  console.log(`✅ Connected to database: ${STRESS_DB}`);

  // Get collections
  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');
  const workspacesCollection = db.collection('workspaces');
  const membersCollection = db.collection('members');
  const postsCollection = db.collection('posts');

  // 1. Create stress_test_user
  const hashedPassword = await bcrypt.hash('stress_test_password', 10);
  const user: User = {
    email: 'stress_test_user@jcstress.local',
    password: hashedPassword,
    name: 'stress_test_user',
    isVerified: true,
    createdAt: new Date()
  };
  
  const userResult = await usersCollection.insertOne(user);
  const userId = userResult.insertedId.toString();
  console.log(`✅ Created stress_test_user: ${userId}`);

  // 2. Create stress_test_workspace
  const workspace: Workspace = {
    name: 'stress_test_workspace',
    slug: 'stress_test_workspace',
    ownerId: userId,
    plan: 'FREE',
    memberLimit: 5,
    createdAt: new Date()
  };
  
  const workspaceResult = await workspacesCollection.insertOne(workspace);
  const workspaceId = workspaceResult.insertedId.toString();
  console.log(`✅ Created stress_test_workspace: ${workspaceId}`);

  // 3. Create 500 stress_test_members for pagination test
  const members: Member[] = [];
  const memberIds: string[] = [];
  
  for (let i = 0; i < 500; i++) {
    // Create user for this member
    const memberUser: User = {
      email: `stress_test_member_${i}@jcstress.local`,
      password: hashedPassword,
      name: `stress_test_member_${i}`,
      isVerified: true,
      createdAt: new Date()
    };
    
    const memberUserResult = await usersCollection.insertOne(memberUser);
    const memberUserId = memberUserResult.insertedId.toString();
    
    const member: Member = {
      workspaceId: workspaceId,
      userId: memberUserId,
      role: 'member',
      joinedAt: new Date()
    };
    
    members.push(member);
    memberIds.push(memberUserId);
  }
  
  await membersCollection.insertMany(members);
  console.log(`✅ Created 500 stress_test_members`);

  // 4. Create 5 stress_test_role_users (one per role)
  const roles = ['owner', 'admin', 'editor', 'viewer', 'member'];
  const roleUserIds: string[] = [];
  
  for (const role of roles) {
    const roleUser: User = {
      email: `stress_test_${role}@jcstress.local`,
      password: hashedPassword,
      name: `stress_test_${role}`,
      isVerified: true,
      createdAt: new Date()
    };
    
    const roleUserResult = await usersCollection.insertOne(roleUser);
    const roleUserId = roleUserResult.insertedId.toString();
    roleUserIds.push(roleUserId);
    
    const roleMember: Member = {
      workspaceId: workspaceId,
      userId: roleUserId,
      role: role,
      joinedAt: new Date()
    };
    
    await membersCollection.insertOne(roleMember);
    console.log(`✅ Created stress_test_${role}_user: ${roleUserId}`);
  }

  // 5. Create stress_test_heavy_member with 1000 posts
  const heavyUser: User = {
    email: 'stress_test_heavy@jcstress.local',
    password: hashedPassword,
    name: 'stress_test_heavy_member',
    isVerified: true,
    createdAt: new Date()
  };
  
  const heavyUserResult = await usersCollection.insertOne(heavyUser);
  const heavyMemberId = heavyUserResult.insertedId.toString();
  
  const heavyMember: Member = {
    workspaceId: workspaceId,
    userId: heavyMemberId,
    role: 'member',
    joinedAt: new Date()
  };
  
  await membersCollection.insertOne(heavyMember);
  
  // Create 1000 posts for heavy member
  const posts: Post[] = [];
  for (let i = 0; i < 1000; i++) {
    posts.push({
      userId: heavyMemberId,
      workspaceId: workspaceId,
      content: `stress_test_post_${i}`,
      status: 'published',
      createdAt: new Date()
    });
  }
  
  await postsCollection.insertMany(posts);
  console.log(`✅ Created stress_test_heavy_member with 1000 posts: ${heavyMemberId}`);

  // 6. Generate JWT token for stress_test_user
  const JWT_SECRET = process.env.JWT_SECRET || 'stress_test_secret';
  const token = jwt.sign(
    { userId: userId, email: user.email },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  console.log(`✅ Generated JWT token for stress_test_user`);

  console.log('🎉 Stress test data seeding complete!');
  
  return {
    userId,
    workspaceId,
    memberIds,
    roleUserIds,
    heavyMemberId,
    token
  };
}