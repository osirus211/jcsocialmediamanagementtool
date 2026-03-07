// DLQ (Dead Letter Queue) Types

export interface DLQJob {
  id: string;
  postId: string;
  attemptsMade: number;
  failedAt: string;
  error: string;
  data: {
    postId: string;
    content: string;
    platform?: string;
    scheduledAt?: string;
    socialAccountId?: string;
    [key: string]: any;
  };
}

export interface DLQStats {
  total: number;
  byPlatform: Record<string, number>;
  byErrorType: Record<string, number>;
}

export interface DLQPreviewResponse {
  success: boolean;
  jobs: DLQJob[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DLQStatsResponse {
  success: boolean;
  stats: DLQStats;
}

export interface DLQReplayResponse {
  success: boolean;
  message: string;
  replayed: number;
  failed: number;
}

export enum RetryStatus {
  IDLE = 'idle',
  RETRYING = 'retrying',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export interface RetryState {
  status: RetryStatus;
  error: string | null;
}
