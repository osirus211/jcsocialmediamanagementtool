// @ts-nocheck
/**
 * Hashtag Analytics Table Component
 * 
 * Displays hashtag performance metrics in a sortable table
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Hash } from 'lucide-react';
import { analyticsService } from '../../services/analytics.service';
import type { HashtagAnalytics } from '../../types/analytics.types';

interface HashtagAnalyticsTableProps {
  data?: HashtagAnalytics[];
  startDate: string;
  endDate: string;
  platform?: string;
  className?: string;
}

export const HashtagAnalyticsTable: React.FC<HashtagAnalyticsTableProps> = ({
  data: initialData,
  startDate,
  endDate,
  platform,
  className
}) => {
  const [data, setData] = useState<HashtagAnalytics[]>(initialData || []);
  const [loading, setLoading] = useState(!initialData);

  const loadHashtagAnalytics = async () => {
    try {
      setLoading(true);
      const hashtagData = await analyticsService.getHashtagPerformance(
        new Date(startDate),
        new Date(endDate),
        50
      );
      setData(hashtagData || []);
    } catch (error) {
      console.error('Error loading hashtag analytics:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      loadHashtagAnalytics();
    }
  }, [startDate, endDate]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getPlatformColor = (platform: string): string => {
    const colors: Record<string, string> = {
      facebook: 'bg-blue-100 text-blue-800',
      instagram: 'bg-pink-100 text-pink-800',
      twitter: 'bg-sky-100 text-sky-800',
      linkedin: 'bg-blue-100 text-blue-800',
      tiktok: 'bg-gray-100 text-gray-800',
      youtube: 'bg-red-100 text-red-800'
    };
    return colors[platform] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Card className={className} aria-label="Hashtag analytics table showing performance metrics for hashtags used in posts">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          Hashtag Analytics
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading hashtag analytics...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8">
            <Hash className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No hashtag data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hashtag</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Reach</TableHead>
                  <TableHead>Impressions</TableHead>
                  <TableHead>Avg Engagement</TableHead>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((hashtag, index) => (
                  <TableRow key={hashtag._id || index}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-gray-400" />
                        #{hashtag.hashtag}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPlatformColor(hashtag.platform)}>
                        {hashtag.platform}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{hashtag.usageCount}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {hashtag.totalReach ? formatNumber(hashtag.totalReach) : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {hashtag.impressions ? formatNumber(hashtag.impressions) : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{hashtag.avgEngagementRate.toFixed(2)}%</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{hashtag.trendScore}/100</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};