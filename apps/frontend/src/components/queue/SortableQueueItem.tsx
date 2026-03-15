/**
 * Sortable Queue Item Component
 * 
 * Individual post item in the queue with drag-and-drop functionality
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  GripVertical,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  MoveUp,
  MoveDown,
  Trash2,
  Clock,
  Image,
  Video,
  FileText,
  Calendar,
  User,
  Pause,
} from 'lucide-react';
import { QueuedPost } from '@/services/queue.service';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SortableQueueItemProps {
  post: QueuedPost;
  index: number;
  isSelected: boolean;
  isPaused?: boolean; // New prop for pause status
  onToggleSelect: () => void;
  onMove: (postId: string, action: 'up' | 'down' | 'top' | 'bottom') => void;
  onRemove: (postId: string) => void;
}

const PLATFORM_COLORS = {
  twitter: 'bg-blue-500',
  facebook: 'bg-blue-600',
  instagram: 'bg-pink-500',
  linkedin: 'bg-blue-700',
  youtube: 'bg-red-500',
  threads: 'bg-gray-800',
  tiktok: 'bg-black',
  'google-business': 'bg-green-600',
};

const PLATFORM_NAMES = {
  twitter: 'Twitter',
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  threads: 'Threads',
  tiktok: 'TikTok',
  'google-business': 'Google Business',
};

export function SortableQueueItem({
  post,
  index,
  isSelected,
  isPaused = false,
  onToggleSelect,
  onMove,
  onRemove,
}: SortableQueueItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: post.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const scheduledDate = new Date(post.scheduledAt);
  const isOverdue = scheduledDate < new Date();
  const hasMedia = post.mediaIds.length > 0;

  const truncateContent = (content: string, maxLength: number = 120) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const getMediaIcon = () => {
    if (post.mediaIds.length === 0) return <FileText className="h-4 w-4" />;
    // For now, assume images. In a real app, you'd check media types
    return <Image className="h-4 w-4" />;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-all duration-200',
        isDragging && 'opacity-50 shadow-lg scale-105',
        isSelected && 'ring-2 ring-blue-500',
        isOverdue && 'border-red-200 bg-red-50',
        isPaused && 'opacity-60 grayscale border-orange-200 bg-orange-50'
      )}
    >
      <Card>
        <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Selection Checkbox */}
          <Checkbox
            checked={isSelected}
            onChange={onToggleSelect}
            className="mt-1"
          />

          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing mt-1 text-gray-400 hover:text-gray-600"
          >
            <GripVertical className="h-5 w-5" />
          </div>

          {/* Position Number */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
            {index + 1}
          </div>

          {/* Post Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {/* Platform Badge */}
              <Badge
                variant="secondary"
                className={cn(
                  'text-white text-xs',
                  PLATFORM_COLORS[post.platform as keyof typeof PLATFORM_COLORS] || 'bg-gray-500'
                )}
              >
                {PLATFORM_NAMES[post.platform as keyof typeof PLATFORM_NAMES] || post.platform}
              </Badge>

              {/* Account Name */}
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <User className="h-3 w-3" />
                {post.socialAccountName}
              </span>

              {/* Media Indicator */}
              {hasMedia && (
                <Badge variant="outline" className="text-xs">
                  {getMediaIcon()}
                  {post.mediaIds.length}
                </Badge>
              )}

              {/* Overdue Indicator */}
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  Overdue
                </Badge>
              )}

              {/* Paused Indicator */}
              {isPaused && (
                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                  <Pause className="h-3 w-3 mr-1" />
                  Paused
                </Badge>
              )}
            </div>

            {/* Post Content */}
            <p className="text-sm text-gray-900 mb-2 leading-relaxed">
              {truncateContent(post.content)}
            </p>

            {/* Scheduling Info */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(scheduledDate, 'MMM d, yyyy')}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(scheduledDate, 'h:mm a')}
              </div>
              <div>
                {formatDistanceToNow(scheduledDate, { addSuffix: true })}
              </div>
              {post.queueSlot && (
                <div className="text-blue-600">
                  Slot: {post.queueSlot}
                </div>
              )}
            </div>
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onMove(post.id, 'top')}>
                <MoveUp className="h-4 w-4 mr-2" />
                Move to Top
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove(post.id, 'up')}>
                <ArrowUp className="h-4 w-4 mr-2" />
                Move Up
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove(post.id, 'down')}>
                <ArrowDown className="h-4 w-4 mr-2" />
                Move Down
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove(post.id, 'bottom')}>
                <MoveDown className="h-4 w-4 mr-2" />
                Move to Bottom
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onRemove(post.id)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove from Queue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}