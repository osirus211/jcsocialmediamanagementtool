import React from 'react';
import { Widget, WidgetType } from '@/types/dashboard.types';
import { EngagementChart } from '@/components/analytics/EngagementChart';
import { FollowerGrowthChart } from '@/components/analytics/FollowerGrowthChart';
import { HashtagPerformanceTable } from '@/components/analytics/HashtagPerformanceTable';
import { TopPostsTable } from '@/components/analytics/TopPostsTable';
import { BestTimeHeatmap } from '@/components/analytics/BestTimeHeatmap';
import { PlatformBreakdown } from '@/components/analytics/PlatformBreakdown';
import { OverviewCards } from '@/components/analytics/OverviewCards';
import { HashtagSuggestions } from '@/components/analytics/HashtagSuggestions';
import { OptimalTimeSuggestions } from '@/components/analytics/OptimalTimeSuggestions';
import { RecentPostsTable } from '@/components/analytics/RecentPostsTable';

interface WidgetRendererProps {
  widget: Widget;
}

export function WidgetRenderer({ widget }: WidgetRendererProps) {
  const renderWidget = () => {
    switch (widget.type) {
      case WidgetType.ENGAGEMENT_CHART:
        return <EngagementChart selectedPlatform={undefined} />;

      case WidgetType.FOLLOWER_GROWTH:
        return <FollowerGrowthChart />;

      case WidgetType.HASHTAG_TABLE:
        return <HashtagPerformanceTable onHashtagClick={() => {}} />;

      case WidgetType.TOP_POSTS:
        return <TopPostsTable />;

      case WidgetType.BEST_TIME_HEATMAP:
        return <BestTimeHeatmap platform={undefined} />;

      case WidgetType.PLATFORM_BREAKDOWN:
        return <PlatformBreakdown data={[]} />;

      case WidgetType.KPI_OVERVIEW:
        return <OverviewCards totalPublished={0} successRate={0} failedCount={0} scheduledCount={0} />;

      case WidgetType.HASHTAG_SUGGESTIONS:
        return <HashtagSuggestions />;

      case WidgetType.OPTIMAL_TIMING:
        return <OptimalTimeSuggestions selectedPlatform={undefined} />;

      case WidgetType.RECENT_POSTS:
        return <RecentPostsTable posts={[]} />;

      default:
        return (
          <div className="flex items-center justify-center h-32 text-gray-500">
            <p>Unknown widget type: {widget.type}</p>
          </div>
        );
    }
  };

  return (
    <div className="w-full h-full">
      {renderWidget()}
    </div>
  );
}