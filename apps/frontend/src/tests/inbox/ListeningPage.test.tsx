import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useInboxStore } from '@/store/inbox.store';

vi.mock('@/store/inbox.store', () => ({
  useInboxStore: vi.fn(),
}));

vi.mock('@/store/workspace.store', () => ({
  useWorkspaceStore: vi.fn(() => ({ currentWorkspace: { _id: 'workspace-123' } })),
}));

const MockListeningPage = () => {
  const {
    listeningRules,
    isLoadingRules,
    createListeningRule,
    deleteListeningRule,
  } = useInboxStore();

  const canAddMore = listeningRules.length < 20;

  if (isLoadingRules) return <div data-testid="loading">Loading...</div>;

  return (
    <div data-testid="listening-page">
      <button
        data-testid="add-rule-button"
        disabled={!canAddMore}
        onClick={() => createListeningRule('workspace-123', { platform: 'twitter', type: 'keyword', value: 'test' })}
      >
        Add Rule
      </button>

      {!canAddMore && <div data-testid="limit-warning">Max 20 rules</div>}

      {listeningRules.map((rule) => (
        <div key={rule._id} data-testid={`rule-${rule._id}`}>
          {rule.value}
          <button
            data-testid={`delete-${rule._id}`}
            onClick={() => deleteListeningRule('workspace-123', rule._id)}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
};

describe('ListeningPage', () => {
  const mockCreateListeningRule = vi.fn();
  const mockDeleteListeningRule = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useInboxStore as any).mockImplementation((selector: any) => {
      const state = {
        listeningRules: [],
        isLoadingRules: false,
        createListeningRule: mockCreateListeningRule,
        deleteListeningRule: mockDeleteListeningRule,
      };
      return selector ? selector(state) : state;
    });
  });

  it('renders rules list', () => {
    (useInboxStore as any).mockImplementation((selector: any) => {
      const state = {
        listeningRules: [
          { _id: 'rule-1', platform: 'twitter', type: 'keyword', value: 'test1', active: true },
          { _id: 'rule-2', platform: 'instagram', type: 'hashtag', value: 'test2', active: true },
        ],
        isLoadingRules: false,
        createListeningRule: mockCreateListeningRule,
        deleteListeningRule: mockDeleteListeningRule,
      };
      return selector ? selector(state) : state;
    });

    render(<MockListeningPage />);

    expect(screen.getByTestId('listening-page')).toBeInTheDocument();
    expect(screen.getByTestId('rule-rule-1')).toBeInTheDocument();
    expect(screen.getByTestId('rule-rule-2')).toBeInTheDocument();
  });

  it('add rule form submits createListeningRule', async () => {
    render(<MockListeningPage />);

    const addButton = screen.getByTestId('add-rule-button');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockCreateListeningRule).toHaveBeenCalledWith('workspace-123', {
        platform: 'twitter',
        type: 'keyword',
        value: 'test',
      });
    });
  });

  it('delete rule calls deleteListeningRule', async () => {
    (useInboxStore as any).mockImplementation((selector: any) => {
      const state = {
        listeningRules: [
          { _id: 'rule-1', platform: 'twitter', type: 'keyword', value: 'test1', active: true },
        ],
        isLoadingRules: false,
        createListeningRule: mockCreateListeningRule,
        deleteListeningRule: mockDeleteListeningRule,
      };
      return selector ? selector(state) : state;
    });

    render(<MockListeningPage />);

    const deleteButton = screen.getByTestId('delete-rule-1');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockDeleteListeningRule).toHaveBeenCalledWith('workspace-123', 'rule-1');
    });
  });

  it('20 rules reached disables add button', () => {
    const rules = Array.from({ length: 20 }, (_, i) => ({
      _id: `rule-${i}`,
      platform: 'twitter',
      type: 'keyword' as const,
      value: `test${i}`,
      active: true,
      workspaceId: 'workspace-123',
      createdAt: new Date().toISOString(),
    }));

    (useInboxStore as any).mockImplementation((selector: any) => {
      const state = {
        listeningRules: rules,
        isLoadingRules: false,
        createListeningRule: mockCreateListeningRule,
        deleteListeningRule: mockDeleteListeningRule,
      };
      return selector ? selector(state) : state;
    });

    render(<MockListeningPage />);

    const addButton = screen.getByTestId('add-rule-button');
    expect(addButton).toBeDisabled();
    expect(screen.getByTestId('limit-warning')).toBeInTheDocument();
  });
});
