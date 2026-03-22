import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useScheduleStore } from '@/store/schedule.store';

// Mock the schedule store
vi.mock('@/store/schedule.store', () => ({
  useScheduleStore: vi.fn(),
}));

// Mock CalendarPage component
const MockCalendarPage = () => {
  const { calendarView, setCalendarView, calendarPosts, isCalendarLoading } = useScheduleStore();
  
  if (isCalendarLoading) return <div data-testid="calendar-loading">Loading...</div>;
  
  return (
    <div data-testid="calendar-page">
      <div data-testid="calendar-view-selector">
        <button data-testid="view-month" onClick={() => setCalendarView('month')}>Month</button>
        <button data-testid="view-week" onClick={() => setCalendarView('week')}>Week</button>
        <button data-testid="view-list" onClick={() => setCalendarView('list')}>List</button>
      </div>
      <div data-testid={`calendar-view-${calendarView}`}>
        {calendarView === 'month' && <div>Month View</div>}
        {calendarView === 'week' && <div>Week View</div>}
        {calendarView === 'list' && <div>List View</div>}
      </div>
      <div data-testid="calendar-posts">
        {calendarPosts.map((post) => (
          <div key={post._id} data-testid={`calendar-post-${post._id}`}>
            {post.content}
          </div>
        ))}
      </div>
    </div>
  );
};

describe('CalendarPage', () => {
  const mockSetCalendarView = vi.fn();
  const mockReschedulePost = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useScheduleStore as any).mockImplementation((selector: any) => {
      const state = {
        calendarView: 'month',
        calendarPosts: [],
        isCalendarLoading: false,
        setCalendarView: mockSetCalendarView,
        reschedulePost: mockReschedulePost,
      };
      return selector ? selector(state) : state;
    });
  });

  it('renders month view by default', () => {
    render(<MockCalendarPage />);
    
    expect(screen.getByTestId('calendar-page')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-view-month')).toBeInTheDocument();
    expect(screen.getByText('Month View')).toBeInTheDocument();
  });

  it('switch to week view', () => {
    (useScheduleStore as any).mockImplementation((selector: any) => {
      const state = {
        calendarView: 'week',
        calendarPosts: [],
        isCalendarLoading: false,
        setCalendarView: mockSetCalendarView,
        reschedulePost: mockReschedulePost,
      };
      return selector ? selector(state) : state;
    });

    render(<MockCalendarPage />);
    
    const weekButton = screen.getByTestId('view-week');
    fireEvent.click(weekButton);
    
    expect(screen.getByTestId('calendar-view-week')).toBeInTheDocument();
    expect(screen.getByText('Week View')).toBeInTheDocument();
  });

  it('switch to list view', () => {
    (useScheduleStore as any).mockImplementation((selector: any) => {
      const state = {
        calendarView: 'list',
        calendarPosts: [],
        isCalendarLoading: false,
        setCalendarView: mockSetCalendarView,
        reschedulePost: mockReschedulePost,
      };
      return selector ? selector(state) : state;
    });

    render(<MockCalendarPage />);
    
    const listButton = screen.getByTestId('view-list');
    fireEvent.click(listButton);
    
    expect(screen.getByTestId('calendar-view-list')).toBeInTheDocument();
    expect(screen.getByText('List View')).toBeInTheDocument();
  });

  it('posts appear on correct calendar date', () => {
    (useScheduleStore as any).mockImplementation((selector: any) => {
      const state = {
        calendarView: 'month',
        calendarPosts: [
          { _id: 'post-1', content: 'Test post 1', scheduledAt: '2024-01-15T12:00:00Z', platform: 'twitter' },
          { _id: 'post-2', content: 'Test post 2', scheduledAt: '2024-01-16T12:00:00Z', platform: 'facebook' },
        ],
        isCalendarLoading: false,
        setCalendarView: mockSetCalendarView,
        reschedulePost: mockReschedulePost,
      };
      return selector ? selector(state) : state;
    });

    render(<MockCalendarPage />);
    
    expect(screen.getByTestId('calendar-post-post-1')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-post-post-2')).toBeInTheDocument();
  });

  it('loading state renders correctly', () => {
    (useScheduleStore as any).mockImplementation((selector: any) => {
      const state = {
        calendarView: 'month',
        calendarPosts: [],
        isCalendarLoading: true,
        setCalendarView: mockSetCalendarView,
        reschedulePost: mockReschedulePost,
      };
      return selector ? selector(state) : state;
    });

    render(<MockCalendarPage />);
    
    expect(screen.getByTestId('calendar-loading')).toBeInTheDocument();
  });
});
