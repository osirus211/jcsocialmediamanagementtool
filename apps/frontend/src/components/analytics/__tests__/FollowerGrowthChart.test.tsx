import { render, screen } from '@testing-library/react';
import { FollowerGrowthChart } from '../FollowerGrowthChart';

const mockData = [
  { date: '2024-01-01', platform: 'twitter', followerCount: 1000 },
  { date: '2024-01-02', platform: 'twitter', followerCount: 1050 },
  { date: '2024-01-01', platform: 'facebook', followerCount: 2000 },
  { date: '2024-01-02', platform: 'facebook', followerCount: 2100 },
];

describe('FollowerGrowthChart', () => {
  it('renders chart with data', () => {
    render(<FollowerGrowthChart data={mockData} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<FollowerGrowthChart data={[]} />);
    expect(screen.getByText(/no follower data/i)).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<FollowerGrowthChart data={mockData} />);
    const chart = screen.getByRole('img');
    expect(chart).toHaveAttribute('aria-label', expect.stringContaining('Follower growth chart'));
  });

  it('includes screen reader accessible data table', () => {
    render(<FollowerGrowthChart data={mockData} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Follower growth data by platform over time')).toBeInTheDocument();
  });
});