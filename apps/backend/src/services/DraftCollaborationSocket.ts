/**
 * Draft Collaboration Socket Service
 * 
 * Real-time collaboration features for draft editing using Socket.io
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { Post, PostStatus } from '../models/Post';
import { logger } from '../utils/logger';

export interface DraftUser {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  color: string; // Assigned cursor color
}

export interface CursorPosition {
  userId: string;
  field: string; // 'content' | 'caption' | etc
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
  draftId: string;
  users: DraftUser[];
  cursors: CursorPosition[];
  lastActivity: { [userId: string]: Date };
}

export class DraftCollaborationSocket {
  private io: SocketIOServer;
  private draftPresence: Map<string, DraftPresence> = new Map();
  private userColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
  ];

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/socket.io/'
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startCleanupInterval();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        
        // Attach user info to socket
        socket.data.user = {
          userId: decoded.userId,
          name: decoded.name || decoded.email,
          email: decoded.email,
          workspaceId: decoded.workspaceId
        };

        next();
      } catch (error) {
        logger.error('Socket authentication failed', { error });
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      logger.debug('User connected to draft collaboration', {
        userId: socket.data.user?.userId,
        socketId: socket.id
      });

      // Join draft room
      socket.on('draft:join', async (data: { draftId: string }) => {
        await this.handleJoinDraft(socket, data.draftId);
      });

      // Leave draft room
      socket.on('draft:leave', (data: { draftId: string }) => {
        this.handleLeaveDraft(socket, data.draftId);
      });

      // Content change
      socket.on('draft:content-change', (data: ContentChange) => {
        this.handleContentChange(socket, data);
      });

      // Cursor movement
      socket.on('draft:cursor-move', (data: CursorPosition) => {
        this.handleCursorMove(socket, data);
      });

      // Typing indicator
      socket.on('draft:typing', (data: { draftId: string; isTyping: boolean }) => {
        this.handleTypingIndicator(socket, data);
      });

      // Disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private async handleJoinDraft(socket: Socket, draftId: string) {
    try {
      const user = socket.data.user;
      
      // Verify user has access to this draft
      const draft = await Post.findOne({
        _id: draftId,
        workspaceId: user.workspaceId,
        status: PostStatus.DRAFT
      });

      if (!draft) {
        socket.emit('error', { message: 'Draft not found or access denied' });
        return;
      }

      // Join the room
      socket.join(`draft:${draftId}`);

      // Get or create presence for this draft
      let presence = this.draftPresence.get(draftId);
      if (!presence) {
        presence = {
          draftId,
          users: [],
          cursors: [],
          lastActivity: {}
        };
        this.draftPresence.set(draftId, presence);
      }

      // Add user if not already present
      const existingUser = presence.users.find(u => u.userId === user.userId);
      if (!existingUser) {
        const draftUser: DraftUser = {
          userId: user.userId,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          color: this.assignUserColor(presence.users.length)
        };
        presence.users.push(draftUser);
      }

      // Update last activity
      presence.lastActivity[user.userId] = new Date();

      // Notify others in the room
      socket.to(`draft:${draftId}`).emit('draft:user-joined', {
        user: existingUser || presence.users[presence.users.length - 1],
        presence: this.getPublicPresence(presence)
      });

      // Send current presence to the joining user
      socket.emit('draft:presence-update', {
        presence: this.getPublicPresence(presence)
      });

      logger.debug('User joined draft', { userId: user.userId, draftId });
    } catch (error) {
      logger.error('Error joining draft', { draftId, error });
      socket.emit('error', { message: 'Failed to join draft' });
    }
  }

  private handleLeaveDraft(socket: Socket, draftId: string) {
    const user = socket.data.user;
    
    socket.leave(`draft:${draftId}`);

    const presence = this.draftPresence.get(draftId);
    if (presence) {
      // Remove user from presence
      presence.users = presence.users.filter(u => u.userId !== user.userId);
      presence.cursors = presence.cursors.filter(c => c.userId !== user.userId);
      delete presence.lastActivity[user.userId];

      // Clean up empty presence
      if (presence.users.length === 0) {
        this.draftPresence.delete(draftId);
      } else {
        // Notify others
        socket.to(`draft:${draftId}`).emit('draft:user-left', {
          userId: user.userId,
          presence: this.getPublicPresence(presence)
        });
      }
    }

    logger.debug('User left draft', { userId: user.userId, draftId });
  }

  private handleContentChange(socket: Socket, data: ContentChange) {
    const user = socket.data.user;
    const draftId = this.getDraftIdFromSocket(socket);
    
    if (!draftId) return;

    // Update last activity
    const presence = this.draftPresence.get(draftId);
    if (presence) {
      presence.lastActivity[user.userId] = new Date();
    }

    // Broadcast to others in the room
    socket.to(`draft:${draftId}`).emit('draft:content-changed', {
      ...data,
      userId: user.userId,
      userName: user.name
    });

    logger.debug('Content change broadcasted', { 
      userId: user.userId, 
      draftId, 
      field: data.field 
    });
  }

  private handleCursorMove(socket: Socket, data: CursorPosition) {
    const user = socket.data.user;
    const draftId = this.getDraftIdFromSocket(socket);
    
    if (!draftId) return;

    const presence = this.draftPresence.get(draftId);
    if (presence) {
      // Update cursor position
      const existingCursor = presence.cursors.find(c => c.userId === user.userId);
      const cursorData = {
        ...data,
        userId: user.userId,
        timestamp: new Date()
      };

      if (existingCursor) {
        Object.assign(existingCursor, cursorData);
      } else {
        presence.cursors.push(cursorData);
      }

      // Update last activity
      presence.lastActivity[user.userId] = new Date();

      // Broadcast to others
      socket.to(`draft:${draftId}`).emit('draft:cursor-moved', {
        cursor: cursorData,
        user: presence.users.find(u => u.userId === user.userId)
      });
    }
  }

  private handleTypingIndicator(socket: Socket, data: { draftId: string; isTyping: boolean }) {
    const user = socket.data.user;
    
    socket.to(`draft:${data.draftId}`).emit('draft:typing-changed', {
      userId: user.userId,
      userName: user.name,
      isTyping: data.isTyping
    });
  }

  private handleDisconnect(socket: Socket) {
    const user = socket.data.user;
    
    // Remove user from all draft rooms they were in
    for (const [draftId, presence] of this.draftPresence.entries()) {
      const userIndex = presence.users.findIndex(u => u.userId === user.userId);
      if (userIndex !== -1) {
        presence.users.splice(userIndex, 1);
        presence.cursors = presence.cursors.filter(c => c.userId !== user.userId);
        delete presence.lastActivity[user.userId];

        // Notify others
        socket.to(`draft:${draftId}`).emit('draft:user-left', {
          userId: user.userId,
          presence: this.getPublicPresence(presence)
        });

        // Clean up empty presence
        if (presence.users.length === 0) {
          this.draftPresence.delete(draftId);
        }
      }
    }

    logger.debug('User disconnected from draft collaboration', {
      userId: user?.userId,
      socketId: socket.id
    });
  }

  private getDraftIdFromSocket(socket: Socket): string | null {
    // Get draft ID from the room the socket is in
    for (const room of socket.rooms) {
      if (room.startsWith('draft:')) {
        return room.replace('draft:', '');
      }
    }
    return null;
  }

  private assignUserColor(userIndex: number): string {
    return this.userColors[userIndex % this.userColors.length];
  }

  private getPublicPresence(presence: DraftPresence) {
    return {
      users: presence.users,
      cursors: presence.cursors,
      activeUsers: Object.keys(presence.lastActivity).length
    };
  }

  private startCleanupInterval() {
    // Clean up inactive users every 5 minutes
    setInterval(() => {
      const now = new Date();
      const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

      for (const [draftId, presence] of this.draftPresence.entries()) {
        const activeUsers = presence.users.filter(user => {
          const lastActivity = presence.lastActivity[user.userId];
          return lastActivity && (now.getTime() - lastActivity.getTime()) < inactiveThreshold;
        });

        if (activeUsers.length !== presence.users.length) {
          presence.users = activeUsers;
          presence.cursors = presence.cursors.filter(c => 
            activeUsers.some(u => u.userId === c.userId)
          );

          // Clean up lastActivity
          for (const userId of Object.keys(presence.lastActivity)) {
            if (!activeUsers.some(u => u.userId === userId)) {
              delete presence.lastActivity[userId];
            }
          }

          // Notify remaining users
          this.io.to(`draft:${draftId}`).emit('draft:presence-update', {
            presence: this.getPublicPresence(presence)
          });

          // Clean up empty presence
          if (presence.users.length === 0) {
            this.draftPresence.delete(draftId);
          }
        }
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  // Public methods for external use
  public notifyDraftSaved(draftId: string, version: number, savedBy: string) {
    this.io.to(`draft:${draftId}`).emit('draft:saved', {
      version,
      savedBy,
      timestamp: new Date()
    });
  }

  public notifyDraftLocked(draftId: string, lockedBy: DraftUser, lockExpiresAt: Date) {
    this.io.to(`draft:${draftId}`).emit('draft:locked', {
      lockedBy,
      lockExpiresAt
    });
  }

  public notifyDraftUnlocked(draftId: string) {
    this.io.to(`draft:${draftId}`).emit('draft:unlocked', {
      timestamp: new Date()
    });
  }

  public notifyCommentAdded(draftId: string, comment: any) {
    this.io.to(`draft:${draftId}`).emit('draft:comment-added', {
      comment,
      timestamp: new Date()
    });
  }

  public getDraftPresence(draftId: string) {
    const presence = this.draftPresence.get(draftId);
    return presence ? this.getPublicPresence(presence) : null;
  }
}

// Singleton instance
let draftSocket: DraftCollaborationSocket | null = null;

export function initializeDraftSocket(server: HTTPServer): DraftCollaborationSocket {
  if (!draftSocket) {
    draftSocket = new DraftCollaborationSocket(server);
  }
  return draftSocket;
}

export function getDraftSocket(): DraftCollaborationSocket | null {
  return draftSocket;
}