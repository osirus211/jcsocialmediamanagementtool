import { Router } from 'express';
import { z } from 'zod';
import { ScheduledReport, ReportFrequency, ReportFormat, ReportType } from '../../models/ScheduledReport';
import { ReportGeneratorService } from '../../services/ReportGeneratorService';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { validateRequest } from '../../middleware/validate';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

const router = Router();

// Validation schemas
const createReportSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    frequency: z.enum([ReportFrequency.DAILY, ReportFrequency.WEEKLY, ReportFrequency.MONTHLY]),
    format: z.enum([ReportFormat.PDF, ReportFormat.CSV]),
    reportType: z.enum([ReportType.OVERVIEW, ReportType.POSTS, ReportType.HASHTAGS, ReportType.FOLLOWERS, ReportType.FULL]),
    recipients: z.array(z.string().email()).min(1).max(10),
    platforms: z.array(z.string()).optional().default([]),
    dateRange: z.number().min(1).max(365).optional().default(30),
    isActive: z.boolean().optional().default(true),
  }),
});

const updateReportSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid report ID'),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    frequency: z.enum([ReportFrequency.DAILY, ReportFrequency.WEEKLY, ReportFrequency.MONTHLY]).optional(),
    format: z.enum([ReportFormat.PDF, ReportFormat.CSV]).optional(),
    reportType: z.enum([ReportType.OVERVIEW, ReportType.POSTS, ReportType.HASHTAGS, ReportType.FOLLOWERS, ReportType.FULL]).optional(),
    recipients: z.array(z.string().email()).min(1).max(10).optional(),
    platforms: z.array(z.string()).optional(),
    dateRange: z.number().min(1).max(365).optional(),
    isActive: z.boolean().optional(),
  }),
});

const downloadReportSchema = z.object({
  query: z.object({
    reportType: z.enum([ReportType.OVERVIEW, ReportType.POSTS, ReportType.HASHTAGS, ReportType.FOLLOWERS, ReportType.FULL]),
    format: z.enum([ReportFormat.PDF, ReportFormat.CSV]),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    platforms: z.string().optional(),
  }),
});

/**
 * GET /api/v1/reports
 * List scheduled reports for workspace
 */
router.get('/', requireAuth, requireWorkspace, async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;

    const reports = await ScheduledReport.find({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'email name')
      .lean();

    res.json({
      success: true,
      data: reports,
    });
  } catch (error: any) {
    logger.error('Failed to list reports', {
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to list reports',
    });
    return;
  }
});

/**
 * POST /api/v1/reports
 * Create scheduled report
 */
router.post('/', requireAuth, requireWorkspace, validateRequest(createReportSchema), async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { userId } = req.user!;
    const reportData = req.body;

    const report = await ScheduledReport.create({
      ...reportData,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    const populatedReport = await ScheduledReport.findById(report._id)
      .populate('createdBy', 'email name')
      .lean();

    logger.info('Scheduled report created', {
      reportId: report._id.toString(),
      workspaceId,
      name: reportData.name,
    });

    res.status(201).json({
      success: true,
      data: populatedReport,
    });
  } catch (error: any) {
    logger.error('Failed to create report', {
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create report',
    });
    return;
  }
});

/**
 * PATCH /api/v1/reports/:id
 * Update scheduled report
 */
router.patch('/:id', requireAuth, requireWorkspace, validateRequest(updateReportSchema), async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { id } = req.params;
    const updates = req.body;

    const report = await ScheduledReport.findOneAndUpdate(
      {
        _id: id,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      },
      updates,
      { new: true }
    ).populate('createdBy', 'email name');

    if (!report) {
      res.status(404).json({
        success: false,
        error: 'Report not found',
      });
      return;
    }

    logger.info('Scheduled report updated', {
      reportId: id,
      workspaceId,
    });

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    logger.error('Failed to update report', {
      reportId: req.params.id,
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update report',
    });
    return;
  }
});

/**
 * DELETE /api/v1/reports/:id
 * Delete scheduled report
 */
router.delete('/:id', requireAuth, requireWorkspace, async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { id } = req.params;

    const report = await ScheduledReport.findOneAndDelete({
      _id: id,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!report) {
      res.status(404).json({
        success: false,
        error: 'Report not found',
      });
      return;
    }

    logger.info('Scheduled report deleted', {
      reportId: id,
      workspaceId,
    });

    res.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error: any) {
    logger.error('Failed to delete report', {
      reportId: req.params.id,
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to delete report',
    });
    return;
  }
});

/**
 * POST /api/v1/reports/:id/send-now
 * Trigger immediate report generation and email
 */
router.post('/:id/send-now', requireAuth, requireWorkspace, async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { id } = req.params;

    const report = await ScheduledReport.findOne({
      _id: id,
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
    });

    if (!report) {
      res.status(404).json({
        success: false,
        error: 'Report not found',
      });
      return;
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - report.dateRange);

    // Generate report
    let buffer: Buffer;
    if (report.format === ReportFormat.PDF) {
      buffer = await ReportGeneratorService.generatePDF(
        workspaceId.toString(),
        report.reportType,
        startDate,
        endDate,
        report.platforms.length > 0 ? report.platforms : undefined
      );
    } else {
      buffer = await ReportGeneratorService.generateCSV(
        workspaceId.toString(),
        report.reportType,
        startDate,
        endDate,
        report.platforms.length > 0 ? report.platforms : undefined
      );
    }

    // Send email
    await ReportGeneratorService.sendReportEmail(report, buffer, report.format);

    logger.info('Report sent immediately', {
      reportId: id,
      workspaceId,
    });

    res.json({
      success: true,
      message: 'Report sent successfully',
    });
  } catch (error: any) {
    logger.error('Failed to send report immediately', {
      reportId: req.params.id,
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to send report',
    });
    return;
  }
});

/**
 * GET /api/v1/reports/download
 * Download report file
 */
router.get('/download', requireAuth, requireWorkspace, validateRequest(downloadReportSchema), async (req, res): Promise<void> => {
  try {
    const { workspaceId } = req.workspace!;
    const { reportType, format, startDate, endDate, platforms } = req.query;

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    const platformsArray = platforms ? (platforms as string).split(',') : undefined;

    // Generate report
    let buffer: Buffer;
    let contentType: string;
    let filename: string;

    if (format === ReportFormat.PDF) {
      buffer = await ReportGeneratorService.generatePDF(
        workspaceId.toString(),
        reportType as ReportType,
        start,
        end,
        platformsArray
      );
      contentType = 'application/pdf';
      filename = `analytics-${reportType}-${start.toISOString().split('T')[0]}.pdf`;
    } else {
      buffer = await ReportGeneratorService.generateCSV(
        workspaceId.toString(),
        reportType as ReportType,
        start,
        end,
        platformsArray
      );
      contentType = 'text/csv';
      filename = `analytics-${reportType}-${start.toISOString().split('T')[0]}.csv`;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

    logger.info('Report downloaded', {
      workspaceId,
      reportType,
      format,
    });
  } catch (error: any) {
    logger.error('Failed to download report', {
      workspaceId: req.workspace?.workspaceId,
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to generate report',
    });
    return;
  }
});

export default router;
