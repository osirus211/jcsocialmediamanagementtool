/**
 * Draft Collaboration Hook
 * 
 * Manages real-time content synchronization and conflict resolution
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { draftCollaborationService, ContentChange } from '../services/draft-collaboration.service';
import { draftsService } from '../services/drafts.service';

interface UseDraftCollaborationOptions {
  postId?: string;
  draftId?: string;
  initialContent?: string;
  onContentChange?: (content: string) => void;
  onConflict?: (remoteChange?: ContentChange & { userName: string }) => void;
  onLockStolen?: () => void;
  onSaved?: (version: number, savedBy: string) => void;
}

export const useDraftCollaboration = ({
  postId,
  draftId,
  initialContent = '',
  onContentChange,
  onConflict,
  onLockStolen,
  onSaved
}: UseDraftCollaborationOptions) => {
  const actualDraftId = draftId || postId;
  
  if (!actualDraftId) {
    // Return mock collaboration object if no draft ID
    return {
      content: initialContent,
      version: 1,
      lastSaved: null,
      saveStatus: 'saved' as const,
      conflictWarning: null,
      isTyping: false,
      isLocked: false,
      lockedBy: null,
      lockExpiresAt: null,
      isSaving: false,
      conflictDetected: false,
      handleContentChange: () => {},
      handleCursorMove: () => {},
      saveNow: async () => ({ saved: true, version: 1 }),
      autoSave: () => {},
      takeover: () => {}
    };
  }
  const [content, setContent] = useState(initialContent);
  const [version, setVersion] = useState(1);
  const [isTyping, setIsTyping] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<any>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [conflictDetected, setConflictDetected] = useState(false);

  // Refs for debouncing and tracking
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastChangeRef = useRef<Date>(new Date());
  const isRemoteChangeRef = useRef(false);

  // Auto-save every 3 seconds after user stops typing
  const debouncedSave = useCallback(async (contentToSave: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        setIsSaving(true);
        const result = await draftsService.autoSaveDraft(actualDraftId, {
          content: contentToSave,
          version
        });
        
        if (result.conflict) {
          setConflictWarning('Someone else edited this draft. Your changes have been saved but may conflict.');
          setConflictDetected(true);
          setTimeout(() => {
            setConflictWarning(null);
            setConflictDetected(false);
          }, 5000);
        } else {
          setVersion(result.version);
          setLastSaved(new Date());
          setSaveStatus('saved');
          
          // Notify Socket.io that draft was saved
          draftCollaborationService.sendContentChange({
            field: 'content',
            content: contentToSave,
            version: result.version
          });
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('saved'), 3000);
      } finally {
        setIsSaving(false);
      }
    }, 3000);
  }, [actualDraftId, version]);

  // Handle content changes from user input
  const handleContentChange = useCallback((newContent: string, field: string = 'content') => {
    if (isRemoteChangeRef.current) {
      isRemoteChangeRef.current = false;
      return;
    }

    setContent(newContent);
    lastChangeRef.current = new Date();
    
    // Notify parent component
    onContentChange?.(newContent);

    // Send real-time change to other users (debounced)
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Show typing indicator
    if (!isTyping) {
      setIsTyping(true);
      draftCollaborationService.sendTypingIndicator(actualDraftId, true);
    }

    // Broadcast content change after 300ms of no typing
    typingTimeoutRef.current = setTimeout(() => {
      draftCollaborationService.sendContentChange({
        field,
        content: newContent,
        version
      });

      // Hide typing indicator
      setIsTyping(false);
      draftCollaborationService.sendTypingIndicator(actualDraftId, false);

      // Auto-save
      debouncedSave(newContent);
    }, 300);
  }, [actualDraftId, version, isTyping, onContentChange, debouncedSave]);

  // Handle cursor position changes
  const handleCursorMove = useCallback((field: string, selectionStart: number, selectionEnd: number) => {
    draftCollaborationService.sendCursorMove({
      field,
      selectionStart,
      selectionEnd
    });
  }, []);

  useEffect(() => {
    // Handle remote content changes
    const handleRemoteContentChange = (data: ContentChange & { userName: string }) => {
      const timeSinceLastChange = new Date().getTime() - lastChangeRef.current.getTime();
      
      // If user made a change recently (within 1 second), show conflict warning
      if (timeSinceLastChange < 1000 && data.content !== content) {
        onConflict?.(data);
        setConflictWarning(`${data.userName} made changes while you were editing. Check for conflicts.`);
        setConflictDetected(true);
        setTimeout(() => {
          setConflictWarning(null);
          setConflictDetected(false);
        }, 5000);
        return;
      }

      // Apply remote change
      isRemoteChangeRef.current = true;
      setContent(data.content);
      setVersion(data.version);
      onContentChange?.(data.content);
    };

    // Handle draft saved notifications
    const handleDraftSaved = (data: { version: number; savedBy: string; timestamp: Date }) => {
      setVersion(data.version);
      setLastSaved(new Date(data.timestamp));
      onSaved?.(data.version, data.savedBy);
    };

    // Subscribe to events
    draftCollaborationService.on('content-changed', handleRemoteContentChange);
    draftCollaborationService.on('draft-saved', handleDraftSaved);

    return () => {
      // Cleanup
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Stop typing indicator
      if (isTyping) {
        draftCollaborationService.sendTypingIndicator(actualDraftId, false);
      }

      // Unsubscribe from events
      draftCollaborationService.off('content-changed', handleRemoteContentChange);
      draftCollaborationService.off('draft-saved', handleDraftSaved);
    };
  }, [actualDraftId, content, isTyping, onContentChange, onConflict, onSaved]);

  // Manual save function
  const saveNow = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    try {
      setSaveStatus('saving');
      setIsSaving(true);
      const result = await draftsService.autoSaveDraft(actualDraftId, {
        content,
        version
      });
      
      setVersion(result.version);
      setLastSaved(new Date());
      setSaveStatus('saved');
      
      return result;
    } catch (error) {
      setSaveStatus('error');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [actualDraftId, content, version]);

  // Auto-save function for external use
  const autoSave = useCallback((content: string, platformContent?: any[]) => {
    debouncedSave(content);
  }, [debouncedSave]);

  // Takeover function for conflict resolution
  const takeover = useCallback(() => {
    setConflictDetected(false);
    setConflictWarning(null);
  }, []);

  return {
    content,
    version,
    lastSaved,
    saveStatus,
    conflictWarning,
    isTyping,
    isLocked,
    lockedBy,
    lockExpiresAt,
    isSaving,
    conflictDetected,
    handleContentChange,
    handleCursorMove,
    saveNow,
    autoSave,
    takeover
  };
};