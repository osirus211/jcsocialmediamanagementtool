/**
 * Report Export Service
 * 
 * Handles PDF and CSV export of analytics reports
 */

import { logger } from '../utils/logger';
import { AnalyticsService } from './AnalyticsService';
import PDFDocument from 'pdfkit';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import path from 'path';

export interface ReportExportOptions {
  workspaceId: string;
  startDate: Date;
  endDate: Date;
  platforms?: string[];
  includeOverview?: boolean;
  includePostMetrics?: boolean;
  includeEngagementCharts?: boolean;
  includeFollowerGrowth?: boolean;
  includeHashtagAnalytics?: boolean;
  includeBestTimes?: boolean;
  includeLinkClicks?: boolean;
  includeCompetitors?: boolean;
  format: 'pdf' | 'csv';
  title?: string;
  logoUrl?: string;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

export class ReportExportService {
  private static readonly EXPORT_DIR = path.join(process.cwd(), 'exports');

  /**
   * Ensure export directory exists
   */
  private static ensureExportDir(): void {
    if (!fs.existsSync(this.EXPORT_DIR)) {
      fs.mkdirSync(this.EXPORT_DIR, { recursive: true });
    }
  }

  /**
   * Generate unique filename
   */
  private static generateFileName(workspaceId: string, format: string, title?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const titlePart = title ? `_${title.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    return `analytics_report_${workspaceId}${titlePart}_${timestamp}.${format}`;
  }

  /**
   * Export analytics report as PDF
   */
  static async exportPDF(options: ReportExportOptions): Promise<ExportResult> {
    try {
      this.ensureExportDir();
      
      const fileName = this.generateFileName(options.workspaceId, 'pdf', options.title);
      const filePath = path.join(this.EXPORT_DIR, fileName);

      // Get analytics data
      const [
        overviewData,
        platformData,
        growthData,
        topPostsData
      ] = await Promise.all([
        options.includeOverview ? AnalyticsService.getOverviewMetrics(options.workspaceId, options.startDate, options.endDate) : null,
        AnalyticsService.getPlatformMetrics(options.workspaceId, options.startDate, options.endDate),
        AnalyticsService.getGrowthMetrics(options.workspaceId, options.startDate, options.endDate, 'day'),
        options.includePostMetrics ? AnalyticsService.getTopPostsData(options.workspaceId, options.startDate, options.endDate, undefined, 'engagementRate', 'desc', 50) : null,
      ]);

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Add header
      doc.fontSize(24).text(options.title || 'Analytics Report', { align: 'center' });
      doc.fontSize(12).text(`Generated on ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.text(`Period: ${options.startDate.toLocaleDateString()} - ${options.endDate.toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(2);

      // Overview section
      if (options.includeOverview && overviewData) {
        doc.fontSize(18).text('Overview', { underline: true });
        doc.moveDown();
        
        doc.fontSize(12);
        doc.text(`Total Impressions: ${overviewData.totalImpressions.toLocaleString()}`);
        doc.text(`Total Engagement: ${overviewData.totalEngagement.toLocaleString()}`);
        doc.text(`Engagement Rate: ${overviewData.engagementRate.toFixed(2)}%`);
        doc.text(`Total Posts: ${overviewData.totalPosts}`);
        
        if (overviewData.growth) {
          doc.text(`Impressions Growth: ${overviewData.growth.impressions > 0 ? '+' : ''}${overviewData.growth.impressions.toFixed(1)}%`);
          doc.text(`Engagement Growth: ${overviewData.growth.engagement > 0 ? '+' : ''}${overviewData.growth.engagement.toFixed(1)}%`);
        }
        
        doc.moveDown(2);
      }

      // Platform metrics
      if (platformData && platformData.length > 0) {
        doc.fontSize(18).text('Platform Performance', { underline: true });
        doc.moveDown();
        
        platformData.forEach((platform: any) => {
          doc.fontSize(14).text(`${platform.platform.toUpperCase()}`, { underline: true });
          doc.fontSize(12);
          doc.text(`Impressions: ${platform.impressions.toLocaleString()}`);
          doc.text(`Engagement: ${platform.engagement.toLocaleString()}`);
          doc.text(`Engagement Rate: ${platform.engagementRate.toFixed(2)}%`);
          doc.text(`Posts: ${platform.posts}`);
          doc.moveDown();
        });
        
        doc.moveDown();
      }

      // Top posts
      if (options.includePostMetrics && topPostsData && topPostsData.length > 0) {
        doc.fontSize(18).text('Top Performing Posts', { underline: true });
        doc.moveDown();
        
        topPostsData.slice(0, 5).forEach((post: any, index: number) => {
          doc.fontSize(14).text(`${index + 1}. ${post.platform.toUpperCase()}`);
          doc.fontSize(12);
          doc.text(`Engagement Rate: ${post.engagementRate.toFixed(2)}%`);
          doc.text(`Likes: ${post.likes} | Comments: ${post.comments} | Shares: ${post.shares}`);
          doc.text(`Published: ${new Date(post.publishedAt).toLocaleDateString()}`);
          doc.moveDown();
        });
        
        doc.moveDown();
      }

      // Footer
      doc.fontSize(10).text('Generated by Social Media Analytics Platform', 50, doc.page.height - 50);

      doc.end();

      // Wait for PDF generation to complete
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      const stats = fs.statSync(filePath);

      return {
        success: true,
        filePath,
        fileName,
        fileSize: stats.size,
      };
    } catch (error) {
      logger.error('Error exporting PDF report:', error);
      return {
        success: false,
        error: error instanceof Error ? (error as Error).message : 'Unknown error',
      };
    }
  }

  /**
   * Export analytics report as CSV
   */
  static async exportCSV(options: ReportExportOptions): Promise<ExportResult> {
    try {
      this.ensureExportDir();
      
      const fileName = this.generateFileName(options.workspaceId, 'csv', options.title);
      const filePath = path.join(this.EXPORT_DIR, fileName);

      // Get detailed analytics data
      const [
        overviewMetrics,
        platformMetrics,
        growthMetrics,
        topPosts
      ] = await Promise.all([
        options.includeOverview ? AnalyticsService.getOverviewMetrics(options.workspaceId, options.startDate, options.endDate) : null,
        AnalyticsService.getPlatformMetrics(options.workspaceId, options.startDate, options.endDate),
        options.includeEngagementCharts ? AnalyticsService.getGrowthMetrics(options.workspaceId, options.startDate, options.endDate, 'day') : null,
        options.includePostMetrics ? AnalyticsService.getTopPostsData(options.workspaceId, options.startDate, options.endDate, undefined, 'engagementRate', 'desc', 50) : null,
      ]);

      // Prepare CSV data
      const csvData: any[] = [];

      // Add overview data
      if (overviewMetrics) {
        csvData.push({
          section: 'Overview',
          metric: 'Total Impressions',
          value: overviewMetrics.totalImpressions,
          date: options.startDate.toISOString().split('T')[0],
        });
        csvData.push({
          section: 'Overview',
          metric: 'Total Engagement',
          value: overviewMetrics.totalEngagement,
          date: options.startDate.toISOString().split('T')[0],
        });
        csvData.push({
          section: 'Overview',
          metric: 'Engagement Rate',
          value: overviewMetrics.engagementRate,
          date: options.startDate.toISOString().split('T')[0],
        });
      }

      // Add platform data
      if (platformMetrics) {
        platformMetrics.forEach((platform: any) => {
          csvData.push({
            section: 'Platform Performance',
            platform: platform.platform,
            metric: 'Impressions',
            value: platform.impressions,
            date: options.startDate.toISOString().split('T')[0],
          });
          csvData.push({
            section: 'Platform Performance',
            platform: platform.platform,
            metric: 'Engagement',
            value: platform.engagement,
            date: options.startDate.toISOString().split('T')[0],
          });
          csvData.push({
            section: 'Platform Performance',
            platform: platform.platform,
            metric: 'Engagement Rate',
            value: platform.engagementRate,
            date: options.startDate.toISOString().split('T')[0],
          });
        });
      }

      // Add post data
      if (topPosts) {
        topPosts.forEach((post: any) => {
          csvData.push({
            section: 'Top Posts',
            platform: post.platform,
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            engagement_rate: post.engagementRate,
            published_at: post.publishedAt,
          });
        });
      }

      // Write CSV file
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: Object.keys(csvData[0] || {}).map(key => ({ id: key, title: key.replace(/_/g, ' ').toUpperCase() })),
      });

      await csvWriter.writeRecords(csvData);

      const stats = fs.statSync(filePath);

      return {
        success: true,
        filePath,
        fileName,
        fileSize: stats.size,
      };
    } catch (error) {
      logger.error('Error exporting CSV report:', error);
      return {
        success: false,
        error: error instanceof Error ? (error as Error).message : 'Unknown error',
      };
    }
  }

  /**
   * Clean up old export files (older than 7 days)
   */
  static async cleanupOldExports(): Promise<void> {
    try {
      if (!fs.existsSync(this.EXPORT_DIR)) {
        return;
      }

      const files = fs.readdirSync(this.EXPORT_DIR);
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      for (const file of files) {
        const filePath = path.join(this.EXPORT_DIR, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          logger.info(`Cleaned up old export file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up old export files:', error);
    }
  }

  /**
   * Get export file info
   */
  static getExportFileInfo(fileName: string): { exists: boolean; filePath?: string; fileSize?: number } {
    try {
      const filePath = path.join(this.EXPORT_DIR, fileName);
      
      if (!fs.existsSync(filePath)) {
        return { exists: false };
      }

      const stats = fs.statSync(filePath);
      
      return {
        exists: true,
        filePath,
        fileSize: stats.size,
      };
    } catch (error) {
      logger.error('Error getting export file info:', error);
      return { exists: false };
    }
  }
}
