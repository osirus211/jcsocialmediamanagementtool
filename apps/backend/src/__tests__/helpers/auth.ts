import jwt from 'jsonwebtoken';

export const generateTestToken = (userId: string, workspaceId: string): string => {
  return jwt.sign(
    { 
      userId, 
      workspaceId,
      workspace: { workspaceId }
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};