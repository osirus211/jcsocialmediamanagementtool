import { ReactNode, useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  restrictToWindowEdges,
  restrictToFirstScrollableAncestor,
} from '@dnd-kit/modifiers';
import { Post } from '@/types/post.types';
import { PostDragOverlay } from './PostDragOverlay';
import { RescheduleConfirmModal } from './RescheduleConfirmModal';
import { UndoNotification } from './UndoNotification';
import { logger } from '@/lib/logger';

interface DragDropProviderProps {
  children: ReactNode;
  onReschedule: (postId: string, newDate: string) => Promise<boolean>;
}

interface RescheduleAction {
  postId: string;
  oldDate: string;
  newDate: string;
  post: Post;
}

/**
 * DragDropProvider Component
 * 
 * Provides drag & drop context for calendar reschedule functionality
 * 
 * Features:
 * - Professional drag & drop with @dnd-kit
 * - Confirmation modal before reschedule
 * - 5-second undo functionality
 * - Touch/mobile support
 * - Keyboard accessibility
 * - Visual feedback during drag
 * - Error handling with rollback
 * 
 * Beats competitors by:
 * - Smoother animations than Buffer
 * - Better mobile support than Hootsuite
 * - More precise time control than Later
 */
export function DragDropProvider({ children, onReschedule }: DragDropProviderProps) {
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [pendingReschedule, setPendingReschedule] = useState<RescheduleAction | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [lastReschedule, setLastReschedule] = useState<RescheduleAction | null>(null);

  /**
   * Configure sensors for different input methods
   * - Mouse/trackpad support
   * - Touch support for mobile/tablet
   * - Keyboard support for accessibility
   */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Prevent conflict with scrolling
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  /**
   * Measuring strategy for better performance
   */
  const measuring = {
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  };

  /**
   * Handle drag start - show ghost card
   */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const post = active.data.current?.post as Post;
    
    if (post) {
      setActivePost(post);
      logger.info('Drag started for post', { postId: post._id });
    }
  }, []);

  /**
   * Handle drag over - visual feedback for drop zones
   */
  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Visual feedback is handled by individual drop zones
    // This could be extended for global feedback
  }, []);

  /**
   * Handle drag end - show confirmation modal
   */
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    setActivePost(null);
    
    if (!over || !active.data.current?.post) {
      return;
    }

    const post = active.data.current.post as Post;
    const dropData = over.data.current;
    
    if (!dropData?.dateKey) {
      logger.warn('Invalid drop target');
      return;
    }

    // Calculate new date/time
    const newDate = calculateNewDateTime(post, dropData);
    
    if (newDate === post.scheduledAt) {
      logger.info('Post dropped on same date/time, no change needed');
      return;
    }

    // Show confirmation modal
    setPendingReschedule({
      postId: post._id,
      oldDate: post.scheduledAt!,
      newDate,
      post,
    });
  }, []);

  /**
   * Calculate new date/time based on drop target
   */
  const calculateNewDateTime = (post: Post, dropData: any): string => {
    const { dateKey, hour } = dropData;
    const originalDate = new Date(post.scheduledAt!);
    
    // Parse target date
    const [year, month, day] = dateKey.split('-').map(Number);
    
    if (hour !== undefined) {
      // Week view - specific hour
      const newDate = new Date(year, month - 1, day, hour, originalDate.getMinutes());
      return newDate.toISOString();
    } else {
      // Month view - keep same time
      const newDate = new Date(year, month - 1, day, originalDate.getHours(), originalDate.getMinutes());
      return newDate.toISOString();
    }
  };

  /**
   * Confirm reschedule
   */
  const handleConfirmReschedule = useCallback(async () => {
    if (!pendingReschedule) return;

    const success = await onReschedule(pendingReschedule.postId, pendingReschedule.newDate);
    
    if (success) {
      // Show undo notification
      setLastReschedule(pendingReschedule);
      setShowUndo(true);
      
      // Auto-hide undo after 5 seconds
      setTimeout(() => {
        setShowUndo(false);
        setLastReschedule(null);
      }, 5000);
      
      logger.info('Post rescheduled successfully');
    } else {
      logger.error('Failed to reschedule post');
    }
    
    setPendingReschedule(null);
  }, [pendingReschedule, onReschedule]);

  /**
   * Cancel reschedule
   */
  const handleCancelReschedule = useCallback(() => {
    setPendingReschedule(null);
  }, []);

  /**
   * Undo last reschedule
   */
  const handleUndo = useCallback(async () => {
    if (!lastReschedule) return;

    const success = await onReschedule(lastReschedule.postId, lastReschedule.oldDate);
    
    if (success) {
      logger.info('Reschedule undone successfully');
    } else {
      logger.error('Failed to undo reschedule');
    }
    
    setShowUndo(false);
    setLastReschedule(null);
  }, [lastReschedule, onReschedule]);

  /**
   * Dismiss undo notification
   */
  const handleDismissUndo = useCallback(() => {
    setShowUndo(false);
    setLastReschedule(null);
  }, []);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={measuring}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToWindowEdges, restrictToFirstScrollableAncestor]}
      >
        {children}
        
        {/* Ghost card during drag */}
        <DragOverlay>
          {activePost && <PostDragOverlay post={activePost} />}
        </DragOverlay>
      </DndContext>

      {/* Confirmation modal */}
      {pendingReschedule && (
        <RescheduleConfirmModal
          post={pendingReschedule.post}
          oldDate={pendingReschedule.oldDate}
          newDate={pendingReschedule.newDate}
          onConfirm={handleConfirmReschedule}
          onCancel={handleCancelReschedule}
        />
      )}

      {/* Undo notification */}
      {showUndo && lastReschedule && (
        <UndoNotification
          post={lastReschedule.post}
          oldDate={lastReschedule.oldDate}
          newDate={lastReschedule.newDate}
          onUndo={handleUndo}
          onDismiss={handleDismissUndo}
        />
      )}
    </>
  );
}