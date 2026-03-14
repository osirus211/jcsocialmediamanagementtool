/**
 * Draft Collaboration Service
 * 
 * Real-time collaboration client using Socket.io
 */

import { io, Socket } from 'socket.io-client';

export interface DraftUser {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
}

export interface CursorPosition {
  userId: string;
  field: string;
  selectionStart: number;
  selectionEnd: number;
  timestamp: Date;
}

export interface ContentChange {
  userId: string;
  field: string;
  content: string;
  version: number;
  timestamp: Date;
}

export interface DraftPresence {
  users: DraftUser[];
  cursors: CursorPosition[];
  activeUsers: number;
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  isTyping: boolean;
}

export type DraftCollaborationEventHandler = {
  'presence-update': (data: { presence: DraftPresence }) => void;
  'user-joined': (data: { user: DraftUser; presence: DraftPresence }) => void;
  'user-left': (data: { userId: string; presence: DraftPresence }) => void;
  'content-changed': (data: ContentChange & { userName: string }) => void;
  'cursor-moved': (data: { cursor: CursorPosition; user: DraftUser }) => void;
  'typing-changed': (data: TypingIndicator) => void;
  'draft-saved': (data: { version: number; savedBy: string; timestamp: Date }) => void;
  'draft-locked': (data: { lockedBy: DraftUser; lockExpiresAt: Date }) => void;
  'draft-unlocked': (data: { timestamp: Date }) => void;
  'comment-added': (data: { comment: any; timestamp: Date }) => void;
  'error': (data: { message: string }) => void;
};

export class DraftCollaborationService {
  private socket: Socket | null = null;
  private currentDraftId: string | null = null;
  private eventHandlers: Map<string, Set<Function>> = new Map();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.initializeSocket();
  }

  private initializeSocket() {
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.warn('No auth token found for Socket.io connection');
      return;
    }

    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    this.socket = io(serverUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.setupSocketEventHandlers();
  }

  private setupSocketEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to draft collaboration server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Rejoin current draft if we were in one
      if (this.currentDraftId) {
        this.joinDraft(this.currentDraftId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from draft collaboration server:', reason);
      this.isConnected = false;
      
      if (reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
      this.isConnected = false;
      this.attemptReconnect();
    });

    // Draft collaboration events
    this.socket.on('draft:presence-update', (data) => {
      this.emit('presence-update', data);
    });

    this.socket.on('draft:user-joined', (data) => {
      this.emit('user-joined', data);
    });

    this.socket.on('draft:user-left', (data) => {
      this.emit('user-left', data);
    });

    this.socket.on('draft:content-changed', (data) => {
      this.emit('content-changed', data);
    });

    this.socket.on('draft:cursor-moved', (data) => {
      this.emit('cursor-moved', data);
    });

    this.socket.on('draft:typing-changed', (data) => {
      this.emit('typing-changed', data);
    });

    this.socket.on('draft:saved', (data) => {
      this.emit('draft-saved', data);
    });

    this.socket.on('draft:locked', (data) => {
      this.emit('draft-locked', data);
    });

    this.socket.on('draft:unlocked', (data) => {
      this.emit('draft-unlocked', data);
    });

    this.socket.on('draft:comment-added', (data) => {
      this.emit('comment-added', data);
    });

    this.socket.on('error', (data) => {
      this.emit('error', data);
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  // Event handling
  public on<K extends keyof DraftCollaborationEventHandler>(
    event: K,
    handler: DraftCollaborationEventHandler[K]
  ) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  public off<K extends keyof DraftCollaborationEventHandler>(
    event: K,
    handler: DraftCollaborationEventHandler[K]
  ) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit<K extends keyof DraftCollaborationEventHandler>(
    event: K,
    data: Parameters<DraftCollaborationEventHandler[K]>[0]
  ) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          (handler as any)(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  // Draft collaboration methods
  public joinDraft(draftId: string) {
    if (!this.socket || !this.isConnected) {
      console.warn('Socket not connected, cannot join draft');
      return;
    }

    this.currentDraftId = draftId;
    this.socket.emit('draft:join', { draftId });
  }

  public leaveDraft(draftId: string) {
    if (!this.socket) return;

    this.socket.emit('draft:leave', { draftId });
    
    if (this.currentDraftId === draftId) {
      this.currentDraftId = null;
    }
  }

  public sendContentChange(data: Omit<ContentChange, 'userId' | 'timestamp'>) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('draft:content-change', {
      ...data,
      timestamp: new Date()
    });
  }

  public sendCursorMove(data: Omit<CursorPosition, 'userId' | 'timestamp'>) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('draft:cursor-move', {
      ...data,
      timestamp: new Date()
    });
  }

  public sendTypingIndicator(draftId: string, isTyping: boolean) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('draft:typing', { draftId, isTyping });
  }

  // Connection status
  public getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      currentDraftId: this.currentDraftId,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Cleanup
  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.currentDraftId = null;
    this.eventHandlers.clear();
  }

  // Reconnect with new token (for auth refresh)
  public reconnectWithToken(token: string) {
    this.disconnect();
    localStorage.setItem('authToken', token);
    this.initializeSocket();
  }
}

// Singleton instance
export const draftCollaborationService = new DraftCollaborationService();