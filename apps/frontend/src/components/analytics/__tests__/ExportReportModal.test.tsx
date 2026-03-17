import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportReportModal } from '../ExportReportModal';

const mockData = {
  overview: {
    totalImpressions: 10000,
    totalEngagement: 1000,
    engagementRate: 0.1,
    totalPosts: 50,
    growth: { impressions: 5, engagement: 10 }
  },
  platforms: [],
  growth: [],
  hashtags: [],
  bestTimes: [],
  linkClicks: [],
  competitors: []
};

// Mock URL.createObjectURL and URL.revokeObjectURL for CSV export tests
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock document.createElement for CSV download tests
const mockClick = vi.fn();

// Store original createElement to use for non-anchor elements
const originalCreateElement = document.createElement.bind(document);

// Mock createElement to return proper mock for anchor elements
vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
  if (tagName === 'a') {
    // Return a mock anchor element with the methods we need
    const mockAnchor = {
      href: '',
      download: '',
      click: mockClick,
      style: {},
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      removeAttribute: vi.fn(),
    };
    return mockAnchor as any;
  }
  // For other elements, use the original createElement
  return originalCreateElement(tagName);
});

// Mock document.body methods to prevent DOM manipulation errors
vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

// Mock fetch for API call verification
global.fetch = vi.fn();

describe('ExportReportModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    dateRange: {
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-01-31T23:59:59Z'
    },
    data: mockData
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal when open', async () => {
    const simpleProps = {
      isOpen: true,
      onClose: vi.fn(),
      dateRange: {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z'
      }
    };
    
    const { container } = render(<ExportReportModal {...simpleProps} />);
    
    // Wait for any async rendering
    await waitFor(() => {
      expect(container.innerHTML).not.toBe('');
    });
    
    // Now check for the title
    expect(container.textContent).toContain('Export Analytics Report');
  });

  it('does not render when closed', () => {
    render(<ExportReportModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Export Analytics Report')).not.toBeInTheDocument();
  });

  it('exports CSV client-side without API calls', async () => {
    render(<ExportReportModal {...defaultProps} />);
    
    // First click CSV format button to switch from PDF to CSV
    const csvFormatButton = screen.getByRole('button', { name: 'CSV' });
    fireEvent.click(csvFormatButton);
    
    // Now click the export button (should be "Export CSV")
    const exportButton = screen.getByRole('button', { name: /export csv/i });
    fireEvent.click(exportButton);

    // Wait for the CSV generation to complete
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    // Verify no fetch calls were made (client-side generation)
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('allows toggling export options', () => {
    render(<ExportReportModal {...defaultProps} />);
    
    const overviewCheckbox = screen.getByLabelText(/overview metrics/i);
    expect(overviewCheckbox).toBeChecked();
    
    // Click the checkbox to toggle it
    fireEvent.click(overviewCheckbox);
    
    // The checkbox should now be unchecked
    expect(overviewCheckbox).not.toBeChecked();
  });

  it('calls onClose when cancel button clicked', () => {
    const onClose = vi.fn();
    render(<ExportReportModal {...defaultProps} onClose={onClose} />);
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    
    expect(onClose).toHaveBeenCalled();
  });
});