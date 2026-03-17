import { useState } from 'react';
import { Download, FileText, Table } from 'lucide-react';
import { analyticsService } from '@/services/analytics.service';

interface ExportButtonsProps {
  startDate: Date;
  endDate: Date;
  platforms: string[];
  data?: {
    summary?: any;
    followerGrowth?: any[];
    engagement?: any[];
    topPosts?: any[];
    platformComparison?: any[];
  };
}

export function ExportButtons({ startDate, endDate, platforms, data }: ExportButtonsProps) {
  const [isExporting, setIsExporting] = useState<'pdf' | 'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExportPDF = async () => {
    if (isExporting) return;

    setIsExporting('pdf');
    setError(null);

    try {
      await analyticsService.exportPDF(startDate, endDate, platforms.length > 0 ? platforms : undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to export PDF');
      console.error('PDF export error:', err);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportCSV = async () => {
    if (isExporting || !data) return;

    setIsExporting('csv');
    setError(null);

    try {
      // Build CSV string client-side
      const rows: string[] = [];
      const slug = 'workspace'; // TODO: Get actual workspace slug
      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];

      // KPIs section
      if (data.summary) {
        rows.push('KPIs');
        rows.push('Metric,Current,Previous,Change%');
        rows.push(`Reach,${data.summary.reach?.current || 0},${data.summary.reach?.previous || 0},${data.summary.reach?.percentageChange || 0}`);
        rows.push(`Engagement,${data.summary.engagement?.current || 0},${data.summary.engagement?.previous || 0},${data.summary.engagement?.percentageChange || 0}`);
        rows.push(`Follower Growth,${data.summary.followerGrowth?.current || 0},${data.summary.followerGrowth?.previous || 0},${data.summary.followerGrowth?.percentageChange || 0}`);
        rows.push(`Posts Published,${data.summary.postsPublished?.current || 0},${data.summary.postsPublished?.previous || 0},${data.summary.postsPublished?.percentageChange || 0}`);
        rows.push('');
      }

      // Follower growth by day
      if (data.followerGrowth && data.followerGrowth.length > 0) {
        rows.push('Follower Growth by Day');
        rows.push('Date,Platform,Followers');
        data.followerGrowth.forEach(d => rows.push(`${d.date},${d.platform},${d.followerCount}`));
        rows.push('');
      }

      // Engagement by day
      if (data.engagement && data.engagement.length > 0) {
        rows.push('Engagement by Day');
        rows.push('Date,Likes,Comments,Shares,Saves,Total');
        data.engagement.forEach(d => rows.push(`${d.date || d.platform},${d.likes || 0},${d.comments || 0},${d.shares || 0},${d.saves || 0},${d.total || 0}`));
        rows.push('');
      }

      // Top posts
      if (data.topPosts && data.topPosts.length > 0) {
        rows.push('Top Posts');
        rows.push('Platform,Published,Likes,Comments,Shares,Saves,Reach,EngagementRate%');
        data.topPosts.forEach(p => rows.push(`${p.platform},${p.publishedAt},${p.likes || 0},${p.comments || 0},${p.shares || 0},${p.saves || 0},${p.reach || 0},${p.engagementRate || 0}`));
        rows.push('');
      }

      // Platform comparison
      if (data.platformComparison && data.platformComparison.length > 0) {
        rows.push('Platform Comparison');
        rows.push('Platform,Followers,FollowerGrowth,Posts,Reach,Engagement,EngagementRate%,BestHour');
        data.platformComparison.forEach(p => rows.push(`${p.platform},${p.followers || 0},${p.followerGrowth || 0},${p.posts || 0},${p.reach || 0},${p.engagement || 0},${p.engagementRate || 0},${p.bestPostingHour || 0}`));
      }

      const csvContent = rows.join('\n');
      
      // Trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${slug}-${start}-${end}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export CSV');
      console.error('CSV export error:', err);
    } finally {
      setIsExporting(null);
    }
  };

  const hasData = data && (data.summary || data.followerGrowth || data.engagement || data.topPosts || data.platformComparison);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportCSV}
        disabled={isExporting !== null || !hasData}
        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Export as CSV"
      >
        {isExporting === 'csv' ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
        ) : (
          <Table className="h-4 w-4" />
        )}
        <span className="text-sm font-medium">
          {isExporting === 'csv' ? 'Exporting...' : 'Export CSV'}
        </span>
      </button>

      <button
        onClick={handleExportPDF}
        disabled={isExporting !== null || !hasData}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Export as PDF"
        data-testid="export-pdf-button"
      >
        {isExporting === 'pdf' ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        ) : (
          <FileText className="h-4 w-4" />
        )}
        <span className="text-sm font-medium">
          {isExporting === 'pdf' ? 'Generating...' : 'Export PDF'}
        </span>
      </button>

      {error && (
        <div className="absolute top-full mt-2 right-0 bg-red-50 border border-red-200 rounded-lg p-3 shadow-lg z-20">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-1 text-xs text-red-700 hover:text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}