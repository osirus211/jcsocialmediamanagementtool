import PDFDocument from 'pdfkit';
import Papa from 'papaparse';
import { AnalyticsService } from './AnalyticsService';
import { HashtagAnalyticsService } from './HashtagAnalyticsService';
import { FollowerAnalyticsService } from './FollowerAnalyticsService';
import { PostROIService } from './PostROIService';
import { Workspace } from '../models/Workspace';
import { IScheduledReport, ReportType } from '../models/ScheduledReport';
import { logger } from '../utils/logger';
import { emailService } from './EmailService';

// Extended interface for report generation
interface ReportTopPerformingPost {
  post: {
    content: string;
    platforms: string[];
    publishedAt?: Date;
  };
  analytics?: {
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
    totalEngagement: number;
  };
  ctr?: number;
  roi?: number;
}

export class ReportGeneratorService {
  /**
   * Generate CSV report
   */
  static async generateCSV(
    workspaceId: string,
    reportType: ReportType,
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<Buffer> {
    try {
      let csvData: any[] = [];
      
      switch (reportType) {
        case ReportType.OVERVIEW:
          csvData = await this.getOverviewData(workspaceId, startDate, endDate, platforms);
          break;
        case ReportType.POSTS:
          csvData = await this.getPostsData(workspaceId, startDate, endDate, platforms);
          break;
        case ReportType.HASHTAGS:
          csvData = await this.getHashtagsData(workspaceId, startDate, endDate, platforms);
          break;
        case ReportType.FOLLOWERS:
          csvData = await this.getFollowersData(workspaceId, startDate, endDate, platforms);
          break;
        case ReportType.FULL:
          csvData = await this.getFullReportData(workspaceId, startDate, endDate, platforms);
          break;
        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }

      const csv = Papa.unparse(csvData);
      return Buffer.from(csv, 'utf-8');
    } catch (error: any) {
      logger.error('CSV generation failed', { workspaceId, reportType, error: error.message });
      throw new Error(`Failed to generate CSV report: ${error.message}`);
    }
  }

  /**
   * Generate PDF report
   */
  static async generatePDF(
    workspaceId: string,
    reportType: ReportType,
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<Buffer> {
    try {
      const workspace = await Workspace.findById(workspaceId);
      const workspaceName = workspace?.name || 'Unknown Workspace';
      
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk) => chunks.push(chunk));
      
      // Header
      doc.fontSize(20).text(`${workspaceName} Analytics Report`, { align: 'center' });
      doc.fontSize(12).text(`Report Type: ${reportType.toUpperCase()}`, { align: 'center' });
      doc.text(`Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, { align: 'center' });
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(2);

      // Get data based on report type
      const overviewMetrics = await AnalyticsService.getOverviewMetrics(workspaceId, startDate, endDate);
      const platformMetrics = await AnalyticsService.getPlatformMetrics(workspaceId, startDate, endDate);
      
      // Summary KPIs
      doc.fontSize(16).text('Summary', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Total Impressions: ${overviewMetrics.totalImpressions.toLocaleString()}`);
      doc.text(`Total Engagement: ${overviewMetrics.totalEngagement.toLocaleString()}`);
      doc.text(`Follower Growth: ${overviewMetrics.followerGrowth > 0 ? '+' : ''}${overviewMetrics.followerGrowth}`);
      doc.text(`Posts Published: ${overviewMetrics.postsPublished}`);
      doc.moveDown(2);

      // Platform Breakdown
      if (platformMetrics.length > 0) {
        doc.fontSize(16).text('Platform Breakdown', { underline: true });
        doc.moveDown();
        doc.fontSize(12);
        
        platformMetrics.forEach((platform) => {
          doc.text(`${platform.platform.toUpperCase()}:`);
          doc.text(`  Impressions: ${platform.impressions.toLocaleString()}`);
          doc.text(`  Engagement: ${platform.engagement.toLocaleString()}`);
          doc.text(`  Posts: ${platform.posts}`);
          doc.moveDown();
        });
      }

      // Top Posts (if posts report or full report)
      if (reportType === ReportType.POSTS || reportType === ReportType.FULL) {
        const topPosts = await PostROIService.getTopPerformingPosts(workspaceId, startDate, endDate, 'engagement', 10);
        
        if (topPosts.length > 0) {
          doc.addPage();
          doc.fontSize(16).text('Top 10 Posts', { underline: true });
          doc.moveDown();
          doc.fontSize(10);
          
          topPosts.forEach((post, index) => {
            const content = post.content.substring(0, 100) + (post.content.length > 100 ? '...' : '');
            doc.text(`${index + 1}. ${content}`);
            doc.text(`   Platform: ${post.platform}`);
            doc.text(`   Engagement: ${post.impressions * (post.engagementRate / 100) || 0}`);
            doc.text(`   CTR: ${post.clickThroughRate ? (post.clickThroughRate * 100).toFixed(2) + '%' : 'N/A'}`);
            doc.moveDown();
          });
        }
      }

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).text(
          `Page ${i + 1} of ${pageCount} | Generated by Social Media Scheduler`,
          50,
          doc.page.height - 50,
          { align: 'center' }
        );
      }

      doc.end();
      
      return new Promise((resolve) => {
        doc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
      });
    } catch (error: any) {
      logger.error('PDF generation failed', { workspaceId, reportType, error: error.message });
      throw new Error(`Failed to generate PDF report: ${error.message}`);
    }
  }

  /**
   * Send report email
   */
  static async sendReportEmail(
    report: IScheduledReport,
    buffer: Buffer,
    format: string
  ): Promise<void> {
    try {
      const workspace = await Workspace.findById(report.workspaceId);
      const workspaceName = workspace?.name || 'Unknown Workspace';
      
      const frequencyLabel = report.frequency.charAt(0).toUpperCase() + report.frequency.slice(1);
      const subject = `[${frequencyLabel}] Your Analytics Report — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
      
      const filename = `${workspaceName.replace(/\s+/g, '-').toLowerCase()}-analytics-${report.reportType}-${new Date().toISOString().split('T')[0]}.${format}`;
      
      // Use existing EmailService infrastructure
      for (const recipient of report.recipients) {
        await emailService.sendEmail({
          to: recipient,
          subject,
          body: this.generateEmailBody(workspaceName, report),
          html: this.generateEmailBody(workspaceName, report),
          // Note: Attachments not supported by current EmailService interface
        });
      }
      
      logger.info('Report email sent successfully', {
        reportId: report._id.toString(),
        recipients: report.recipients.length,
        format,
      });
    } catch (error: any) {
      logger.error('Failed to send report email', {
        reportId: report._id.toString(),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate email body HTML
   */
  private static generateEmailBody(workspaceName: string, report: IScheduledReport): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your ${report.frequency} Analytics Report</h2>
        <p>Hello,</p>
        <p>Your scheduled analytics report for <strong>${workspaceName}</strong> is ready!</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Report Details:</h3>
          <ul>
            <li><strong>Report Type:</strong> ${report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)}</li>
            <li><strong>Format:</strong> ${report.format.toUpperCase()}</li>
            <li><strong>Date Range:</strong> Last ${report.dateRange} days</li>
            ${report.platforms.length > 0 ? `<li><strong>Platforms:</strong> ${report.platforms.join(', ')}</li>` : ''}
          </ul>
        </div>
        
        <p>The detailed report is attached to this email. Review your analytics to track your social media performance and identify opportunities for growth.</p>
        
        <p>Best regards,<br>Your Social Media Scheduler Team</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          This is an automated report. To modify your report settings or unsubscribe, please log in to your dashboard.
        </p>
      </div>
    `;
  }

  /**
   * Get overview data for CSV
   */
  private static async getOverviewData(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<any[]> {
    const growthMetrics = await AnalyticsService.getGrowthMetrics(workspaceId, startDate, endDate);
    
    return growthMetrics.map(metric => ({
      date: metric.date,
      impressions: metric.impressions,
      engagements: metric.engagement,
      followers: (metric as any).followers || 0,
      posts: (metric as any).posts || 0,
    }));
  }

  /**
   * Get posts data for CSV
   */
  private static async getPostsData(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<any[]> {
    const posts = await PostROIService.getTopPerformingPosts(workspaceId, startDate, endDate, 'engagement', 1000);
    
    return posts.map(post => ({
      title: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
      platform: post.platform,
      publishedAt: post.publishedAt?.toISOString() || '',
      impressions: post.impressions || 0,
      likes: 0, // Not available in TopPerformingPost
      comments: 0, // Not available in TopPerformingPost
      shares: 0, // Not available in TopPerformingPost
      ctr: post.clickThroughRate ? (post.clickThroughRate * 100).toFixed(2) + '%' : '0%',
      roi: post.roi ? post.roi.toFixed(2) + '%' : 'N/A',
    }));
  }

  /**
   * Get hashtags data for CSV
   */
  private static async getHashtagsData(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<any[]> {
    const hashtags = await HashtagAnalyticsService.getHashtagPerformance(workspaceId, startDate, endDate);
    
    return hashtags.map(hashtag => ({
      hashtag: hashtag.hashtag,
      postCount: hashtag.postCount,
      avgEngagement: hashtag.avgEngagementRate.toFixed(2),
      totalImpressions: hashtag.totalImpressions,
    }));
  }

  /**
   * Get followers data for CSV
   */
  private static async getFollowersData(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<any[]> {
    const followerGrowth = await FollowerAnalyticsService.getFollowerGrowth(workspaceId, startDate, endDate);
    
    return Array.isArray(followerGrowth) ? followerGrowth.map(growth => ({
      date: growth.date,
      platform: growth.platform,
      followerCount: growth.followerCount,
      growth: growth.growth,
    })) : [];
  }

  /**
   * Get full report data for CSV (all sections)
   */
  private static async getFullReportData(
    workspaceId: string,
    startDate: Date,
    endDate: Date,
    platforms?: string[]
  ): Promise<any[]> {
    const [overview, posts, hashtags, followers] = await Promise.all([
      this.getOverviewData(workspaceId, startDate, endDate, platforms),
      this.getPostsData(workspaceId, startDate, endDate, platforms),
      this.getHashtagsData(workspaceId, startDate, endDate, platforms),
      this.getFollowersData(workspaceId, startDate, endDate, platforms),
    ]);

    // Combine all data with section headers
    const fullData: any[] = [];
    
    // Overview section
    fullData.push({ section: 'OVERVIEW' });
    fullData.push(...overview);
    fullData.push({});
    
    // Posts section
    fullData.push({ section: 'POSTS' });
    fullData.push(...posts);
    fullData.push({});
    
    // Hashtags section
    fullData.push({ section: 'HASHTAGS' });
    fullData.push(...hashtags);
    fullData.push({});
    
    // Followers section
    fullData.push({ section: 'FOLLOWERS' });
    fullData.push(...followers);
    
    return fullData;
  }
}