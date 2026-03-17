import { render, screen } from '@testing-library/react';
import { EngagementChart } from '../EngagementChart';

const mockData = [
  { date: '2024-01-01', likes: 100, comments: 20, shares: 10, engagement: 130 },
  { date: '2024-01-02', likes: 150, comments: 30, shares: 15, engagement: 195 },
];

describe('EngagementChart', () => {
  it('renders chart with data', () => {
    render(<EngagementChart data={mockData} viewType="day" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<EngagementChart data={[]} viewType="day" />);
    expect(screen.getByText(/no engagement data/i)).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<EngagementChart data={mockData} viewType="day" />);
    const chart = screen.getByRole('img');
    expect(chart).toHaveAttribute('aria-label', expect.stringContaining('Engagement by day chart'));
  });
});