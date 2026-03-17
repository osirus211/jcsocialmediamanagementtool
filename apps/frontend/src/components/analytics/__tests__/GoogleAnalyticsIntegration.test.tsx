import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GoogleAnalyticsIntegration } from '../GoogleAnalyticsIntegration';

// Mock fetch
global.fetch = vi.fn();

// Mock window.confirm
global.confirm = vi.fn();

describe('GoogleAnalyticsIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ isConnected: false })
    });
  });

  it('renders loading state initially', () => {
    render(<GoogleAnalyticsIntegration />);
    expect(screen.getByText(/loading google analytics/i)).toBeInTheDocument();
  });

  it('renders not connected state', async () => {
    render(<GoogleAnalyticsIntegration />);
    
    await waitFor(() => {
      expect(screen.getByText('Not Connected')).toBeInTheDocument();
      expect(screen.getByText(/connect your google analytics/i)).toBeInTheDocument();
    });
  });

  it('renders connected state', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        isConnected: true,
        propertyId: 'GA-123456',
        propertyName: 'My Website',
        connectedAt: '2024-01-01T00:00:00Z',
        lastSyncAt: '2024-01-15T00:00:00Z'
      })
    });

    render(<GoogleAnalyticsIntegration />);
    
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('My Website')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
    });
  });

  it('handles disconnect flow with confirmation', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          isConnected: true,
          propertyId: 'GA-123456'
        })
      })
      .mockResolvedValueOnce({
        ok: true
      });

    (global.confirm as any).mockReturnValue(true);

    render(<GoogleAnalyticsIntegration />);
    
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
    fireEvent.click(disconnectButton);

    expect(global.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Are you sure you want to disconnect')
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/integrations/google-analytics', {
        method: 'DELETE'
      });
    });
  });

  it('cancels disconnect when user declines confirmation', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        isConnected: true,
        propertyId: 'GA-123456'
      })
    });

    (global.confirm as any).mockReturnValue(false);

    render(<GoogleAnalyticsIntegration />);
    
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
    fireEvent.click(disconnectButton);

    expect(global.confirm).toHaveBeenCalled();
    
    // Should not make DELETE request
    expect(global.fetch).toHaveBeenCalledTimes(1); // Only the initial load
  });
});