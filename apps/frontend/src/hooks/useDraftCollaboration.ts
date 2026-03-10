/**
 * Draft Collaboration Hook
 * 
 * Manages collaborative editing state for draft posts
 * - Acquires/releases edit locks
 * - Polls for status changes
 * - Handles auto-saving with conflict detection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { draftsService, DraftStatus, PlatformContent } from '../services/drafts.service';

interface UseDraftCollaborationOptions {
  postId: string | null;
  onConflict?: () => void;
  onLockStolen?: () => void;
}

interface UseDraftCollaborationReturn {
  isLocked: boolean;
  lockedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  lockExpiresAt?: string;
  isSaving: boolean;
  lastSaved?: Date;
  conflictDetected: boolean;
  autoSave: (content: string, platformContent?: PlatformContent[]) => void;
  takeover: () => Promise<void>;
}

export function useDraftCollaboration({
  postId,
  onConflict,
  onLockStolen,
}: UseDraftCollaborationOptions): UseDraftCollaborationReturn {
  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<DraftStatus['lockedBy']>();
  const [lockExpiresAt, setLockExpiresAt] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>();
  const [conflictDetected, setConflictDetected] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(1);

  const renewIntervalRef = useRef<NodeJS.Timeout>();
  const statusIntervalRef = useRef<NodeJS.Timeout>();
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const hasLockRef = useRef(false);

  /**
   * Acquire edit lock
   */
  const acquireLock = useCallback(async () => {
    if (!postId) return;

    try {
      const result = await draftsService.acquireLock(postId);
      
      if (result.success) {
        setIsLocked(false); // We have the lock, so not locked by others
        setLockedBy(undefined);
        setLockExpiresAt(result.lockExpiresAt);
        hasLockRef.current = true;
        
        // Start renewing lock every 30 seconds
        renewIntervalRef.current = setInterval(async () => {
          try {
            await draftsService.renewLock(postId);
          } catch (error) {
            console.error('Failed to renew lock:', error);
            // Lock might have been stolen
            if (onLockStolen) {
              onLockStolen();
            }
          }
        }, 30000);
      } else {
        // Locked by another user
        setIsLocked(true);
        setLockedBy(result.lockedBy);
        setLockExpiresAt(result.lockExpiresAt);
        hasLockRef.current = false;
      }
    } catch (error) {
      console.error('Failed to acquire lock:', error);
      hasLockRef.current = false;
    }
  }, [postId, onLockStolen]);

  /**
   * Release edit lock
   */
  const releaseLock = useCallback(async () => {
    if (!postId || !hasLockRef.current) return;

    try {
      await draftsService.releaseLock(postId);
      hasLockRef.current = false;
    } catch (error) {
      console.error('Failed to release lock:', error);
    }
  }, [postId]);

  /**
   * Poll for draft status changes
   */
  const pollStatus = useCallback(async () => {
    if (!postId) return;

    try {
      const status = await draftsService.getDraftStatus(postId);
      
      // Check if someone else has the lock
      const isLockedByOther = status.lockedBy && 
        status.lockExpiresAt && 
        new Date(status.lockExpiresAt) > new Date();

      if (isLockedByOther && !hasLockRef.current) {
        setIsLocked(true);
        setLockedBy(status.lockedBy);
        setLockExpiresAt(status.lockExpiresAt);
      } else if (!isLockedByOther && hasLockRef.current) {
        setIsLocked(false);
        setLockedBy(undefined);
        setLockExpiresAt(undefined);
      }

      // Check for version changes (potential conflicts)
      if (status.version !== currentVersion && hasLockRef.current) {
        setConflictDetected(true);
        if (onConflict) {
          onConflict();
        }
      }
      
      setCurrentVersion(status.version);
    } catch (error) {
      console.error('Failed to poll draft status:', error);
    }
  }, [postId, currentVersion, onConflict]);

  /**
   * Auto-save with debouncing
   */
  const autoSave = useCallback((content: string, platformContent?: PlatformContent[]) => {
    if (!postId || !hasLockRef.current || conflictDetected) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Debounce auto-save by 2 seconds
    autoSaveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      
      try {
        const result = await draftsService.autoSave(
          postId,
          content,
          platformContent,
          currentVersion
        );

        if (result.conflict) {
          setConflictDetected(true);
          if (onConflict) {
            onConflict();
          }
        } else if (result.saved) {
          setCurrentVersion(result.version);
          setLastSaved(new Date());
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    }, 2000);
  }, [postId, currentVersion, conflictDetected, onConflict]);

  /**
   * Take over editing from another user
   */
  const takeover = useCallback(async () => {
    if (!postId) return;

    try {
      // Force acquire lock (this will steal it from the other user)
      const result = await draftsService.acquireLock(postId);
      
      if (result.success) {
        setIsLocked(false);
        setLockedBy(undefined);
        setLockExpiresAt(result.lockExpiresAt);
        setConflictDetected(false);
        hasLockRef.current = true;

        // Start renewing lock
        renewIntervalRef.current = setInterval(async () => {
          try {
            await draftsService.renewLock(postId);
          } catch (error) {
            console.error('Failed to renew lock:', error);
          }
        }, 30000);
      }
    } catch (error) {
      console.error('Failed to take over lock:', error);
    }
  }, [postId]);

  // Initialize lock on mount
  useEffect(() => {
    if (postId) {
      acquireLock();
      
      // Start polling for status changes every 10 seconds
      statusIntervalRef.current = setInterval(pollStatus, 10000);
    }

    return () => {
      // Cleanup on unmount
      if (renewIntervalRef.current) {
        clearInterval(renewIntervalRef.current);
      }
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      // Release lock
      releaseLock();
    };
  }, [postId, acquireLock, pollStatus, releaseLock]);

  return {
    isLocked,
    lockedBy,
    lockExpiresAt,
    isSaving,
    lastSaved,
    conflictDetected,
    autoSave,
    takeover,
  };
}