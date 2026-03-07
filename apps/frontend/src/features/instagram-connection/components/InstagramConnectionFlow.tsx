/**
 * InstagramConnectionFlow Component
 * 
 * Main component that orchestrates the Instagram connection flow
 * Connects UI components to the Zustand store
 * 
 * Requirements: All requirements (integration)
 */

import { useEffect, useState } from 'react';
import { useInstagramConnectionStore } from '../store/instagram-connection.store';
import { ConnectionFlowOrchestrator } from './ConnectionFlowOrchestrator';
import { PreConnectionChecklist } from './PreConnectionChecklist';
import { AccountSelectionDialog } from './AccountSelectionDialog';
import { DiagnosticPanel } from './DiagnosticPanel';
import { SetupInstructionsModal } from './SetupInstructionsModal';
import { categorizeError } from '../utils/error-categorization';

interface InstagramConnectionFlowProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function InstagramConnectionFlow({
  onComplete,
  onCancel,
}: InstagramConnectionFlowProps) {
  const {
    checklistCompleted,
    connectionState,
    discoveredAccounts,
    lastError,
    startConnection,
    handleOAuthCallback,
    retryConnection,
    saveSelectedAccounts,
  } = useInstagramConnectionStore();

  const [showInstructions, setShowInstructions] = useState(false);
  const [showAccountSelection, setShowAccountSelection] = useState(false);

  // Handle OAuth callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check for backend OAuth callback (success/error from /social/accounts redirect)
    const success = urlParams.get('success');
    const platform = urlParams.get('platform');
    const count = urlParams.get('count');
    const error = urlParams.get('error');
    const message = urlParams.get('message');

    // Handle success callback from backend
    if (success === 'true' && platform === 'instagram') {
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Simulate successful connection
      const accountCount = parseInt(count || '0', 10);
      
      // Update store to show success
      const store = useInstagramConnectionStore.getState();
      store.setConnectionState({
        step: 'complete',
        progress: 100,
        message: `Successfully connected ${accountCount} Instagram ${accountCount === 1 ? 'account' : 'accounts'}!`,
      });
      
      // Trigger completion callback
      if (onComplete) {
        onComplete();
      }
    }
    // Handle error callback from backend
    else if (error) {
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Categorize and display error
      const errorMessage = decodeURIComponent(message || 'Connection failed');
      const categorizedError = categorizeError(new Error(errorMessage));
      
      const store = useInstagramConnectionStore.getState();
      store.setError(categorizedError);
    }
  }, [onComplete]);

  // Show account selection when accounts are discovered
  useEffect(() => {
    if (connectionState.step === 'complete' && discoveredAccounts.length > 0) {
      setShowAccountSelection(true);
    }
  }, [connectionState.step, discoveredAccounts]);

  // Handle connection completion
  const handleComplete = () => {
    setShowAccountSelection(false);
    if (onComplete) {
      onComplete();
    }
  };

  // Handle connection error
  const handleError = (error: any) => {
    console.error('Connection error:', error);
    // Error is already in store, just log it
  };

  // Handle checklist proceed
  const handleProceed = () => {
    startConnection();
  };

  // Handle account save
  const handleSaveAccounts = async (selectedIds: string[]) => {
    await saveSelectedAccounts();
    handleComplete();
  };

  // Handle retry from diagnostic panel
  const handleRetry = () => {
    retryConnection();
  };

  return (
    <div className="instagram-connection-flow">
      {/* Show checklist if not completed and not in connection flow */}
      {!checklistCompleted && connectionState.step === 'idle' && (
        <PreConnectionChecklist onProceed={handleProceed} />
      )}

      {/* Show connection orchestrator during connection flow */}
      <ConnectionFlowOrchestrator
        connectionState={connectionState}
        onComplete={handleComplete}
        onError={handleError}
      />

      {/* Show account selection dialog when accounts are discovered */}
      {showAccountSelection && (
        <AccountSelectionDialog
          accounts={discoveredAccounts}
          onSave={handleSaveAccounts}
          onCancel={onCancel}
          isOpen={showAccountSelection}
        />
      )}

      {/* Show diagnostic panel on error */}
      {connectionState.step === 'error' && lastError && (
        <DiagnosticPanel
          error={lastError}
          diagnosticData={null}
          onRetry={handleRetry}
          onOpenInstructions={() => setShowInstructions(true)}
        />
      )}

      {/* Setup instructions modal */}
      <SetupInstructionsModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </div>
  );
}
