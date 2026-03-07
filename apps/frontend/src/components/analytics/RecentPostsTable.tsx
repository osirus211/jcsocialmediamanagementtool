import { Post, PostStatus } from '@/types/post.types';
import { CheckCircle, XCircle, Clock, Calendar } from 'lucide-react';

interface RecentPostsTableProps {
  posts: Post[];
}

/**
 * RecentPostsTable Component
 * 
 * Shows recent posts with status and timing
 * 
 * Features:
 * - Post content preview
 * - Status badge
 * - Publish time
 * - Platform indicator
 */
export function RecentPostsTable({ posts }: RecentPostsTableProps) {
  const getStatusBadge = (status: PostStatus) => {
    const config = {
      [PostStatus.PUBLISHED]: {
        icon: CheckCircle,
        color: 'bg-green-100 text-green-800',
        label: 'Published',
      },
      [PostStatus.FAILED]: {
        icon: XCircle,
        color: 'bg-red-100 text-red-800',
        label: 'Failed',
      },
      [PostStatus.SCHEDULED]: {
        icon: Calendar,
        color: 'bg-blue-100 text-blue-800',
        label: 'Scheduled',
      },
      [PostStatus.QUEUED]: {
        icon: Clock,
        color: 'bg-purple-100 text-purple-800',
        label: 'Queued',
      },
      [PostStatus.DRAFT]: {
        icon: Clock,
        color: 'bg-gray-100 text-gray-800',
        label: 'Draft',
      },
      [PostStatus.PUBLISHING]: {
        icon: Clock,
        color: 'bg-yellow-100 text-yellow-800',
        label: 'Publishing',
      },
      [PostStatus.CANCELLED]: {
        icon: XCircle,
        color: 'bg-gray-100 text-gray-800',
        label: 'Cancelled',
      },
    };

    const { icon: Icon, color, label } = config[status] || config[PostStatus.DRAFT];

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPlatform = (post: Post) => {
    if (typeof post.socialAccountId === 'object' && post.socialAccountId?.platform) {
      return post.socialAccountId.platform;
    }
    return 'Unknown';
  };

  const truncateContent = (content: string, maxLength: number = 60) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No recent posts
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
              Content
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
              Platform
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
              Status
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
              Published
            </th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr
              key={post._id}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <td className="py-3 px-4">
                <p className="text-sm text-gray-900 dark:text-white">
                  {truncateContent(post.content)}
                </p>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {getPlatform(post)}
                </span>
              </td>
              <td className="py-3 px-4">
                {getStatusBadge(post.status)}
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(post.publishedAt || post.createdAt)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
