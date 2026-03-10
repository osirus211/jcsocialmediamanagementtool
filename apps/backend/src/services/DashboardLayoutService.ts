import { DashboardLayout, IDashboardLayout, DashboardWidget } from '../models/DashboardLayout';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export class DashboardLayoutService {
  /**
   * Get dashboard layout for user in workspace
   */
  static async getLayout(userId: string, workspaceId: string): Promise<IDashboardLayout | null> {
    try {
      let layout = await DashboardLayout.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      // If no layout exists, create default layout
      if (!layout) {
        layout = await this.createDefaultLayout(userId, workspaceId);
      }

      return layout;
    } catch (error: any) {
      logger.error('Failed to get dashboard layout', {
        userId,
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to get dashboard layout: ${error.message}`);
    }
  }

  /**
   * Save dashboard layout (upsert)
   */
  static async saveLayout(
    userId: string,
    workspaceId: string,
    widgets: DashboardWidget[]
  ): Promise<IDashboardLayout> {
    try {
      const layout = await DashboardLayout.findOneAndUpdate(
        {
          userId: new mongoose.Types.ObjectId(userId),
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        {
          widgets,
        },
        {
          new: true,
          upsert: true,
        }
      );

      logger.info('Dashboard layout saved', {
        userId,
        workspaceId,
        widgetCount: widgets.length,
      });

      return layout;
    } catch (error: any) {
      logger.error('Failed to save dashboard layout', {
        userId,
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to save dashboard layout: ${error.message}`);
    }
  }

  /**
   * Reset layout to default
   */
  static async resetLayout(userId: string, workspaceId: string): Promise<IDashboardLayout> {
    try {
      const defaultWidgets = this.getDefaultWidgets();

      const layout = await DashboardLayout.findOneAndUpdate(
        {
          userId: new mongoose.Types.ObjectId(userId),
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        {
          widgets: defaultWidgets,
        },
        {
          new: true,
          upsert: true,
        }
      );

      logger.info('Dashboard layout reset to default', {
        userId,
        workspaceId,
      });

      return layout;
    } catch (error: any) {
      logger.error('Failed to reset dashboard layout', {
        userId,
        workspaceId,
        error: error.message,
      });
      throw new Error(`Failed to reset dashboard layout: ${error.message}`);
    }
  }

  /**
   * Create default layout for new user
   */
  private static async createDefaultLayout(userId: string, workspaceId: string): Promise<IDashboardLayout> {
    const defaultWidgets = this.getDefaultWidgets();

    const layout = await DashboardLayout.create({
      userId: new mongoose.Types.ObjectId(userId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      widgets: defaultWidgets,
    });

    logger.info('Default dashboard layout created', {
      userId,
      workspaceId,
    });

    return layout;
  }

  /**
   * Get default widget configuration
   */
  private static getDefaultWidgets(): DashboardWidget[] {
    return [
      {
        id: 'engagement-chart',
        type: 'ENGAGEMENT_CHART',
        title: 'Engagement Trends',
        size: 'medium',
        position: 0,
        isVisible: true,
        config: {},
      },
      {
        id: 'follower-growth',
        type: 'FOLLOWER_GROWTH',
        title: 'Follower Growth',
        size: 'medium',
        position: 1,
        isVisible: true,
        config: {},
      },
      {
        id: 'hashtag-table',
        type: 'HASHTAG_TABLE',
        title: 'Hashtag Performance',
        size: 'large',
        position: 2,
        isVisible: true,
        config: {},
      },
      {
        id: 'top-posts',
        type: 'TOP_POSTS',
        title: 'Top Posts',
        size: 'large',
        position: 3,
        isVisible: true,
        config: {},
      },
      {
        id: 'best-time-heatmap',
        type: 'BEST_TIME_HEATMAP',
        title: 'Best Times to Post',
        size: 'medium',
        position: 4,
        isVisible: true,
        config: {},
      },
      {
        id: 'platform-breakdown',
        type: 'PLATFORM_BREAKDOWN',
        title: 'Platform Breakdown',
        size: 'medium',
        position: 5,
        isVisible: true,
        config: {},
      },
      {
        id: 'kpi-overview',
        type: 'KPI_OVERVIEW',
        title: 'KPI Overview',
        size: 'large',
        position: 6,
        isVisible: true,
        config: {},
      },
      {
        id: 'hashtag-suggestions',
        type: 'HASHTAG_SUGGESTIONS',
        title: 'Hashtag Suggestions',
        size: 'small',
        position: 7,
        isVisible: true,
        config: {},
      },
      {
        id: 'optimal-timing',
        type: 'OPTIMAL_TIMING',
        title: 'AI Timing Suggestions',
        size: 'medium',
        position: 8,
        isVisible: true,
        config: {},
      },
      {
        id: 'recent-posts',
        type: 'RECENT_POSTS',
        title: 'Recent Posts',
        size: 'medium',
        position: 9,
        isVisible: true,
        config: {},
      },
    ];
  }
}