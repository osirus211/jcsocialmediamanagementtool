/**
 * BulkUploadService Tests
 */

import { BulkUploadService } from '../BulkUploadService';
import { BulkUploadJob } from '../../models/BulkUploadJob';
import { SocialAccount } from '../../models/SocialAccount';
import { Media } from '../../models/Media';
import { postService } from '../PostService';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../models/BulkUploadJob');
jest.mock('../../models/SocialAccount');
jest.mock('../../models/Media');
jest.mock('../PostService');

describe('BulkUploadService', () => {
  let bulkUploadService: BulkUploadService;
  const mockWorkspaceId = new mongoose.Types.ObjectId().toString();
  const mockUserId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    bulkUploadService = BulkUploadService.getInstance();
    jest.clearAllMocks();
  });

  describe('uploadCSV', () => {
    it('should successfully process a valid CSV with timezone support', async () => {
      const csvContent = `text,platform,scheduled_time,media_url,timezone
"Test post 1","twitter","2024-12-25 10:00","","America/New_York"
"Test post 2","facebook,instagram","2024-12-25 14:30","https://example.com/image.jpg","Europe/London"`;

      const mockJob = {
        _id: new mongoose.Types.ObjectId(),
        toJSON: () => ({ id: 'job-123' }),
      };

      (BulkUploadJob.create as jest.Mock).mockResolvedValue(mockJob);
      (BulkUploadJob.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockJob);
      
      // Mock social accounts
      (SocialAccount.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: new mongoose.Types.ObjectId(), provider: 'twitter' },
            { _id: new mongoose.Types.ObjectId(), provider: 'facebook' },
            { _id: new mongoose.Types.ObjectId(), provider: 'instagram' },
          ]),
        }),
      });

      // Mock media resolution
      (Media.findOne as jest.Mock).mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
      });

      // Mock post service
      (postService.createPost as jest.Mock).mockResolvedValue({});

      const fileBuffer = Buffer.from(csvContent, 'utf-8');
      const result = await bulkUploadService.uploadCSV(
        fileBuffer,
        'test.csv',
        mockWorkspaceId,
        mockUserId
      );

      expect(result).toBeDefined();
      expect(BulkUploadJob.create).toHaveBeenCalledWith({
        workspaceId: new mongoose.Types.ObjectId(mockWorkspaceId),
        userId: new mongoose.Types.ObjectId(mockUserId),
        filename: 'test.csv',
        totalRows: 2,
        processedRows: 0,
        successCount: 0,
        failureCount: 0,
        status: 'pending',
        errors: [],
      });
    });

    it('should detect and reject duplicate posts', async () => {
      const csvContent = `text,platform,scheduled_time,timezone
"Duplicate post","twitter","2024-12-25 10:00","UTC"
"Duplicate post","twitter","2024-12-25 10:00","UTC"`;

      const mockJob = {
        _id: new mongoose.Types.ObjectId(),
        toJSON: () => ({ id: 'job-123' }),
      };

      (BulkUploadJob.create as jest.Mock).mockResolvedValue(mockJob);
      (BulkUploadJob.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockJob);
      
      // Mock social accounts
      (SocialAccount.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: new mongoose.Types.ObjectId(), provider: 'twitter' },
          ]),
        }),
      });

      const fileBuffer = Buffer.from(csvContent, 'utf-8');
      await bulkUploadService.uploadCSV(
        fileBuffer,
        'test.csv',
        mockWorkspaceId,
        mockUserId
      );

      // Verify that the second post was rejected as duplicate
      expect(BulkUploadJob.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(mongoose.Types.ObjectId),
        expect.objectContaining({
          status: 'completed',
          successCount: 1,
          failureCount: 1,
          errors: expect.arrayContaining([
            expect.objectContaining({
              error: 'Duplicate post detected (same content, platforms, and time)',
            }),
          ]),
        })
      );
    });

    it('should validate timezone formats', async () => {
      const csvContent = `text,platform,scheduled_time,timezone
"Test post","twitter","2024-12-25 10:00","Invalid/Timezone"`;

      const mockJob = {
        _id: new mongoose.Types.ObjectId(),
        toJSON: () => ({ id: 'job-123' }),
      };

      (BulkUploadJob.create as jest.Mock).mockResolvedValue(mockJob);
      (BulkUploadJob.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockJob);

      const fileBuffer = Buffer.from(csvContent, 'utf-8');
      await bulkUploadService.uploadCSV(
        fileBuffer,
        'test.csv',
        mockWorkspaceId,
        mockUserId
      );

      expect(BulkUploadJob.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.any(mongoose.Types.ObjectId),
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              error: expect.stringContaining('Invalid scheduled_time format or timezone'),
            }),
          ]),
        })
      );
    });

    it('should enforce 500 post limit', async () => {
      // Create CSV with 501 rows
      let csvContent = 'text,platform,scheduled_time\n';
      for (let i = 1; i <= 501; i++) {
        csvContent += `"Post ${i}","twitter","2024-12-25 10:00"\n`;
      }

      const fileBuffer = Buffer.from(csvContent, 'utf-8');
      
      await expect(
        bulkUploadService.uploadCSV(
          fileBuffer,
          'test.csv',
          mockWorkspaceId,
          mockUserId
        )
      ).rejects.toThrow('CSV file exceeds maximum of 500 rows');
    });

    it('should handle media URL resolution', async () => {
      const csvContent = `text,platform,scheduled_time,media_url
"Post with media","twitter","2024-12-25 10:00","https://example.com/image.jpg,https://example.com/video.mp4"`;

      const mockJob = {
        _id: new mongoose.Types.ObjectId(),
        toJSON: () => ({ id: 'job-123' }),
      };

      (BulkUploadJob.create as jest.Mock).mockResolvedValue(mockJob);
      (BulkUploadJob.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockJob);
      
      // Mock social accounts
      (SocialAccount.find as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { _id: new mongoose.Types.ObjectId(), provider: 'twitter' },
          ]),
        }),
      });

      // Mock media resolution
      (Media.findOne as jest.Mock)
        .mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId() })
        .mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId() });

      (postService.createPost as jest.Mock).mockResolvedValue({});

      const fileBuffer = Buffer.from(csvContent, 'utf-8');
      await bulkUploadService.uploadCSV(
        fileBuffer,
        'test.csv',
        mockWorkspaceId,
        mockUserId
      );

      expect(Media.findOne).toHaveBeenCalledTimes(2);
      expect(postService.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaIds: expect.arrayContaining([expect.any(String)]),
        })
      );
    });
  });
});