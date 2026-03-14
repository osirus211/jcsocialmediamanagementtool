/**
 * Offline Support Hook
 * 
 * Handles offline draft editing with local storage and sync on reconnect
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { draftCollaborationService } from '../services/draft-collaboration.service';

interface OfflineChange {
  id: string;
  draftId: string;
  field: string;
  content: string;
  timestamp: Date;
  synced: boolean;
}

interface UseOfflineSupportOptions {
  draftId: string;
  onConflict?: (localChanges: OfflineChange[], remoteContent: string) => void;
  onSyncComplete?: (syncedChanges: OfflineChange[]) => void;
}

export const useOfflineSupport = ({
  draftId,
  onConflict,
  onSyncComplete
}: UseOfflineSupportOptions) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState<OfflineChange[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const storageKey = `draft_offline_${draftId}`;

  // Load pending changes from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const changes = JSON.parse(stored).map((change: any) => ({
          ...change,
          timestamp: new Date(change.timestamp)
        }));
        setPendingChanges(changes);
      } catch (error) {
        console.error('Failed to load offline changes:', error);
        localStorage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  // Save pending changes to localStorage
  const savePendingChanges = useCallback((changes: OfflineChange[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(changes));
    } catch (error) {
      console.error('Failed to save offline changes:', error);
    }
  }, [storageKey]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Attempt to sync when coming back online
      if (pendingChanges.length > 0) {
        syncPendingChanges();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingChanges]);

  // Add offline change
  const addOfflineChange = useCallback((field: string, content: string) => {
    const change: OfflineChange = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      draftId,
      field,
      content,
      timestamp: new Date(),
      synced: false
    };

    const newChanges = [...pendingChanges, change];
    setPendingChanges(newChanges);
    savePendingChanges(newChanges);

    // If online, try to sync after a delay
    if (isOnline) {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        syncPendingChanges();
      }, 2000);
    }

    return change;
  }, [draftId, pendingChanges, savePendingChanges, isOnline]);

  // Sync pending changes
  const syncPendingChanges = useCallback(async () => {
    if (!isOnline || pendingChanges.length === 0 || isSyncing) {
      return;
    }

    setIsSyncing(true);

    try {
      // Get the latest content from server first
      const response = await fetch(`/api/v1/drafts/${draftId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch latest draft');
      }

      const { data: remoteDraft } = await response.json();
      
      // Check for conflicts
      const unsyncedChanges = pendingChanges.filter(change => !change.synced);
      const hasConflicts = unsyncedChanges.length > 0 && 
        remoteDraft.lastEditedAt && 
        new Date(remoteDraft.lastEditedAt) > unsyncedChanges[0].timestamp;

      if (hasConflicts) {
        // Let the parent component handle conflicts
        onConflict?.(unsyncedChanges, remoteDraft.content);
        return;
      }

      // Apply changes sequentially
      const syncedChanges: OfflineChange[] = [];
      
      for (const change of unsyncedChanges) {
        try {
          // Send the change to the server
          const syncResponse = await fetch(`/api/v1/drafts/${draftId}/autosave`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
              content: change.content,
              version: remoteDraft.version
            })
          });

          if (syncResponse.ok) {
            const syncData = await syncResponse.json();
            if (!syncData.data.conflict) {
              // Mark as synced
              change.synced = true;
              syncedChanges.push(change);
              remoteDraft.version = syncData.data.version;
            }
          }
        } catch (error) {
          console.error('Failed to sync change:', error);
          break; // Stop syncing on error
        }
      }

      // Update pending changes
      const remainingChanges = pendingChanges.filter(change => !change.synced);
      setPendingChanges(remainingChanges);
      savePendingChanges(remainingChanges);

      setLastSyncAt(new Date());
      onSyncComplete?.(syncedChanges);

      // Notify real-time service
      if (syncedChanges.length > 0) {
        const lastChange = syncedChanges[syncedChanges.length - 1];
        draftCollaborationService.sendContentChange({
          field: lastChange.field,
          content: lastChange.content,
          version: remoteDraft.version
        });
      }

    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [
    isOnline, 
    pendingChanges, 
    isSyncing, 
    draftId, 
    onConflict, 
    onSyncComplete, 
    savePendingChanges
  ]);

  // Manual sync trigger
  const forcSync = useCallback(() => {
    if (isOnline && pendingChanges.length > 0) {
      syncPendingChanges();
    }
  }, [isOnline, pendingChanges, syncPendingChanges]);

  // Clear all offline data
  const clearOfflineData = useCallback(() => {
    setPendingChanges([]);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  // Get offline status info
  const getOfflineStatus = useCallback(() => {
    const unsyncedCount = pendingChanges.filter(change => !change.synced).length;
    
    return {
      isOnline,
      hasPendingChanges: pendingChanges.length > 0,
      unsyncedChanges: unsyncedCount,
      isSyncing,
      lastSyncAt,
      canSync: isOnline && unsyncedCount > 0 && !isSyncing
    };
  }, [isOnline, pendingChanges, isSyncing, lastSyncAt]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    isOnline,
    pendingChanges,
    isSyncing,
    lastSyncAt,
    addOfflineChange,
    syncPendingChanges,
    forcSync,
    clearOfflineData,
    getOfflineStatus
  };
};