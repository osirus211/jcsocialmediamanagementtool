export enum WidgetType {
  ENGAGEMENT_CHART = 'ENGAGEMENT_CHART',
  FOLLOWER_GROWTH = 'FOLLOWER_GROWTH',
  HASHTAG_TABLE = 'HASHTAG_TABLE',
  TOP_POSTS = 'TOP_POSTS',
  BEST_TIME_HEATMAP = 'BEST_TIME_HEATMAP',
  PLATFORM_BREAKDOWN = 'PLATFORM_BREAKDOWN',
  KPI_OVERVIEW = 'KPI_OVERVIEW',
  HASHTAG_SUGGESTIONS = 'HASHTAG_SUGGESTIONS',
  OPTIMAL_TIMING = 'OPTIMAL_TIMING',
  RECENT_POSTS = 'RECENT_POSTS',
}

export type WidgetSize = 'small' | 'medium' | 'large';

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  position: number;
  isVisible: boolean;
  config: Record<string, unknown>;
}

export interface DashboardLayout {
  _id: string;
  workspaceId: string;
  userId: string;
  widgets: Widget[];
  createdAt: string;
  updatedAt: string;
}

export interface WidgetDefinition {
  type: WidgetType;
  title: string;
  description: string;
  icon: string;
  defaultSize: WidgetSize;
  supportedSizes: WidgetSize[];
}