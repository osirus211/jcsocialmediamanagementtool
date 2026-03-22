/**
 * Queue Management Page
 * 
 * Comprehensive queue management interface that beats Buffer, Hootsuite, Sprout Social, Later
 * 
 * Features:
 * - Drag-and-drop reordering
 * - Platform filtering
 * - Bulk operations
 * - Smart shuffle algorithms
 * - Queue statistics
 * - Post preview cards
 * - Empty state handling
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  MoreVertical,
  Shuffle,
  ArrowUp,
  ArrowDown,
  MoveUp,
  MoveDown,
  Trash2,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Image,
  Video,
  FileText,
  Users,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { queueService, QueuedPost, QueueStats, QueuePauseStatus } from '@/services/queue.service';
import { useScheduleStore } from '@/store/schedule.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { SortableQueueItem } from '@/components/queue/SortableQueueItem';
import { QueueStatsCard } from '@/components/queue/QueueStatsCard';
import { EmptyQueueState } from '@/components/queue/EmptyQueueState';
import { QueuePauseControl } from '@/components/queue/QueuePauseControl';

const PLATFORMS = [
  { value: 'all', label: 'All Platforms' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'threads', label: 'Threads' },
  { value: 'tiktok', label: 'TikTok' },
];

const SHUFFLE_STRATEGIES = [
  { value: 'optimal', label: 'Optimal (Recommended)', description: 'Smart distribution with advanced algorithms' },
  { value: 'balanced', label: 'Balanced', description: 'Even distribution across platforms' },
  { value: 'random', label: 'Random', description: 'Completely random order' },
];

export default function QueuePage() {
  const { currentWorkspaceId } = useWorkspaceStore();
  const {
    queuedPosts,
    queueStats,
    isQueueLoading,
    queueError,
    isPaused,
    pauseStatus,
    fetchQueue,
    reorderQueue,
    shuffleQueue,
    pauseQueue,
    resumeQueue,
    removeFromQueue,
  } = useScheduleStore();

  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showShuffleDialog, setShowShuffleDialog] = useState(false);
  const [shuffleStrategy, setShuffleStrategy] = useState('optimal');
  const [preserveTimeSlots, setPreserveTimeSlots] = useState(true);
  const [isShuffling, setIsShuffling] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadQueue = useCallback(async () => {
    if (!currentWorkspaceId) return;
    try {
      const platform = selectedPlatform === 'all' ? undefined : selectedPlatform;
      await fetchQueue(currentWorkspaceId, platform);
    } catch (error: any) {
      console.error('Failed to load queue:', error);
      toast.error('Failed to load queue');
    }
  }, [currentWorkspaceId, selectedPlatform, fetchQueue]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!currentWorkspaceId) return;
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = queuedPosts.findIndex((post) => post.id === active.id);
    const newIndex = queuedPosts.findIndex((post) => post.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    try {
      await reorderQueue(currentWorkspaceId, active.id as string, newIndex + 1);
      toast.success('Queue reordered successfully');
    } catch (error: any) {
      toast.error('Failed to reorder queue');
      console.error('Reorder error:', error);
    }
  };

  const handleMovePost = async (postId: string, action: 'up' | 'down' | 'top' | 'bottom') => {
    if (!currentWorkspaceId) return;
    try {
      let updatedPosts: QueuedPost[];
      
      switch (action) {
        case 'up':
          updatedPosts = await queueService.movePostUp(postId);
          break;
        case 'down':
          updatedPosts = await queueService.movePostDown(postId);
          break;
        case 'top':
          updatedPosts = await queueService.moveToTop(postId);
          break;
        case 'bottom':
          updatedPosts = await queueService.moveToBottom(postId);
          break;
      }
      
      await loadQueue();
      toast.success(`Post moved ${action === 'top' || action === 'bottom' ? `to ${action}` : action}`);
    } catch (error: any) {
      toast.error(`Failed to move post ${action}`);
      console.error('Move error:', error);
    }
  };

  const handleRemovePost = async (postId: string) => {
    if (!currentWorkspaceId) return;
    try {
      await removeFromQueue(currentWorkspaceId, postId);
      toast.success('Post removed from queue');
    } catch (error: any) {
      toast.error('Failed to remove post from queue');
      console.error('Remove error:', error);
    }
  };

  const handleShuffle = async () => {
    if (!currentWorkspaceId) return;
    try {
      setIsShuffling(true);
      const platform = selectedPlatform === 'all' ? undefined : selectedPlatform;
      
      await shuffleQueue(currentWorkspaceId, {
        platform,
        preserveTimeSlots,
        distributionStrategy: shuffleStrategy as any,
      });
      
      setShowShuffleDialog(false);
      toast.success('Queue shuffled successfully');
    } catch (error: any) {
      toast.error('Failed to shuffle queue');
      console.error('Shuffle error:', error);
    } finally {
      setIsShuffling(false);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedPosts.size === 0) {
      toast.error('No posts selected');
      return;
    }

    try {
      const postIds = Array.from(selectedPosts);
      const result = await queueService.bulkOperation({
        operation: action as any,
        postIds,
      });

      if (result.success > 0) {
        toast.success(`${result.success} posts processed successfully`);
        if (result.failed.length > 0) {
          toast.warning(`${result.failed.length} posts failed to process`);
        }
        loadQueue();
        setSelectedPosts(new Set());
        setShowBulkActions(false);
      }
    } catch (error: any) {
      toast.error('Bulk operation failed');
      console.error('Bulk operation error:', error);
    }
  };

  const togglePostSelection = (postId: string) => {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(postId)) {
      newSelected.delete(postId);
    } else {
      newSelected.add(postId);
    }
    setSelectedPosts(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const selectAllPosts = () => {
    if (selectedPosts.size === queuedPosts.length) {
      setSelectedPosts(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedPosts(new Set(queuedPosts.map(p => p.id)));
      setShowBulkActions(true);
    }
  };

  if (isQueueLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (queueError) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{queueError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (queuedPosts.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Queue</h1>
          <Button onClick={loadQueue} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <EmptyQueueState />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Queue</h1>
        <div className="flex items-center gap-2">
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((platform) => (
                <SelectItem key={platform.value} value={platform.value}>
                  {platform.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => setShowShuffleDialog(true)}
            variant="outline"
            size="sm"
            disabled={queuedPosts.length < 2}
          >
            <Shuffle className="h-4 w-4 mr-2" />
            Shuffle
          </Button>
          <Button onClick={loadQueue} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats and Pause Control */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {queueStats && <QueueStatsCard stats={queueStats} />}
        </div>
        <div>
          <QueuePauseControl onStatusChange={() => loadQueue()} />
        </div>
      </div>

      {/* Global Pause Warning */}
      {pauseStatus?.isPaused && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="font-medium">
            🚨 Queue is PAUSED - No posts will publish until resumed
            {pauseStatus.resumeAt && (
              <div className="text-sm mt-1">
                Auto-resume: {format(new Date(pauseStatus.resumeAt), 'MMM d, yyyy h:mm a')}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Bulk Actions Bar */}
      {showBulkActions && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedPosts.size} post{selectedPosts.size !== 1 ? 's' : ''} selected
                </span>
                <Button
                  onClick={selectAllPosts}
                  variant="ghost"
                  size="sm"
                >
                  {selectedPosts.size === queuedPosts.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleBulkAction('move_to_top')}
                  variant="outline"
                  size="sm"
                >
                  <MoveUp className="h-4 w-4 mr-2" />
                  Move to Top
                </Button>
                <Button
                  onClick={() => handleBulkAction('move_to_bottom')}
                  variant="outline"
                  size="sm"
                >
                  <MoveDown className="h-4 w-4 mr-2" />
                  Move to Bottom
                </Button>
                <Button
                  onClick={() => handleBulkAction('remove')}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={queuedPosts.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {queuedPosts.map((post, index) => {
              // Check if this post is paused (global or account-specific)
              const isPostPaused = pauseStatus?.isPaused || 
                pauseStatus?.accountPauses.some(p => p.socialAccountId === post.socialAccountId);
              
              return (
                <SortableQueueItem
                  key={post.id}
                  post={post}
                  index={index}
                  isSelected={selectedPosts.has(post.id)}
                  isPaused={isPostPaused}
                  onToggleSelect={() => togglePostSelection(post.id)}
                  onMove={handleMovePost}
                  onRemove={handleRemovePost}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Shuffle Dialog */}
      <Dialog open={showShuffleDialog} onOpenChange={setShowShuffleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shuffle Queue</DialogTitle>
            <DialogDescription>
              Choose how you want to shuffle your queue. Our algorithms are smarter than Buffer's basic shuffle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Strategy</label>
              <Select value={shuffleStrategy} onValueChange={setShuffleStrategy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHUFFLE_STRATEGIES.map((strategy) => (
                    <SelectItem key={strategy.value} value={strategy.value}>
                      <div>
                        <div className="font-medium">{strategy.label}</div>
                        <div className="text-xs text-muted-foreground">{strategy.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="preserve-slots"
                checked={preserveTimeSlots}
                onChange={(e) => setPreserveTimeSlots(e.target.checked)}
              />
              <label htmlFor="preserve-slots" className="text-sm">
                Preserve time slots (recommended)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowShuffleDialog(false)}
              disabled={isShuffling}
            >
              Cancel
            </Button>
            <Button onClick={handleShuffle} disabled={isShuffling}>
              {isShuffling && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Shuffle Queue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}