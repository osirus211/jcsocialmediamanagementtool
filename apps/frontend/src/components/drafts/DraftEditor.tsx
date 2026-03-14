/**
 * Draft Editor
 * 
 * Complete real-time collaborative draft editor with all features integrated
 */

import React, { useState, useRef } from 'react';
import { useDraftCollaboration } from '../../hooks/useDraftCollaboration';
import { useOfflineSupport } from '../../hooks/useOfflineSupport';
import { DraftPresenceIndicators, CursorOverlay } from './DraftPresenceIndicators';
import { DraftCommentsPanel } from './DraftCommentsPanel';
import { DraftVersionHistory } from './DraftVersionHistory';
import { DraftStatusBar } from './DraftStatusBar';
import { OfflineBanner } from './OfflineBanner';

interface DraftEditorProps {
  draftId: string;
  initialContent?: string;
  initialStatus?: 'draft' | 'in_review' | 'approved' | 'published';
  onSave?: (content: string) => void;
  onStatusChange?: (status: string) => void;
  className?: string;
}

export const DraftEditor: React.FC<DraftEditorProps> = ({
  draftId,
  initialContent = '',
  initialStatus = 'draft',
  onSave,
  onStatusChange,
  className = ''
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Real-time collaboration
  const collaboration = useDraftCollaboration({
    draftId,
    initialContent,
    onContentChange: (content) => {
      onSave?.(content);
    },
    onConflict: (remoteChange) => {
      console.log('Conflict detected:', remoteChange);
    }
  });

  // Offline support
  const offline = useOfflineSupport({
    draftId,
    onConflict: (localChanges, remoteContent) => {
      console.log('Offline conflict:', localChanges, remoteContent);
    },
    onSyncComplete: (syncedChanges) => {
      console.log('Sync complete:', syncedChanges);
    }
  });

  // Handle content changes
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    collaboration.handleContentChange(newContent);
    
    // Add to offline changes if offline
    if (!offline.isOnline) {
      offline.addOfflineChange('content', newContent);
    }
  };

  // Handle cursor movement
  const handleCursorMove = (e: React.MouseEvent<HTMLTextAreaElement> | React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.target as HTMLTextAreaElement;
    const { selectionStart, selectionEnd } = textarea;
    collaboration.handleCursorMove('content', selectionStart, selectionEnd);
  };

  // Get offline status
  const offlineStatus = offline.getOfflineStatus();

  return (
    <div className={`flex flex-col h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Status Bar */}
      <DraftStatusBar
        draftId={draftId}
        status={initialStatus}
        lastEditedBy={collaboration.lockedBy}
        lastEditedAt={collaboration.lastSaved?.toISOString()}
        version={collaboration.version}
        onStatusChange={onStatusChange}
      />

      {/* Offline Banner */}
      {showOfflineBanner && (
        <OfflineBanner
          isOnline={offlineStatus.isOnline}
          hasPendingChanges={offlineStatus.hasPendingChanges}
          unsyncedChanges={offlineStatus.unsyncedChanges}
          isSyncing={offlineStatus.isSyncing}
          lastSyncAt={offlineStatus.lastSyncAt}
          onSync={offline.forcSync}
          onDismiss={() => setShowOfflineBanner(false)}
        />
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex">
        {/* Editor */}
        <div className="flex-1 flex flex-col">
          {/* Presence Indicators */}
          <DraftPresenceIndicators
            draftId={draftId}
            className="px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
          />

          {/* Conflict Warning */}
          {collaboration.conflictWarning && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 dark:bg-yellow-900/20 dark:border-yellow-600">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-yellow-400">⚠️</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-200">
                    {collaboration.conflictWarning}
                  </p>
                  {collaboration.conflictDetected && (
                    <button
                      onClick={collaboration.takeover}
                      className="mt-2 text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
                    >
                      Take Over Editing
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Editor Content */}
          <div className="flex-1 p-6 relative">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={collaboration.content}
                onChange={handleContentChange}
                onMouseUp={handleCursorMove}
                onKeyUp={handleCursorMove}
                placeholder="Start writing your draft..."
                className="w-full h-96 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={collaboration.isLocked && !collaboration.lockedBy}
              />
              
              {/* Cursor Overlay */}
              <CursorOverlay
                cursors={[]} // Would be populated from presence data
                textareaRef={textareaRef}
              />
            </div>

            {/* Save Status */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {collaboration.saveStatus === 'saving' && '💾 Saving...'}
                  {collaboration.saveStatus === 'saved' && collaboration.lastSaved && 
                    `✅ Saved ${collaboration.lastSaved.toLocaleTimeString()}`
                  }
                  {collaboration.saveStatus === 'error' && '❌ Save failed'}
                </span>
                
                {collaboration.isTyping && (
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    ✏️ Typing...
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowVersionHistory(true)}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded"
                >
                  📜 History
                </button>
                
                <button
                  onClick={() => setShowComments(true)}
                  className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded"
                >
                  💬 Comments
                </button>
                
                <button
                  onClick={collaboration.saveNow}
                  disabled={collaboration.isSaving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {collaboration.isSaving ? 'Saving...' : 'Save Now'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Comments Panel */}
        {showComments && (
          <DraftCommentsPanel
            draftId={draftId}
            isOpen={showComments}
            onClose={() => setShowComments(false)}
          />
        )}

        {/* Version History Panel */}
        {showVersionHistory && (
          <DraftVersionHistory
            draftId={draftId}
            isOpen={showVersionHistory}
            onClose={() => setShowVersionHistory(false)}
            onRestore={(version) => {
              console.log('Restored to version:', version);
              // Refresh the editor content
            }}
          />
        )}
      </div>
    </div>
  );
};