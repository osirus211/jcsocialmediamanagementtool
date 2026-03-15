/**
 * Video Transcoding Service
 * Handles video format conversion using FFmpeg
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { Media, MediaStatus } from '../models/Media';
import { mediaStorageService } from './MediaStorageService';

// Configure fluent-ffmpeg to use the installed ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export class VideoTranscodingService {
  private static instance: VideoTranscodingService;

  static getInstance(): VideoTranscodingService {
    if (!VideoTranscodingService.instance) {
      VideoTranscodingService.instance = new VideoTranscodingService();
    }
    return VideoTranscodingService.instance;
  }

  /**
   * Check if video format is supported natively by platforms
   */
  isFormatSupported(format: string): boolean {
    const supportedFormats = ['mp4', 'webm', 'mov'];
    const normalizedFormat = format.toLowerCase().replace('video/', '');
    
    // Handle common MIME type variations
    const formatMap: Record<string, string> = {
      'quicktime': 'mov',
      'x-msvideo': 'avi',
      'x-matroska': 'mkv',
    };
    
    const actualFormat = formatMap[normalizedFormat] || normalizedFormat;
    return supportedFormats.includes(actualFormat);
  }

  /**
   * Transcode video to MP4 format
   */
  async transcodeToMp4(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      fs.mkdir(outputDir, { recursive: true }).catch(() => {
        // Directory might already exist, ignore error
      });

      logger.info('Starting video transcoding', { inputPath, outputPath });

      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')
        .outputOptions([
          '-preset fast',
          '-crf 23', // Good quality/size balance
          '-movflags +faststart', // Optimize for web streaming
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          logger.info('FFmpeg transcoding started', { command: commandLine });
        })
        .on('progress', (progress) => {
          logger.debug('Transcoding progress', { 
            percent: progress.percent,
            timemark: progress.timemark 
          });
        })
        .on('end', () => {
          logger.info('Video transcoding completed', { inputPath, outputPath });
          resolve();
        })
        .on('error', (err) => {
          logger.error('Video transcoding failed', { 
            error: err.message, 
            inputPath, 
            outputPath 
          });
          reject(new Error(`Transcoding failed: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Process uploaded video - transcode if needed
   */
  async processUploadedVideo(mediaId: string, workspaceId: string): Promise<void> {
    try {
      const media = await Media.findOne({
        _id: mediaId,
        workspaceId: workspaceId,
      });

      if (!media) {
        throw new Error('Media not found');
      }

      // Check if transcoding is needed
      if (this.isFormatSupported(media.mimeType)) {
        logger.info('Video format already supported, skipping transcoding', {
          mediaId,
          mimeType: media.mimeType,
        });
        return;
      }

      // Update status to processing
      await Media.updateOne(
        { _id: mediaId },
        {
          $set: {
            'metadata.processing.transcoding': true,
          }
        }
      );

      // Create temporary paths
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });

      const inputPath = path.join(tempDir, `input_${mediaId}.${this.getFileExtension(media.mimeType)}`);
      const outputPath = path.join(tempDir, `output_${mediaId}.mp4`);

      try {
        // Download original file
        const originalBuffer = await mediaStorageService.downloadFile(media.storageKey);
        await fs.writeFile(inputPath, originalBuffer);

        // Transcode to MP4
        await this.transcodeToMp4(inputPath, outputPath);

        // Upload transcoded file
        const transcodedBuffer = await fs.readFile(outputPath);
        const newStorageKey = media.storageKey.replace(/\.[^.]+$/, '.mp4');
        
        await mediaStorageService.uploadBuffer(
          newStorageKey,
          transcodedBuffer,
          'video/mp4'
        );

        // Update media record
        await Media.updateOne(
          { _id: mediaId },
          {
            $set: {
              mimeType: 'video/mp4',
              storageKey: newStorageKey,
              storageUrl: mediaStorageService.getPublicUrl(newStorageKey),
              size: transcodedBuffer.length,
              'metadata.transcoded': true,
              'metadata.originalFormat': media.mimeType,
            },
            $unset: {
              'metadata.processing.transcoding': '',
            }
          }
        );

        // Delete original file if different
        if (newStorageKey !== media.storageKey) {
          try {
            await mediaStorageService.deleteFile(media.storageKey);
          } catch (error) {
            logger.warn('Failed to delete original file after transcoding', {
              storageKey: media.storageKey,
              error,
            });
          }
        }

        logger.info('Video transcoding completed successfully', {
          mediaId,
          originalFormat: media.mimeType,
          newFormat: 'video/mp4',
          originalSize: media.size,
          newSize: transcodedBuffer.length,
        });

      } finally {
        // Clean up temporary files
        try {
          await fs.unlink(inputPath);
          await fs.unlink(outputPath);
        } catch (cleanupError) {
          logger.warn('Failed to clean up temporary files', { cleanupError });
        }
      }

    } catch (error) {
      logger.error('Video processing failed', { mediaId, error });

      // Mark as failed
      await Media.updateOne(
        { _id: mediaId },
        {
          $set: {
            status: MediaStatus.FAILED,
            'metadata.processingError': error instanceof Error ? error.message : 'Transcoding failed',
          },
          $unset: {
            'metadata.processing.transcoding': '',
          }
        }
      );

      throw error;
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtension(mimeType: string): string {
    const extensionMap: Record<string, string> = {
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
      'video/webm': 'webm',
      'video/x-matroska': 'mkv',
      'video/x-ms-wmv': 'wmv',
      'video/3gpp': '3gp',
    };

    return extensionMap[mimeType] || 'mp4';
  }
}

// Export singleton instance
export const videoTranscodingService = VideoTranscodingService.getInstance();