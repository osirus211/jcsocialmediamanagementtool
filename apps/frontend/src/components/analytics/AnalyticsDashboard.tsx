/**
 * Analytics Dashboard Component
 * 
 * Unified analytics dashboard with all P6 features
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DateRangePicker } from './DateRangePicker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Loader2, Download, TrendingUp, TrendingDown, Users, Eye, Heart, MessageCircle } from 'lucide-react';
import { analyticsService } from '../../services/analytics.service';
import { EngagementChart } from './EngagementChart';
import { FollowerGrowthChart } from './FollowerGrowthChart';
import { BestTimesHeatmap } from './charts/BestTimesHeatmap';
import { PlatformBreakdown } from './PlatformBreakdown';
import { HashtagAnalyticsTable } from './HashtagAnalyticsTable';
import { CompetitorAnalysisTable } from './CompetitorAnalysisTable';
import { LinkClickAnalytics } from './LinkClickAnalytics';
import { TopPostsGrid } from './TopPostsGrid';
import { ExportReportModal } from './ExportReportModal';
import { ScheduledReportsPanel } from './ScheduledReportsPanel';
import { GoogleAnalyticsIntegration } from './GoogleAnalyticsIntegration';
import type { DashboardAnalytics } from '../../types/analytics.types';

interface AnalyticsDashboardProps {
  className?: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ className }) => {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date()
  });

  const handleDateRangeChange = (startDate: Date, endDate: Date, preset: string) => {
    setDateRange({ startDate, endDate });
  };
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [showExportModal, setShowExportModal] = useState(false);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const analyticsData = await analyticsService.getSummaryMetrics(
        dateRange.startDate,
        dateRange.endDate,
        selectedPlatform === 'all' ? undefined : [selectedPlatform]
      );
      
      // Transform the summary data into DashboardAnalytics format
      const dashboardData: DashboardAnalytics = {
        overview: {
          totalImpressions: analyticsData.reach.current,
          totalEngagement: analyticsData.engagement.current,
          engagementRate: (analyticsData.engagement.current / analyticsData.reach.current) * 100 || 0,
          totalPosts: analyticsData.postsPublished.current,
          bestPerformingPost: null,
          growth: {
            impressions: analyticsData.reach.percentageChange,
            engagement: analyticsData.engagement.percentageChange,
          }
        },
        platforms: [],
        growth: [],
        hashtags: [],
        bestTimes: [],
        linkClicks: [],
        competitors: []
      };
      
      setData(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, selectedPlatform]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatPercentage = (num: number): string => {
    return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={loadAnalytics}>Retry</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-gray-600">
            {new Date(dateRange.startDate).toLocaleDateString()} - {new Date(dateRange.endDate).toLocaleDateString()}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <DateRangePicker
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onChange={handleDateRangeChange}
          />
          
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="twitter">Twitter</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={() => setShowExportModal(true)} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-summary">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Impressions</p>
                <p className="text-2xl font-bold">{formatNumber(data.overview.totalImpressions)}</p>
                <div className="flex items-center mt-1">
                  {data.overview.growth.impressions >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                  )}
                  <span className={`text-sm ${data.overview.growth.impressions >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(data.overview.growth.impressions)}
                  </span>
                </div>
              </div>
              <Eye className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Engagement</p>
                <p className="text-2xl font-bold">{formatNumber(data.overview.totalEngagement)}</p>
                <div className="flex items-center mt-1">
                  {data.overview.growth.engagement >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                  )}
                  <span className={`text-sm ${data.overview.growth.engagement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(data.overview.growth.engagement)}
                  </span>
                </div>
              </div>
              <Heart className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Engagement Rate</p>
                <p className="text-2xl font-bold">{data.overview.engagementRate.toFixed(2)}%</p>
                <p className="text-sm text-gray-500 mt-1">Average across all posts</p>
              </div>
              <MessageCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Posts</p>
                <p className="text-2xl font-bold">{data.overview.totalPosts}</p>
                <p className="text-sm text-gray-500 mt-1">Published in period</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
          <TabsTrigger value="timing">Best Times</TabsTrigger>
          <TabsTrigger value="links">Link Clicks</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6" data-testid="engagement-trends">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="engagement-chart" aria-label="Engagement trends chart showing engagement metrics over time">
              <CardHeader>
                <CardTitle>Engagement Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <EngagementChart data={data.growth} viewType="day" />
              </CardContent>
            </Card>

            <Card data-testid="platform-breakdown" aria-label="Platform performance breakdown showing metrics by social media platform">
              <CardHeader>
                <CardTitle>Platform Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <PlatformBreakdown data={data.platforms.map(p => ({
                  platform: p.platform,
                  count: p.posts || 0,
                  percentage: p.engagementRate || 0
                }))} />
              </CardContent>
            </Card>
          </div>

          <Card data-testid="follower-growth" aria-label="Follower growth chart showing follower count changes over time">
            <CardHeader>
              <CardTitle>Follower Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <FollowerGrowthChart 
                data={[]} // TODO: Add follower growth data
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="posts" className="space-y-6" data-testid="post-performance">
          <TopPostsGrid 
            data={[]} // TODO: Add top posts data
          />
        </TabsContent>

        <TabsContent value="hashtags" className="space-y-6" data-testid="hashtag-analytics">
          <HashtagAnalyticsTable 
            data={data.hashtags}
            startDate={dateRange.startDate.toISOString()}
            endDate={dateRange.endDate.toISOString()}
            platform={selectedPlatform === 'all' ? undefined : selectedPlatform}
          />
        </TabsContent>

        <TabsContent value="timing" className="space-y-6" data-testid="heatmap">
          <Card>
            <CardHeader>
              <CardTitle>Best Times to Post</CardTitle>
              <p className="text-sm text-gray-600">
                Heatmap showing optimal posting times based on engagement data
              </p>
            </CardHeader>
            <CardContent>
              <BestTimesHeatmap data={data.bestTimes} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="space-y-6" data-testid="link-analytics">
          <LinkClickAnalytics 
            data={data.linkClicks}
            startDate={dateRange.startDate.toISOString()}
            endDate={dateRange.endDate.toISOString()}
            platform={selectedPlatform === 'all' ? undefined : selectedPlatform}
          />
        </TabsContent>

        <TabsContent value="competitors" className="space-y-6" data-testid="competitor-analysis">
          <CompetitorAnalysisTable 
            data={data.competitors}
            startDate={dateRange.startDate.toISOString()}
            endDate={dateRange.endDate.toISOString()}
            platform={selectedPlatform === 'all' ? undefined : selectedPlatform}
          />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6" data-testid="scheduled-reports">
          <ScheduledReportsPanel />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6" data-testid="google-analytics-integration">
          <GoogleAnalyticsIntegration />
        </TabsContent>
      </Tabs>

      {/* Export Modal */}
      {showExportModal && (
        <ExportReportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          dateRange={{
            startDate: dateRange.startDate.toISOString(),
            endDate: dateRange.endDate.toISOString()
          }}
          platform={selectedPlatform === 'all' ? undefined : selectedPlatform}
          data={data}
        />
      )}
    </div>
  );
};