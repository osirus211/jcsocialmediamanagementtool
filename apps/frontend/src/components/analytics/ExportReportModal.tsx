/**
 * Export Report Modal Component
 * 
 * Modal for configuring and exporting analytics reports
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Download, FileText, Table, Loader2 } from 'lucide-react';
import { analyticsService } from '../../services/analytics.service';
import type { ExportOptions } from '../../types/analytics.types';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  platform?: string;
  data?: any; // Analytics data for client-side CSV generation
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  dateRange,
  platform,
  data
}) => {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    format: 'pdf',
    startDate: new Date(dateRange.startDate),
    endDate: new Date(dateRange.endDate),
    platforms: platform ? [platform] : undefined,
    title: 'Analytics Report',
    includeOverview: true,
    includePostMetrics: true,
    includeEngagementCharts: true,
    includeFollowerGrowth: true,
    includeHashtagAnalytics: true,
    includeBestTimes: true,
    includeLinkClicks: true,
    includeCompetitors: true,
  });

  const handleExport = async () => {
    try {
      setLoading(true);
      
      if (options.format === 'csv') {
        // Client-side CSV generation
        generateCSV();
        onClose();
      } else {
        // PDF export handles download directly
        await analyticsService.exportPDF(
          options.startDate,
          options.endDate,
          options.platforms
        );
        
        onClose();
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateCSV = () => {
    const csvRows: string[] = [];
    
    // Add title
    csvRows.push(`"${options.title || 'Analytics Report'}"`);
    csvRows.push(`"Date Range: ${new Date(dateRange.startDate).toLocaleDateString()} - ${new Date(dateRange.endDate).toLocaleDateString()}"`);
    csvRows.push('');
    
    // Overview metrics
    if (options.includeOverview && data?.overview) {
      csvRows.push('Overview Metrics');
      csvRows.push('Metric,Value,Change');
      csvRows.push(`Total Impressions,${data.overview.totalImpressions},${data.overview.growth?.impressions || 0}%`);
      csvRows.push(`Total Engagement,${data.overview.totalEngagement},${data.overview.growth?.engagement || 0}%`);
      csvRows.push(`Engagement Rate,${data.overview.engagementRate}%,`);
      csvRows.push(`Total Posts,${data.overview.totalPosts},`);
      csvRows.push('');
    }
    
    // Post metrics
    if (options.includePostMetrics && data?.topPosts) {
      csvRows.push('Top Posts');
      csvRows.push('Platform,Published At,Likes,Comments,Shares,Saves,Reach,Engagement Rate');
      data.topPosts.forEach((post: any) => {
        csvRows.push(`${post.platform},${post.publishedAt},${post.likes || 0},${post.comments || 0},${post.shares || 0},${post.saves || 0},${post.reach || 0},${post.engagementRate || 0}`);
      });
      csvRows.push('');
    }
    
    // Platform comparison
    if (data?.platforms) {
      csvRows.push('Platform Performance');
      csvRows.push('Platform,Posts,Engagement Rate,Impressions');
      data.platforms.forEach((platform: any) => {
        csvRows.push(`${platform.platform},${platform.posts || 0},${platform.engagementRate || 0},${platform.impressions || 0}`);
      });
      csvRows.push('');
    }
    
    // Hashtag analytics
    if (options.includeHashtagAnalytics && data?.hashtags) {
      csvRows.push('Hashtag Performance');
      csvRows.push('Hashtag,Usage Count,Avg Engagement Rate,Total Reach');
      data.hashtags.forEach((hashtag: any) => {
        csvRows.push(`${hashtag.hashtag},${hashtag.usageCount || 0},${hashtag.avgEngagementRate || 0},${hashtag.totalReach || 0}`);
      });
      csvRows.push('');
    }
    
    const csvContent = csvRows.join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const startDate = new Date(dateRange.startDate).toISOString().split('T')[0];
    const endDate = new Date(dateRange.endDate).toISOString().split('T')[0];
    const workspaceSlug = 'workspace'; // TODO: Get actual workspace slug
    const filename = `analytics-${workspaceSlug}-${startDate}-${endDate}.csv`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const updateOption = (key: keyof ExportOptions, value: any) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Analytics Report
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={options.format === 'pdf' ? 'default' : 'outline'}
                onClick={() => updateOption('format', 'pdf')}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                PDF
              </Button>
              <Button
                variant={options.format === 'csv' ? 'default' : 'outline'}
                onClick={() => updateOption('format', 'csv')}
                className="flex items-center gap-2"
              >
                <Table className="h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>

          {/* Report Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Report Title</Label>
            <Input
              id="title"
              value={options.title || ''}
              onChange={(e) => updateOption('title', e.target.value)}
              placeholder="Analytics Report"
            />
          </div>

          {/* Platform Selection */}
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select 
              value={options.platforms?.[0] || 'all'} 
              onValueChange={(value) => updateOption('platforms', value === 'all' ? undefined : [value])}
            >
              <SelectTrigger>
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
          </div>

          {/* Content Options */}
          <div className="space-y-3">
            <Label>Include in Report</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="overview"
                  checked={options.includeOverview}
                  onChange={(e) => updateOption('includeOverview', e.target.checked)}
                />
                <Label htmlFor="overview" className="text-sm">Overview Metrics</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="posts"
                  checked={options.includePostMetrics}
                  onChange={(e) => updateOption('includePostMetrics', e.target.checked)}
                />
                <Label htmlFor="posts" className="text-sm">Post Performance</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="engagement"
                  checked={options.includeEngagementCharts}
                  onChange={(e) => updateOption('includeEngagementCharts', e.target.checked)}
                />
                <Label htmlFor="engagement" className="text-sm">Engagement Charts</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="followers"
                  checked={options.includeFollowerGrowth}
                  onChange={(e) => updateOption('includeFollowerGrowth', e.target.checked)}
                />
                <Label htmlFor="followers" className="text-sm">Follower Growth</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hashtags"
                  checked={options.includeHashtagAnalytics}
                  onChange={(e) => updateOption('includeHashtagAnalytics', e.target.checked)}
                />
                <Label htmlFor="hashtags" className="text-sm">Hashtag Analytics</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="timing"
                  checked={options.includeBestTimes}
                  onChange={(e) => updateOption('includeBestTimes', e.target.checked)}
                />
                <Label htmlFor="timing" className="text-sm">Best Posting Times</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="links"
                  checked={options.includeLinkClicks}
                  onChange={(e) => updateOption('includeLinkClicks', e.target.checked)}
                />
                <Label htmlFor="links" className="text-sm">Link Click Analytics</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="competitors"
                  checked={options.includeCompetitors}
                  onChange={(e) => updateOption('includeCompetitors', e.target.checked)}
                />
                <Label htmlFor="competitors" className="text-sm">Competitor Analysis</Label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export {options.format.toUpperCase()}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};