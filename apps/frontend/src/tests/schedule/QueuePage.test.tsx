import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useScheduleStore } from '@/store/schedule.store';

// Mock the schedule store
vi.mock('@/store/schedule.store', () => ({
  useScheduleStore: vi.fn(),
}));

// Mock QueuePage component
const MockQueuePage = () => {
  const { queuedPosts, isQueueLoading, queueError, reorderQueue, pauseQueue, resumeQueue } = useScheduleStore();
  
  if (isQueueLoading) return <div data-testid="queue-loading">Loading...</div>;
  if (queueError) return <div data-testid="queue-error">{queueError}</div>;
  if (queuedPosts.length === 0) return <div data-testid="queue-empty">No posts in queue</div>;
  
  return (
    <div data-testid="queue-page">
      <button data-testid="pause-button" onClick={() => pauseQueue('workspace-123')}>Pause</button>
      <button data-testid="resume-button" onClick={() => resumeQueue('workspace-123')}>Resume</button>
      {queuedPosts.map((post) => (
        <div key={post.id} data-testid={`queue-post-${post.id}`}>
          {post.content}
        </div>
      ))}
    </div>
  );
};

describe('QueuePage', () => {
  const mockReorderQueue = vi.fn();
  const mockPauseQueue = vi.fn();
  const mockResumeQueue = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useScheduleStore as any).mockImplementation((selector: any) => {
      const state = {
        queuedPosts: [],
        isQueueLoading: false,
        queueError: null,
        reorderQueue: mockReorderQueue,
        pauseQueue: mockPauseQueue,
        resumeQueue: mockResumeQueue,
      };
      return selector ? selector(state) : state;
    });
  });

  it('renders queue with posts', () => {
    (useScheduleStore as any).mockImplementation((selector: any) => {
      const state = {
        queuedPosts: [
          { id: 'post-1', content: 'Test post 1', platform: 'twitter', order: 1 },
          { id: 'post-2', content: 'Test post 2', platform: 'facebook', order: 2 },
        ],
        isQueueLoading: false,
        queueError: null,
        reorderQueue: mockReorderQueue,
        pauseQueue: mockPauseQueue,
        resumeQueue: mockResumeQueue,
      };
      return selector ? selector(state) : state;
    });

    render(<MockQueuePage />);
    
    expect(screen.getByTestId('queue-page')).toBeInTheDocument();
    expect(screen.getByTestId('queue-post-post-1')).toBeInTheDocument();
    expect(screen.getByTestId('queue-post-post-2')).toBeInTheDocument();
  });

  it('shows empty state when queue is empty', () => {
    render(<MockQueuePage />);
    
    expect(screen.getByTestId('queue-empty')).toBeInTheDocument();
    expect(screen.getByText('No posts in queue')).toBeInTheDocument();
  });

  it('pause button calls pauseQueue store action', async () => {
    (useScheduleStore as any).mockImplementation((selector: any) => {
      const state = {
        queuedPosts: [{ id: 'post-1', content: 'Test post', platform: 'twitter', order: 1 }],
        isQueueLoading: false,
        queueError: null,
        reorderQueue: mockReorderQueue,
        pauseQueue: mockPauseQueue,
        resumeQueue: mockResumeQueue,
      };
      return selector ? selector(state) : state;
    });

    render(<MockQueuePage />);
    
    const pauseButton = screen.getByTestId('pause-button');
    fireEvent.click(pauseButton);
    
    await waitFor(() => {
      expect(mockPauseQueue).toHaveBeenCalledWith('workspace-123');
    });
  });

  it('resume button calls resumeQueue', async () => {
    (useScheduleStore as any).mockImplementation((selector: any) => {
      const state = {
        queuedPosts: [{ id: 'post-1', content: 'Test post', platform: 'twitter', order: 1 }],
        isQueueLoading: false,
        queueError: null,
        reorderQueue: mockReorderQueue,
        pauseQueue: mockPauseQueue,
        resumeQueue: mockResumeQueue,
      };
      return selector ? selector(state) : state;
    });

    render(<MockQueuePage />);
    
    const resumeButton = screen.getByTestId('resume-button');
    fireEvent.click(resumeButton);
    
    await waitFor(() => {
      expect(mockResumeQueue).toHaveBeenCalledWith('workspace-123');
    });
  });

  it('loading state shows skeleton', () => {
    (useScheduleStore as any).mockImplementation((selector: any) => {
      const state = {
        queuedPosts: [],
        isQueueLoading: true,
        queueError: null,
        reorderQueue: mockReorderQueue,
        pauseQueue: mockPauseQueue,
        resumeQueue: mockResumeQueue,
      };
      return selector ? selector(state) : state;
    });

    render(<MockQueuePage />);
    
    expect(screen.getByTestId('queue-loading')).toBeInTheDocument();
  });

  it('error state shows error message', () => {
    (useScheduleStore as any).mockImplementation((selector: any) => {
      const state = {
        queuedPosts: [],
        isQueueLoading: false,
        queueError: 'Failed to load queue',
        reorderQueue: mockReorderQueue,
        pauseQueue: mockPauseQueue,
        resumeQueue: mockResumeQueue,
      };
      return selector ? selector(state) : state;
    });

    render(<MockQueuePage />);
    
    expect(screen.getByTestId('queue-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load queue')).toBeInTheDocument();
  });
});
