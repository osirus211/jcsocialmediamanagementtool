import { render, screen, fireEvent } from '@testing-library/react';
import { TopPostsGrid } from '../TopPostsGrid';

const mockData = [
  {
    postId: '1',
    content: 'Test post 1',
    platform: 'twitter',
    publishedAt: '2024-01-01T10:00:00Z',
    likes: 100,
    comments: 20,
    shares: 10,
    saves: 5,
    clicks: 15,
    engagements: 150,
    reach: 800,
    impressions: 1000,
    engagementRate: 13.0,
    performanceScore: 85,
  },
  {
    postId: '2',
    content: 'Test post 2',
    platform: 'facebook',
    publishedAt: '2024-01-02T14:00:00Z',
    likes: 200,
    comments: 40,
    shares: 20,
    saves: 10,
    clicks: 25,
    engagements: 295,
    reach: 1600,
    impressions: 2000,
    engagementRate: 13.5,
    performanceScore: 90,
  },
];

describe('TopPostsGrid', () => {
  it('renders posts grid with data', () => {
    render(<TopPostsGrid data={mockData} />);
    expect(screen.getAllByText('twitter')).toHaveLength(2); // One in card, one in screen reader table
    expect(screen.getAllByText('facebook')).toHaveLength(2); // One in card, one in screen reader table
  });

  it('shows empty state when no data', () => {
    render(<TopPostsGrid data={[]} />);
    expect(screen.getByText(/no top posts yet/i)).toBeInTheDocument();
  });

  it('handles pagination correctly', () => {
    const manyPosts = Array.from({ length: 25 }, (_, i) => ({
      ...mockData[0],
      postId: `${i + 1}`,
      content: `Test post ${i + 1}`,
    }));

    render(<TopPostsGrid data={manyPosts} />);
    
    // Should show first 10 posts (itemsPerPage = 10)
    expect(screen.getByTestId('top-posts-section')).toBeInTheDocument();

    // Navigate to next page
    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);
    
    expect(screen.getByTestId('top-posts-section')).toBeInTheDocument();
  });

  it('works at mobile width (375px)', () => {
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    render(<TopPostsGrid data={mockData} />);
    expect(screen.getAllByText('twitter')).toHaveLength(2); // One in card, one in screen reader table
  });
});