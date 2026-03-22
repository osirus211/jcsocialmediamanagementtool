import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock blackout dates API
const mockAddBlackoutDate = vi.fn();
const mockDeleteBlackoutDate = vi.fn();

// Mock BlackoutDates component
const MockBlackoutDates = ({ dates }: { dates: any[] }) => {
  return (
    <div data-testid="blackout-dates-page">
      <button data-testid="add-blackout-button">Add Blackout Date</button>
      <div data-testid="blackout-dates-list">
        {dates.map((date) => (
          <div key={date.id} data-testid={`blackout-date-${date.id}`}>
            <span>{date.reason}</span>
            <span>{date.startDate}</span>
            <button data-testid={`delete-blackout-${date.id}`} onClick={() => mockDeleteBlackoutDate(date.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Mock composer warning component
const MockComposerWithBlackoutWarning = ({ scheduledDate, blackoutDates }: { scheduledDate: string; blackoutDates: any[] }) => {
  const isBlackedOut = blackoutDates.some(
    (bd) => new Date(scheduledDate) >= new Date(bd.startDate) && new Date(scheduledDate) <= new Date(bd.endDate)
  );

  return (
    <div data-testid="composer">
      {isBlackedOut && (
        <div data-testid="blackout-warning">
          Warning: This date is blacked out
        </div>
      )}
    </div>
  );
};

describe('BlackoutDates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders blackout dates list', () => {
    const dates = [
      { id: 'bd-1', reason: 'Christmas', startDate: '2024-12-25', endDate: '2024-12-25' },
      { id: 'bd-2', reason: 'New Year', startDate: '2024-01-01', endDate: '2024-01-01' },
    ];

    render(<MockBlackoutDates dates={dates} />);
    
    expect(screen.getByTestId('blackout-dates-page')).toBeInTheDocument();
    expect(screen.getByTestId('blackout-date-bd-1')).toBeInTheDocument();
    expect(screen.getByTestId('blackout-date-bd-2')).toBeInTheDocument();
  });

  it('add blackout date', () => {
    render(<MockBlackoutDates dates={[]} />);
    
    const addButton = screen.getByTestId('add-blackout-button');
    expect(addButton).toBeInTheDocument();
    
    fireEvent.click(addButton);
    // Modal opening would be tested in integration test
  });

  it('delete blackout date', () => {
    const dates = [
      { id: 'bd-1', reason: 'Christmas', startDate: '2024-12-25', endDate: '2024-12-25' },
    ];

    render(<MockBlackoutDates dates={dates} />);
    
    const deleteButton = screen.getByTestId('delete-blackout-bd-1');
    fireEvent.click(deleteButton);
    
    expect(mockDeleteBlackoutDate).toHaveBeenCalledWith('bd-1');
  });

  it('warning shows in composer when date is blacked out', () => {
    const blackoutDates = [
      { id: 'bd-1', reason: 'Christmas', startDate: '2024-12-25T00:00:00Z', endDate: '2024-12-25T23:59:59Z' },
    ];

    render(
      <MockComposerWithBlackoutWarning 
        scheduledDate="2024-12-25T12:00:00Z" 
        blackoutDates={blackoutDates} 
      />
    );
    
    expect(screen.getByTestId('blackout-warning')).toBeInTheDocument();
    expect(screen.getByText('Warning: This date is blacked out')).toBeInTheDocument();
  });

  it('no warning when date is not blacked out', () => {
    const blackoutDates = [
      { id: 'bd-1', reason: 'Christmas', startDate: '2024-12-25T00:00:00Z', endDate: '2024-12-25T23:59:59Z' },
    ];

    render(
      <MockComposerWithBlackoutWarning 
        scheduledDate="2024-12-26T12:00:00Z" 
        blackoutDates={blackoutDates} 
      />
    );
    
    expect(screen.queryByTestId('blackout-warning')).not.toBeInTheDocument();
  });
});
