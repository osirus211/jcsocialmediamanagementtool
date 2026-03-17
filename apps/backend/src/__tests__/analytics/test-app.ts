import express from 'express';

// Create a simplified version of analytics routes for testing
const testApp = express();

testApp.use(express.json());

// Mock auth middleware
testApp.use((req, res, next) => {
  req.user = {
    userId: req.headers['x-user-id'] || 'test-user-id',
    email: 'test@example.com',
    role: 'owner'
  };
  next();
});

// Mock workspace middleware
testApp.use((req, res, next) => {
  const workspaceId = req.query.workspaceId || req.body.workspaceId;
  if (workspaceId) {
    req.workspace = {
      workspaceId: workspaceId,
      role: 'owner'
    };
  }
  next();
});

// Simple test route that mimics the analytics summary endpoint
testApp.get('/v1/analytics/summary', async (req, res) => {
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
    res.status(400).json({ success: false, error: error.message });
  }
});

export default testApp;