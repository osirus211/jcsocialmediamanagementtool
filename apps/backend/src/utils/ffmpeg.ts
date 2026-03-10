/**
 * FFmpeg utilities for video processing
 * Handles video metadata extraction, thumbnail generation, and video trimming
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger';

// Configure fluent-ffmpeg to use the installed ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

/**
 * Extract video metadata using ffmpeg
 */
export async function extractVideoMetadata(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        logger.error('Failed to extract video metadata', { error: err.message, filePath });
        reject(new Error(`Failed to extract video metadata: ${err.message}`));
        return;
      }

      try {
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        if (!videoStream) {
          throw new Error('No video stream found');
        }

        const duration = metadata.format.duration || 0;
        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        const fps = eval(videoStream.r_frame_rate || '0') || 0;

        resolve({
          duration,
          width,
          height,
          fps
        });
      } catch (parseError) {
        logger.error('Failed to parse video metadata', { error: parseError, filePath });
        reject(new Error(`Failed to parse video metadata: ${parseError}`));
      }
    });
  });
}

/**
 * Generate thumbnail from video at specified time offset
 */
export async function generateThumbnail(
  filePath: string,
  outputPath: string,
  timeOffset: number = 1
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    fs.mkdir(outputDir, { recursive: true }).catch(() => {
      // Directory might already exist, ignore error
    });

    ffmpeg(filePath)
      .seekInput(timeOffset)
      .frames(1)
      .size('640x?')
      .format('image2')
      .output(outputPath)
      .on('end', () => {
        logger.info('Thumbnail generated successfully', { filePath, outputPath, timeOffset });
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Failed to generate thumbnail', { 
          error: err.message, 
          filePath, 
          outputPath, 
          timeOffset 
        });
        reject(new Error(`Failed to generate thumbnail: ${err.message}`));
      })
      .run();
  });
}

/**
 * Trim video between start and end times
 */
export async function trimVideo(
  filePath: string,
  outputPath: string,
  startTime: number,
  endTime: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (startTime >= endTime) {
      reject(new Error('Start time must be less than end time'));
      return;
    }

    if (startTime < 0) {
      reject(new Error('Start time cannot be negative'));
      return;
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    fs.mkdir(outputDir, { recursive: true }).catch(() => {
      // Directory might already exist, ignore error
    });

    const duration = endTime - startTime;

    ffmpeg(filePath)
      .seekInput(startTime)
      .duration(duration)
      .videoCodec('copy')
      .audioCodec('copy')
      .output(outputPath)
      .on('end', () => {
        logger.info('Video trimmed successfully', { 
          filePath, 
          outputPath, 
          startTime, 
          endTime, 
          duration 
        });
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Failed to trim video', { 
          error: err.message, 
          filePath, 
          outputPath, 
          startTime, 
          endTime 
        });
        reject(new Error(`Failed to trim video: ${err.message}`));
      })
      .run();
  });
}