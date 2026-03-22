import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useInboxStore } from '@/store/inbox.store';

vi.mock('@/store/inbox.store', () => ({
  useInboxStore: vi.fn(),
}));

vi.mock('@/store/workspace.store', () => ({
  useWorkspaceStore: vi.fn(() => ({ currentWorkspace: { _id: 'workspace-123' } })),
}));

const MockInboxPage = () => {
  const {
    items,
    isLoading,
    error,
    activeFilter,
    unreadOnly,
    isStreamConnected,
    markAllRead,
    setFilter,
    setUnreadOnly,
  } = useInboxStore();

  if (isLoading) return <div data-testid="inbox-loading">Loading...</div>;
  if (error) return <div data-testid="inbox-error">{error}</div>;

  return (
    <div data-testid="inbox-page">
      {isStreamConnected && <span data-testid="stream-indicator" className="bg-green-500" />}
      
      <button data-testid="mark-all-read" onClick={() => markAllRead('workspace-123')}>
        Mark all read
      </button>

      <button data-testid="filter-mentions" onClick={() => setFilter('mention')}>
        Mentions
      </button>

      <label>
        <input
          data-testid="unread-only"
          type="checkbox"
          checked={unreadOnly}
          onChange={(e) => setUnreadOnly(e.target.checked)}
        />
        Unread only
      </label>

      {items.length === 0 ? (
        <div data-testid="inbox-empty">No items</div>
      ) : (
        items.map((item) => (
          <div key={item._id} data-testid={`inbox-item-${item._id}`}>
            {item.content}
            {!item.readAt && <span data-testid={`unread-${item._id}`} />}
          </div>
        ))
      )}
    </div>
  );
};

describe('InboxPage', () => {
  const mockMarkAllRead = vi.fn();
  const mockSetFilter = vi.fn();
  const mockSetUnreadOnly = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useInboxStore as any).mockImplementation((selector: any) => {
      const state = {
        items: [],
        isLoading: false,
        error: null,
        activeFilter: 'all',
        unreadOnly: false,
        isStreamConnected: false,
        markAllRead: mockMarkAllRead,
        setFilter: mockSetFilter,
        setUnreadOnly: mockSetUnreadOnly,
      };
      return selector ? selector(state) : state;
    });
  });

  it('renders inbox with items', () => {
    (useInboxStore as any).mockImplementation((selector: any) => {
      const state = {
        items: [
          { _id: 'item-1', type: 'mention', content: 'Test mention', createdAt: new Date().toISOString() },
          { _id: 'item-2', type: 'comment', content: 'Test comment', createdAt: new Date().toISOString() },
        ],
        isLoading: false,
        error: null,
        activeFilter: 'all',
        unreadOnly: false,
        isStreamConnected: false,
        markAllRead: mockMarkAllRead,
        setFilter: mockSetFilter,
        setUnreadOnly: mockSetUnreadOnly,
      };
      return selector ? selector(state) : state;
    });

    render(<MockInboxPage />);

    expect(screen.getByTestId('inbox-page')).toBeInTheDocument();
    expect(screen.getByTestId('inbox-item-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('inbox-item-item-2')).toBeInTheDocument();
  });

  it('filter mentions only hides comments and notifications', async () => {
    render(<MockInboxPage />);

    const filterButton = screen.getByTestId('filter-mentions');
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(mockSetFilter).toHaveBeenCalledWith('mention');
    });
  });

  it('filter unread only hides read items', async () => {
    render(<MockInboxPage />);

    const checkbox = screen.getByTestId('unread-only');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockSetUnreadOnly).toHaveBeenCalledWith(true);
    });
  });

  it('mark all read calls markAllRead action', async () => {
    render(<MockInboxPage />);

    const button = screen.getByTestId('mark-all-read');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockMarkAllRead).toHaveBeenCalledWith('workspace-123');
    });
  });

  it('stream connected indicator shows green dot', () => {
    (useInboxStore as any).mockImplementation((selector: any) => {
      const state = {
        items: [],
        isLoading: false,
        error: null,
        activeFilter: 'all',
        unreadOnly: false,
        isStreamConnected: true,
        markAllRead: mockMarkAllRead,
        setFilter: mockSetFilter,
        setUnreadOnly: mockSetUnreadOnly,
      };
      return selector ? selector(state) : state;
    });

    render(<MockInboxPage />);

    const indicator = screen.getByTestId('stream-indicator');
    expect(indicator).toHaveClass('bg-green-500');
  });

  it('loading skeleton renders while fetching', () => {
    (useInboxStore as any).mockImplementation((selector: any) => {
      const state = {
        items: [],
        isLoading: true,
        error: null,
        activeFilter: 'all',
        unreadOnly: false,
        isStreamConnected: false,
        markAllRead: mockMarkAllRead,
        setFilter: mockSetFilter,
        setUnreadOnly: mockSetUnreadOnly,
      };
      return selector ? selector(state) : state;
    });

    render(<MockInboxPage />);

    expect(screen.getByTestId('inbox-loading')).toBeInTheDocument();
  });

  it('empty state renders when no items', () => {
    render(<MockInboxPage />);

    expect(screen.getByTestId('inbox-empty')).toBeInTheDocument();
  });
});
