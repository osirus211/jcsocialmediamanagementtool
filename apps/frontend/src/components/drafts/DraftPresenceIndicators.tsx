/**
 * Draft Presence Indicators
 * 
 * Shows who is currently viewing/editing a draft with avatar stack and cursors
 */

import React, { useState, useEffect } from 'react';
import { draftCollaborationService, DraftUser, DraftPresence, CursorPosition } from '../../services/draft-collaboration.service';

interface DraftPresenceIndicatorsProps {
  draftId: string;
  className?: string;
}

interface UserCursor extends CursorPosition {
  user: DraftUser;
}

export const DraftPresenceIndicators: React.FC<DraftPresenceIndicatorsProps> = ({
  draftId,
  className = ''
}) => {
  const [presence, setPresence] = useState<DraftPresence | null>(null);
  const [cursors, setCursors] = useState<UserCursor[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Join the draft room
    draftCollaborationService.joinDraft(draftId);

    // Handle presence updates
    const handlePresenceUpdate = (data: { presence: DraftPresence }) => {
      setPresence(data.presence);
    };

    const handleUserJoined = (data: { user: DraftUser; presence: DraftPresence }) => {
      setPresence(data.presence);
      // Show subtle notification
      showJoinNotification(data.user.name);
    };

    const handleUserLeft = (data: { userId: string; presence: DraftPresence }) => {
      setPresence(data.presence);
      // Remove cursors for this user
      setCursors(prev => prev.filter(cursor => cursor.userId !== data.userId));
      // Remove from typing users
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    };

    const handleCursorMoved = (data: { cursor: CursorPosition; user: DraftUser }) => {
      setCursors(prev => {
        const filtered = prev.filter(c => c.userId !== data.cursor.userId);
        return [...filtered, { ...data.cursor, user: data.user }];
      });
    };

    const handleTypingChanged = (data: { userId: string; userName: string; isTyping: boolean }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (data.isTyping) {
          newSet.add(data.userId);
        } else {
          newSet.delete(data.userId);
        }
        return newSet;
      });
    };

    // Subscribe to events
    draftCollaborationService.on('presence-update', handlePresenceUpdate);
    draftCollaborationService.on('user-joined', handleUserJoined);
    draftCollaborationService.on('user-left', handleUserLeft);
    draftCollaborationService.on('cursor-moved', handleCursorMoved);
    draftCollaborationService.on('typing-changed', handleTypingChanged);

    return () => {
      // Unsubscribe from events
      draftCollaborationService.off('presence-update', handlePresenceUpdate);
      draftCollaborationService.off('user-joined', handleUserJoined);
      draftCollaborationService.off('user-left', handleUserLeft);
      draftCollaborationService.off('cursor-moved', handleCursorMoved);
      draftCollaborationService.off('typing-changed', handleTypingChanged);
      
      // Leave the draft room
      draftCollaborationService.leaveDraft(draftId);
    };
  }, [draftId]);

  const showJoinNotification = (userName: string) => {
    // Create a subtle toast notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300';
    notification.textContent = `${userName} joined`;
    document.body.appendChild(notification);

    // Fade out and remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  };

  const getTypingIndicator = () => {
    if (typingUsers.size === 0) return null;

    const typingUserNames = presence?.users
      .filter(user => typingUsers.has(user.userId))
      .map(user => user.name) || [];

    if (typingUserNames.length === 0) return null;

    let text = '';
    if (typingUserNames.length === 1) {
      text = `${typingUserNames[0]} is typing...`;
    } else if (typingUserNames.length === 2) {
      text = `${typingUserNames[0]} and ${typingUserNames[1]} are typing...`;
    } else {
      text = `${typingUserNames.length} people are typing...`;
    }

    return (
      <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
        <div className="flex space-x-1">
          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span>{text}</span>
      </div>
    );
  };

  if (!presence || presence.users.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {/* Avatar Stack */}
      <div className="flex items-center space-x-3">
        <div className="flex -space-x-2">
          {presence.users.slice(0, 5).map((user, index) => (
            <div
              key={user.userId}
              className="relative group"
              style={{ zIndex: presence.users.length - index }}
            >
              <div
                className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-sm font-medium shadow-sm"
                style={{ backgroundColor: user.color }}
                title={user.name}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                {user.name}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900" />
              </div>
            </div>
          ))}
          
          {/* Show +N if more than 5 users */}
          {presence.users.length > 5 && (
            <div className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-500 flex items-center justify-center text-white text-xs font-medium shadow-sm">
              +{presence.users.length - 5}
            </div>
          )}
        </div>

        {/* User count */}
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {presence.users.length === 1 
            ? '1 person viewing' 
            : `${presence.users.length} people viewing`
          }
        </span>
      </div>

      {/* Typing indicator */}
      {getTypingIndicator()}
    </div>
  );
};

// Cursor overlay component for text areas
interface CursorOverlayProps {
  cursors: UserCursor[];
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ cursors, textareaRef }) => {
  const [cursorPositions, setCursorPositions] = useState<{ [userId: string]: { x: number; y: number } }>({});

  useEffect(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const computedStyle = window.getComputedStyle(textarea);
    
    // Create a mirror div to calculate cursor positions
    const mirror = document.createElement('div');
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.font = computedStyle.font;
    mirror.style.padding = computedStyle.padding;
    mirror.style.border = computedStyle.border;
    mirror.style.width = computedStyle.width;
    mirror.style.height = computedStyle.height;
    mirror.style.lineHeight = computedStyle.lineHeight;
    document.body.appendChild(mirror);

    const newPositions: { [userId: string]: { x: number; y: number } } = {};

    cursors.forEach(cursor => {
      if (cursor.field === 'content') {
        const textBeforeCursor = textarea.value.substring(0, cursor.selectionStart);
        mirror.textContent = textBeforeCursor;
        
        // Add a span to measure the cursor position
        const span = document.createElement('span');
        span.textContent = '|';
        mirror.appendChild(span);
        
        const rect = textarea.getBoundingClientRect();
        const spanRect = span.getBoundingClientRect();
        
        newPositions[cursor.userId] = {
          x: spanRect.left - rect.left,
          y: spanRect.top - rect.top
        };
      }
    });

    setCursorPositions(newPositions);
    document.body.removeChild(mirror);
  }, [cursors, textareaRef]);

  if (!textareaRef.current) return null;

  const textareaRect = textareaRef.current.getBoundingClientRect();

  return (
    <div className="absolute inset-0 pointer-events-none">
      {cursors.map(cursor => {
        const position = cursorPositions[cursor.userId];
        if (!position) return null;

        return (
          <div
            key={cursor.userId}
            className="absolute"
            style={{
              left: position.x,
              top: position.y,
              transform: 'translateX(-1px)'
            }}
          >
            {/* Cursor line */}
            <div
              className="w-0.5 h-5 animate-pulse"
              style={{ backgroundColor: cursor.user.color }}
            />
            
            {/* User label */}
            <div
              className="absolute top-0 left-0 transform -translate-y-full px-2 py-1 text-xs text-white rounded shadow-lg whitespace-nowrap"
              style={{ backgroundColor: cursor.user.color }}
            >
              {cursor.user.name}
            </div>
          </div>
        );
      })}
    </div>
  );
};