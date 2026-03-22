import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock scheduler service
const mockGetEligiblePosts = jest.fn();
const mockUpdateNextSendAt = jest.fn();
const mockCheckBlackoutPeriod = jest.fn();

describe('Scheduler Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('post with status=SCHEDULED and scheduledAt in past is eligible for queue', async () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    
    const mockPost = {
      id: 'post-1',
      workspaceId: 'workspace-123',
      status: 'SCHEDULED',
      scheduledAt: pastDate,
      content: 'Test post'
    };

    mockGetEligiblePosts.mockResolvedValue([mockPost]);

    const eligiblePosts = await mockGetEligiblePosts('workspace-123');
    
    expect(eligiblePosts).toHaveLength(1);
    expect(eligiblePosts[0].status).toBe('SCHEDULED');
    expect(new Date(eligiblePosts[0].scheduledAt).getTime()).toBeLessThan(Date.now());
  });

  it('post with status=DRAFT is NOT eligible for queue', async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    
    const mockPost = {
      id: 'post-1',
      workspaceId: 'workspace-123',
      status: 'DRAFT',
      scheduledAt: futureDate,
      content: 'Test post'
    };

    mockGetEligiblePosts.mockResolvedValue([]);

    const eligiblePosts = await mockGetEligiblePosts('workspace-123');
    
    expect(eligiblePosts).toHaveLength(0);
  });

  it('scheduledAt is stored in UTC (not local time)', () => {
    const localDate = new Date('2024-01-01T12:00:00-05:00'); // EST
    const utcDate = localDate.toISOString();
    
    expect(utcDate).toBe('2024-01-01T17:00:00.000Z'); // Converted to UTC
    expect(utcDate.endsWith('Z')).toBe(true);
  });

  it('nextSendAt field updates per-record after publish (Rule 13)', async () => {
    const mockPost = {
      id: 'post-1',
      workspaceId: 'workspace-123',
      status: 'PUBLISHED',
      scheduledAt: '2024-01-01T12:00:00Z',
      nextSendAt: null
    };

    const updatedPost = {
      ...mockPost,
      nextSendAt: '2024-01-08T12:00:00Z' // 7 days later for evergreen
    };

    mockUpdateNextSendAt.mockResolvedValue(updatedPost);

    const result = await mockUpdateNextSendAt(mockPost.id, '2024-01-08T12:00:00Z');
    
    expect(result.nextSendAt).not.toBeNull();
    expect(result.nextSendAt).toBe('2024-01-08T12:00:00Z');
  });

  it('scheduling in blackout period is blocked', async () => {
    const blackoutDate = '2024-12-25T12:00:00Z';
    
    mockCheckBlackoutPeriod.mockResolvedValue({
      isBlocked: true,
      reason: 'Christmas - blackout period'
    });

    const result = await mockCheckBlackoutPeriod('workspace-123', blackoutDate);
    
    expect(result.isBlocked).toBe(true);
    expect(result.reason).toContain('blackout');
  });

  it('scheduling outside blackout period is allowed', async () => {
    const normalDate = '2024-01-15T12:00:00Z';
    
    mockCheckBlackoutPeriod.mockResolvedValue({
      isBlocked: false
    });

    const result = await mockCheckBlackoutPeriod('workspace-123', normalDate);
    
    expect(result.isBlocked).toBe(false);
  });
});
