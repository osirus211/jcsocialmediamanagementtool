// Post Types

export enum PostStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  QUEUED = 'queued',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface Post {
  _id: string;
  workspaceId: string;
  socialAccountId: string | any; // Can be populated
  content: string;
  mediaUrls: string[];
  status: PostStatus;
  scheduledAt?: string;
  publishedAt?: string;
  errorMessage?: string;
  retryCount: number;
  metadata: {
    platformPostId?: string;
    characterCount?: number;
    hashtags?: string[];
    mentions?: string[];
    [key: string]: any;
  };
  createdBy: string | any; // Can be populated
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostInput {
  socialAccountId: string;
  content: string;
  mediaUrls?: string[];
  scheduledAt?: string;
}

export interface UpdatePostInput {
  content?: string;
  mediaUrls?: string[];
  scheduledAt?: string;
}

export interface PostFilters {
  status?: PostStatus | PostStatus[];
  socialAccountId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// API Response types
export interface PostsResponse {
  success: boolean;
  posts: Post[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PostResponse {
  success: boolean;
  post: Post;
  message?: string;
}

export interface PostStatsResponse {
  success: boolean;
  stats: Record<PostStatus, number>;
}
