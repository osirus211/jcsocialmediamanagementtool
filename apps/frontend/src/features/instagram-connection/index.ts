/**
 * Instagram Connection Feature - Main Export
 * 
 * Public API for the Instagram Business account connection feature
 */

// Types
export * from './types';

// Components
export { PreConnectionChecklist } from './components/PreConnectionChecklist';
export { SetupInstructionsModal } from './components/SetupInstructionsModal';
export { ConnectionFlowOrchestrator } from './components/ConnectionFlowOrchestrator';
export { InstagramConnectionFlow } from './components/InstagramConnectionFlow';
export { AccountSelectionDialog } from './components/AccountSelectionDialog';
export { DiagnosticPanel } from './components/DiagnosticPanel';
// export { TokenExpirationWarning } from './components/TokenExpirationWarning';

// Store
export { useInstagramConnectionStore } from './store/instagram-connection.store';

// Services
export { instagramConnectionService } from './services/instagram-connection.service';

// Utils
export * from './utils/error-categorization';

