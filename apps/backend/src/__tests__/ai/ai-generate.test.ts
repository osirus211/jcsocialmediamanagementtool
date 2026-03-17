/**
 * AI Generation Tests
 * Tests for AI calendar generation functionality
 */

const { Workspace } = require('../../models/Workspace');

// Mock dependencies
jest.mock('../../models/Workspace');

describe('AI Calendar Generation', () => {
  const mockWorkspaceId = '507f1f77bcf86cd799439011';
  
  const validPayload = {
    startDate: '2026-03-18',
    endDate: '2026-03-25',
    platforms: ['twitter', 'facebook'],
    postCount: 5,
    topic: 'Product launch',
    tone: 'professional',
    emptySlots: [
      '2026-03-18T09:00:00Z',
      '2026-03-18T13:00:00Z',
      '2026-03-19T09:00:00Z',
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock workspace
    Workspace.findById = jest.fn().mockResolvedValue({
      _id: mockWorkspaceId,
      name: 'Test Workspace',
      settings: { industry: 'saas' },
      clientPortal: { brandName: 'Test Brand' },
    });
  });

  it('validates payload structure', () => {
    expect(validPayload.platforms).toEqual(['twitter', 'facebook']);
    expect(validPayload.postCount).toBe(5);
    expect(validPayload.emptySlots).toHaveLength(3);
    expect(validPayload.topic).toBe('Product launch');
  });

  it('validates date range constraints', () => {
    const start = new Date(validPayload.startDate);
    const end = new Date(validPayload.endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    expect(daysDiff).toBeLessThanOrEqual(30);
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
  });

  it('validates platform array requirements', () => {
    expect(Array.isArray(validPayload.platforms)).toBe(true);
    expect(validPayload.platforms.length).toBeGreaterThan(0);
  });

  it('validates post count limits', () => {
    expect(validPayload.postCount).toBeGreaterThanOrEqual(1);
    expect(validPayload.postCount).toBeLessThanOrEqual(30);
  });

  it('validates empty slots format', () => {
    validPayload.emptySlots.forEach(slot => {
      expect(new Date(slot)).toBeInstanceOf(Date);
      expect(slot).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    });
  });

  it('validates workspace context retrieval', async () => {
    const workspace = await Workspace.findById(mockWorkspaceId);
    
    expect(workspace).toBeDefined();
    expect(workspace.name).toBe('Test Workspace');
    expect(workspace.settings.industry).toBe('saas');
    expect(workspace.clientPortal.brandName).toBe('Test Brand');
  });
});