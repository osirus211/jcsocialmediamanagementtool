import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BestTimeHeatmap } from '../BestTimeHeatmap';
import { analyticsService } from '@/services/analytics.service';

// Mock the analytics service
vi.mock('@/services/analytics.service', () => ({
  analyticsService: {
    getBestTimes: vi.fn()
  }
}));

// Mock the workspace store
vi.mock('@/store/workspace.store', () => ({
  useWorkspaceStore: () => ({
    currentWorkspace: { _id: 'test-workspace' }
  })
}));

const mockHeatmapData = Array.from({ length: 168 }, (_, i) => ({
  dayOfWeek: Math.floor(i / 24),
  hour: i % 24,
  avgEngagement: Math.random() * 10 + 5,
  postCount: Math.floor(Math.random() * 5) + 1
}));

describe('BestTimeHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (analyticsService.getBestTimes as any).mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<BestTimeHeatmap />);
    
    // In loading state, we should see skeleton elements
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', async () => {
    (analyticsService.getBestTimes as any).mockResolvedValue({
      heatmap: mockHeatmapData
    });
    
    render(<BestTimeHeatmap />);
    
    await waitFor(() => {
      const heatmap = screen.getByRole('img');
      expect(heatmap).toHaveAttribute('aria-label', expect.stringContaining('Best times to post heatmap'));
    });
  });

  it('includes screen reader accessible data table', async () => {
    (analyticsService.getBestTimes as any).mockResolvedValue({
      heatmap: mockHeatmapData
    });
    
    render(<BestTimeHeatmap />);
    
    await waitFor(() => {
      expect(screen.getByRole('table', { hidden: true })).toBeInTheDocument();
      expect(screen.getByText('Best times to post heatmap data')).toBeInTheDocument();
    });
  });

  it('shows hover instruction text when data is loaded', async () => {
    (analyticsService.getBestTimes as any).mockResolvedValue({
      heatmap: mockHeatmapData
    });
    
    render(<BestTimeHeatmap />);
    
    await waitFor(() => {
      expect(screen.getByText(/hover over cells/i)).toBeInTheDocument();
    });
  });
});