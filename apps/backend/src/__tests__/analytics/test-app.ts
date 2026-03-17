import express from 'express';
import { UserRole } from '../../models/User';
import { MemberRole } from '../../models/WorkspaceMember';
import mongoose from 'mongoose';

// Create a simplified version of analytics routes for testing
const testApp = express();

testApp.use(express.json());

// Mock auth middleware
testApp.use((req, res, next) => {
  req.user = {
    userId: Array.isArray(req.headers['x-user-id']) ? req.headers['x-user-id'][0] : (req.headers['x-user-id'] || 'test-user-id'),
    email: 'test@example.com',
    role: UserRole.OWNER
  };
  next();
});

// Mock workspace middleware
testApp.use((req, res, next) => {
  const workspaceId = req.query.workspaceId || req.body.workspaceId;
  if (workspaceId) {
    req.workspace = {
      workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
      role: MemberRole.OWNER,
      memberId: new mongoose.Types.ObjectId()
    };
  }
  next();
});

// Simple test route that mimics the analytics summary endpoint
testApp.get('/v1/analytics/summary', async (req, res): Promise<any> => {
  try {
    // Simple validation
    const { startDate, endDate, workspaceId } = req.query;
    if (!startDate || !endDate || !workspaceId) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }

    // Mock response structure
    const summary = {
      reach: { current: 1000, previous: 800, percentageChange: 25.0 },
      engagement: { current: 100, previous: 80, percentageChange: 25.0 },
      followerGrowth: { current: 50, previous: 40, percentageChange: 25.0 },
      postsPublished: { current: 5, previous: 4, percentageChange: 25.0 }
    };
    
    res.json({ success: true, data: summary });
  } catch (error) {
    return res.status(400).json({ success: false, error: (error as Error).message });
  }
});

export default testApp;