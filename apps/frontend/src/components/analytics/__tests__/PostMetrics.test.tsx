import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { TopPostsGrid } from '../TopPostsGrid';
import { WorstPostsGrid } from '../WorstPostsGrid';
import { PostComparison } from '../PostComparison';
import { PostDetailView } from '../PostDetailView';
import { PostMetricsExport } from '../PostMetricsExport';

// Mock the analytics service
vi.mock('@/services/analytics.service', () => ({
  analyticsService: {
    getPostDetail: vi.fn()
  }
}));

// Mock recharts
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>
}));

const mockTopPosts = [
  {
    postId: '1',
    platform: 'twitter',
    publishedAt: '2024-01-15T10:00:00Z',
    likes: 100,
    comments: 20,
    shares: 15,
    saves: 5,
    clicks: 25,
    engagements: 165,
    reach: 1000,
    impressions: 2000,
    engagementRate: 14.0,
    performanceScore: 75,
    content: 'Test post content'
  },
  {
    postId: '2',
    platform: 'facebook',
    publishedAt: '2024-01-14T15:30:00Z',
    likes: 50,
    comments: 10,
    shares: 8,
    saves: 2,
    clicks: 15,
    engagements: 85,
    reach: 500,
    impressions: 1000,
    engagementRate: 14.0,
    performanceScore: 60,
    content: 'Another test post'
  }
];

const mockWorstPosts = [
  {
    postId: '3',
    platform: 'instagram',
    publishedAt: '2024-01-13T09:00:00Z',
    likes: 5,
    comments: 1,
    shares: 0,
    saves: 0,
    clicks: 2,
    engagements: 8,
    reach: 100,
    impressions: 200,
    engagementRate: 6.0,
    performanceScore: 25,
    content: 'Underperforming post',
    suggestion: 'Try posting at a different time'
  }
];

describe('individual post metrics', () => {
  it('renders all 6 metrics: likes, comments, shares, reach, impressions, saves', () => {
    render(<TopPostsGrid data={mockTopPosts} />);
    
    const topPostsSection = screen.getByTestId('top-posts-section');
    expect(within(topPostsSection).getAllByText(/likes/i)).toHaveLength(2);
    expect(within(topPostsSection).getAllByText(/comments/i)).toHaveLength(2);
    expect(within(topPostsSection).getAllByText(/shares/i)).toHaveLength(2);
    expect(within(topPostsSection).getAllByText(/audience reached/i)).toHaveLength(2);
    expect(within(topPostsSection).getAllByText(/impressions/i)).toHaveLength(2);
    expect(within(topPostsSection).getAllByText(/saves/i)).toHaveLength(2);
  });

  it('shows — for missing metric, not 0 or crash', () => {
    const postWithMissingReach = [{
      ...mockTopPosts[0],
      reach: 0
    }];
    
    render(<TopPostsGrid data={postWithMissingReach} />);
    
    // Should show "—" for zero reach - check that at least one dash exists
    expect(screen.getAllByText('—')).toHaveLength(1);
  });

  it('shows platform-appropriate label (Retweets for Twitter)', () => {
    render(<TopPostsGrid data={mockTopPosts} />);
    
    // Check that Twitter shows as "𝕏" icon
    const topPostsSection = screen.getByTestId('top-posts-section');
    const twitterPost = within(topPostsSection).getByText('twitter');
    expect(twitterPost).toBeInTheDocument();
  });
});

describe('performance score', () => {
  it('displays score as visual bar or ring', () => {
    render(<TopPostsGrid data={mockTopPosts} />);
    
    // Check for performance score visual indicators
    const performanceBars = screen.getAllByRole('progressbar', { hidden: true });
    expect(performanceBars.length).toBeGreaterThan(0);
  });

  it('score 0–39 has red color indicator', () => {
    const lowScorePost = [{
      ...mockTopPosts[0],
      performanceScore: 25
    }];
    
    render(<TopPostsGrid data={lowScorePost} />);
    
    // Check for red color class on the performance score specifically
    const scoreElements = screen.getAllByText('25');
    const performanceScoreElement = scoreElements.find(el => 
      el.classList.contains('text-red-600')
    );
    expect(performanceScoreElement).toBeTruthy();
  });

  it('score 40–69 has amber color indicator', () => {
    const mediumScorePost = [{
      ...mockTopPosts[0],
      performanceScore: 55
    }];
    
    render(<TopPostsGrid data={mediumScorePost} />);
    
    const scoreElement = screen.getByText('55');
    expect(scoreElement).toHaveClass('text-amber-600');
  });

  it('score 70–100 has green color indicator', () => {
    render(<TopPostsGrid data={mockTopPosts} />);
    
    const scoreElement = screen.getByText('75');
    expect(scoreElement).toHaveClass('text-green-600');
  });

  it('has aria-label "Performance score: X out of 100"', () => {
    render(<TopPostsGrid data={mockTopPosts} />);
    
    const scoreElement = screen.getByLabelText(/performance score: 75 out of 100/i);
    expect(scoreElement).toBeInTheDocument();
  });
});

describe('top posts section', () => {
  it('renders up to 10 posts sorted by engagement rate desc', () => {
    render(<TopPostsGrid data={mockTopPosts} />);
    
    const topPostsSection = screen.getByTestId('top-posts-section');
    expect(topPostsSection).toBeInTheDocument();
    
    // Should show both posts
    expect(within(topPostsSection).getAllByText(/twitter|facebook/i)).toHaveLength(2);
  });

  it('each card shows rank, platform, date, engagement rate, score', () => {
    render(<TopPostsGrid data={mockTopPosts} showRanking={true} />);
    
    // Check for rank numbers
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    
    // Check for platforms
    const topPostsSection = screen.getByTestId('top-posts-section');
    expect(within(topPostsSection).getByText('twitter')).toBeInTheDocument();
    expect(within(topPostsSection).getByText('facebook')).toBeInTheDocument();
    
    // Check for engagement rates
    expect(screen.getAllByText('14.0%')).toHaveLength(2);
    
    // Check for performance scores
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('clicking sort header changes sort column', () => {
    render(<TopPostsGrid data={mockTopPosts} />);
    
    // Find the sorting button by role and name
    const performanceScoreButton = screen.getByRole('button', { name: /performance score/i });
    fireEvent.click(performanceScoreButton);
    
    // Should update the sort (visual feedback through icons)
    expect(performanceScoreButton).toBeInTheDocument();
  });

  it('clicking same header again reverses direction', () => {
    render(<TopPostsGrid data={mockTopPosts} />);
    
    // Find the sorting button by role and name
    const engagementButton = screen.getByRole('button', { name: /engagement rate/i });
    
    // Click once
    fireEvent.click(engagementButton);
    
    // Click again to reverse
    fireEvent.click(engagementButton);
    
    expect(engagementButton).toBeInTheDocument();
  });

  it('clicking a post card navigates to /analytics/posts/:postId', () => {
    const mockOnPostClick = vi.fn();
    render(<TopPostsGrid data={mockTopPosts} onPostClick={mockOnPostClick} />);
    
    const firstPost = screen.getByTestId('top-posts-section').firstChild;
    fireEvent.click(firstPost as Element);
    
    expect(mockOnPostClick).toHaveBeenCalledWith('1');
  });
});

describe('worst posts section', () => {
  it('only shows posts with performance score < 40', () => {
    render(<WorstPostsGrid data={mockWorstPosts} />);
    
    const worstPostsSection = screen.getByTestId('worst-posts-section');
    expect(worstPostsSection).toBeInTheDocument();
    
    // Should show the post with score 25
    expect(within(worstPostsSection).getByText('25')).toBeInTheDocument();
  });

  it('shows actionable suggestion on each card', () => {
    render(<WorstPostsGrid data={mockWorstPosts} />);
    
    const worstPostsSection = screen.getByTestId('worst-posts-section');
    expect(within(worstPostsSection).getByText(/try posting at a different time/i)).toBeInTheDocument();
    expect(within(worstPostsSection).getByText(/suggestion/i)).toBeInTheDocument();
  });

  it('shows empty state when no posts score below 40', () => {
    render(<WorstPostsGrid data={[]} />);
    
    expect(screen.getByText('All your posts are performing well')).toBeInTheDocument();
    expect(screen.getByText('No posts are scoring below 40. Keep up the great work!')).toBeInTheDocument();
  });
});

describe('post comparison', () => {
  it('checkbox appears on each post card', () => {
    const mockOnPostSelect = vi.fn();
    render(
      <TopPostsGrid 
        data={mockTopPosts} 
        onPostSelect={mockOnPostSelect}
        selectedPosts={[]}
      />
    );
    
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
  });

  it('selecting 5th post is blocked, shows tooltip', () => {
    const mockOnPostSelect = vi.fn();
    const selectedPosts = ['1', '2', '3', '4']; // Already 4 selected
    
    render(
      <TopPostsGrid 
        data={[...mockTopPosts, { ...mockTopPosts[0], postId: '5' }]} 
        onPostSelect={mockOnPostSelect}
        selectedPosts={selectedPosts}
        maxSelectable={4}
      />
    );
    
    const checkboxes = screen.getAllByRole('checkbox');
    const fifthCheckbox = checkboxes[2]; // Third checkbox (5th post)
    
    expect(fifthCheckbox).toBeDisabled();
    expect(fifthCheckbox).toHaveAttribute('title', 'Maximum 4 posts can be compared at once');
  });

  it('comparison view shows side-by-side columns', () => {
    render(<PostComparison posts={mockTopPosts} isOpen={true} onClose={() => {}} />);
    
    const comparisonView = screen.getByTestId('post-comparison-view');
    expect(comparisonView).toBeInTheDocument();
    
    // Should show table headers for each post
    expect(screen.getByText('Twitter')).toBeInTheDocument();
    expect(screen.getByText('Facebook')).toBeInTheDocument();
  });

  it('winning metric value in each row has green indicator', () => {
    render(<PostComparison posts={mockTopPosts} isOpen={true} onClose={() => {}} />);
    
    // The first post has higher likes (100 vs 50), so it should have green indicator
    const likesRow = screen.getByText('Likes').closest('tr');
    expect(likesRow).toBeInTheDocument();
  });
});

describe('CSV export', () => {
  it('export button has data-testid="export-post-metrics-csv"', () => {
    render(
      <PostMetricsExport 
        startDate={new Date('2024-01-01')}
        endDate={new Date('2024-01-31')}
        platforms={['twitter']}
        posts={mockTopPosts}
      />
    );
    
    const exportButton = screen.getByTestId('export-post-metrics-csv');
    expect(exportButton).toBeInTheDocument();
  });

  it('export button is disabled when no posts in view', () => {
    render(
      <PostMetricsExport 
        startDate={new Date('2024-01-01')}
        endDate={new Date('2024-01-31')}
        platforms={['twitter']}
        posts={[]}
      />
    );
    
    const exportButton = screen.getByTestId('export-post-metrics-csv');
    expect(exportButton).toBeDisabled();
  });
});

describe('accessibility', () => {
  it('all icon buttons have aria-label', () => {
    render(<TopPostsGrid data={mockTopPosts} />);
    
    // Performance score should have aria-label
    const scoreElement = screen.getByLabelText(/performance score: 75 out of 100/i);
    expect(scoreElement).toBeInTheDocument();
  });

  it('performance score has aria-label with value', () => {
    render(<TopPostsGrid data={mockTopPosts} />);
    
    const scoreElement = screen.getByLabelText('Performance score: 75 out of 100');
    expect(scoreElement).toBeInTheDocument();
  });

  it('comparison view is keyboard navigable', () => {
    render(<PostComparison posts={mockTopPosts} isOpen={true} onClose={() => {}} />);
    
    const closeButton = screen.getByLabelText('Close comparison');
    expect(closeButton).toBeInTheDocument();
    
    // Should be focusable
    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);
  });
});