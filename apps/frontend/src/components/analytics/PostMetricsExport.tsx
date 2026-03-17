import { useState } from 'react';
import { Download, Table } from 'lucide-react';
import { analyticsService } from '@/services/analytics.service';

interface PostMetricsExportProps {
  startDate: Date;
  endDate: Date;
  platforms: string[];
  posts: any[];
  disabled?: boolean;
}

export function PostMetricsExport({ 
  startDate, 
  endDate, 
  platforms, 
  posts, 
  disabled = false 
}: PostMetricsExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExportCSV = async () => {
    if (isExporting || disabled || posts.length === 0) return;

    setIsExporting(true);
    setError(null);

    try {
      // Build CSV string client-side
      const rows: string[] = [];
      const slug = 'workspace'; // TODO: Get actual workspace slug
      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];

      // CSV headers
      rows.push('postId,platform,publishedAt,likes,comments,shares,reach,impressions,saves,engagementRate,performanceScore,audienceReached,postPreview');

      // Add post data
      posts.forEach(post => {
        const postPreview = post.content ? post.content.substring(0, 100).replace(/,/g, ';').replace(/\n/g, ' ') : '';
        rows.push([
          post.postId,
          post.platform,
          post.publishedAt,
          post.likes || 0,
          post.comments || 0,
          post.shares || 0,
          post.reach || 0,
          post.impressions || 0,
          post.saves || 0,
          (post.engagementRate || 0).toFixed(2), // Unformatted decimal
          post.performanceScore || 0,
          post.reach || 0, // audienceReached = reach
          `"${postPreview}"` // Quoted to handle commas in content
        ].join(','));
      });

      const csvContent = rows.join('\n');
      
      // Trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `post-metrics-${slug}-${start}-${end}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export post metrics');
      console.error('Post metrics CSV export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleExportCSV}
        disabled={isExporting || disabled || posts.length === 0}
        className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        aria-label="Export post metrics as CSV"
        data-testid="export-post-metrics-csv"
      >
        {isExporting ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
        ) : (
          <Table className="h-4 w-4" />
        )}
        <span className="font-medium">
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </span>
      </button>

      {error && (
        <div className="absolute top-full mt-2 right-0 bg-red-50 border border-red-200 rounded-lg p-3 shadow-lg z-20 min-w-48">
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