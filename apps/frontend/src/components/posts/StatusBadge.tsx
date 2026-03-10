import { PostStatus } from '@/types/post.types';

interface StatusBadgeProps {
  status: PostStatus;
}

const statusConfig: Record<
  PostStatus,
  { label: string; color: string; icon: string }
> = {
  [PostStatus.DRAFT]: {
    label: 'Draft',
    color: 'bg-gray-100 text-gray-800',
    icon: '📝',
  },
  [PostStatus.SCHEDULED]: {
    label: 'Scheduled',
    color: 'bg-blue-100 text-blue-800',
    icon: '📅',
  },
  [PostStatus.QUEUED]: {
    label: 'Queued',
    color: 'bg-purple-100 text-purple-800',
    icon: '⏳',
  },
  [PostStatus.PUBLISHING]: {
    label: 'Publishing',
    color: 'bg-yellow-100 text-yellow-800',
    icon: '🚀',
  },
  [PostStatus.PUBLISHED]: {
    label: 'Published',
    color: 'bg-green-100 text-green-800',
    icon: '✅',
  },
  [PostStatus.FAILED]: {
    label: 'Failed',
    color: 'bg-red-100 text-red-800',
    icon: '❌',
  },
  [PostStatus.CANCELLED]: {
    label: 'Cancelled',
    color: 'bg-gray-100 text-gray-600',
    icon: '🚫',
  },
  [PostStatus.PENDING_APPROVAL]: {
    label: 'Pending Approval',
    color: 'bg-yellow-100 text-yellow-800',
    icon: '⏰',
  },
  [PostStatus.APPROVED]: {
    label: 'Approved',
    color: 'bg-green-100 text-green-800',
    icon: '✅',
  },
  [PostStatus.REJECTED]: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-800',
    icon: '❌',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
