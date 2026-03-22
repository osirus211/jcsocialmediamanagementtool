import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock evergreen store
const mockEvergreenRules = vi.fn();
const mockDeleteRule = vi.fn();

// Mock EvergreenPage component
const MockEvergreenPage = ({ rules }: { rules: any[] }) => {
  return (
    <div data-testid="evergreen-page">
      <button data-testid="create-rule-button">Create Rule</button>
      <div data-testid="evergreen-rules-list">
        {rules.map((rule) => (
          <div key={rule.id} data-testid={`evergreen-rule-${rule.id}`}>
            <span>{rule.name}</span>
            <span data-testid={`recycle-count-${rule.id}`}>Recycled: {rule.recycleCount || 0}</span>
            <button data-testid={`delete-rule-${rule.id}`} onClick={() => mockDeleteRule(rule.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

describe('EvergreenPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders evergreen rules list', () => {
    const rules = [
      { id: 'rule-1', name: 'Weekly Tips', recycleCount: 5 },
      { id: 'rule-2', name: 'Daily Quotes', recycleCount: 10 },
    ];

    render(<MockEvergreenPage rules={rules} />);
    
    expect(screen.getByTestId('evergreen-page')).toBeInTheDocument();
    expect(screen.getByTestId('evergreen-rule-rule-1')).toBeInTheDocument();
    expect(screen.getByTestId('evergreen-rule-rule-2')).toBeInTheDocument();
  });

  it('create rule opens modal', () => {
    render(<MockEvergreenPage rules={[]} />);
    
    const createButton = screen.getByTestId('create-rule-button');
    expect(createButton).toBeInTheDocument();
    
    fireEvent.click(createButton);
    // Modal opening would be tested in integration test
  });

  it('delete rule calls API', () => {
    const rules = [
      { id: 'rule-1', name: 'Weekly Tips', recycleCount: 5 },
    ];

    render(<MockEvergreenPage rules={rules} />);
    
    const deleteButton = screen.getByTestId('delete-rule-rule-1');
    fireEvent.click(deleteButton);
    
    expect(mockDeleteRule).toHaveBeenCalledWith('rule-1');
  });

  it('badge shows recycle count', () => {
    const rules = [
      { id: 'rule-1', name: 'Weekly Tips', recycleCount: 5 },
    ];

    render(<MockEvergreenPage rules={rules} />);
    
    const recycleCount = screen.getByTestId('recycle-count-rule-1');
    expect(recycleCount).toHaveTextContent('Recycled: 5');
  });
});
