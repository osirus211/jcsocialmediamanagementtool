/**
 * Unit Tests for InstagramConnectionFlow
 * 
 * Requirements: All requirements (integration)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { InstagramConnectionFlow } from '../InstagramConnectionFlow';
import { useInstagramConnectionStore } from '../../store/instagram-connection.store';

// Mock the service
vi.mock('../../services/instagram-connection.service', () => ({
  instagramConnectionService: {
    initiateOAuth: vi.fn().mockResolvedValue({
      success: true,
      authorizationUrl: 'https://facebook.com/oauth',
      state: 'test-state',
      platform: 'instagram',
    }),
    checkConnectionStatus: vi.fn().mockResolvedValue({
      success: true,
      accounts: [],
    }),
  },
}));

// Mock window.location
delete (window as any).location;
(window as any).location = { href: '', search: '', pathname: '/' };

// Mock window.history
(window as any).history = {
  replaceState: vi.fn(),
};

describe('InstagramConnectionFlow', () => {
  beforeEach(() => {
    // Reset store
    const store = useInstagramConnectionStore.getState();
    store.resetChecklist();
    store.clearError();
    store.setConnectionState({ step: 'idle', progress: 0, message: '' });
    
    // Reset window.location
    (window as any).location.href = '';
    (window as any).location.search = '';
    (window as any).location.pathname = '/';
  });

  it('should render PreConnectionChecklist when checklist not completed', () => {
    render(<InstagramConnectionFlow />);
    
    expect(screen.getByText(/Instagram Business or Creator Account/i)).toBeInTheDocument();
  });

  it('should not render ConnectionFlowOrchestrator when idle', () => {
    render(<InstagramConnectionFlow />);
    
    // ConnectionFlowOrchestrator doesn't render when step is 'idle'
    expect(screen.queryByText(/Connecting Instagram/i)).not.toBeInTheDocument();
  });

  it('should handle OAuth callback on mount', async () => {
    // Set up URL params as if backend OAuth callback (success)
    (window as any).location.search = '?success=true&platform=instagram&count=2';
    
    render(<InstagramConnectionFlow />);
    
    // Wait for callback to be processed
    await waitFor(() => {
      const state = useInstagramConnectionStore.getState();
      expect(state.connectionState.step).toBe('complete');
    });
    
    // Verify URL was cleaned
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('should call onComplete when connection completes', async () => {
    const onComplete = vi.fn();
    
    render(<InstagramConnectionFlow onComplete={onComplete} />);
    
    // Simulate connection completion
    const store = useInstagramConnectionStore.getState();
    store.setConnectionState({
      step: 'complete',
      progress: 100,
      message: 'Success!',
    });
    
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
