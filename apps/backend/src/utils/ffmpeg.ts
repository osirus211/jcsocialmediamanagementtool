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

/**
 * Generate multiple thumbnails from video at different time offsets
 */
export async function generateMultipleThumbnails(
  filePath: string,
  outputDir: string,
  timeOffsets: number[]
): Promise<Array<{ time: number; path: string; label: string }>> {
  const results: Array<{ time: number; path: string; label: string }> = [];
  
  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  for (const timeOffset of timeOffsets) {
    const outputPath = path.join(outputDir, `thumb_${timeOffset}s.jpg`);
    
    try {
      await generateThumbnail(filePath, outputPath, timeOffset);
      
      // Generate label
      let label: string;
      if (timeOffset === 0) {
        label = '0s';
      } else if (timeOffset < 60) {
        label = `${timeOffset}s`;
      } else {
        const minutes = Math.floor(timeOffset / 60);
        const seconds = timeOffset % 60;
        label = seconds > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${minutes}m`;
      }
      
      results.push({
        time: timeOffset,
        path: outputPath,
        label,
      });
    } catch (error) {
      logger.warn('Failed to generate thumbnail at time offset', {
        filePath,
        timeOffset,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Generate thumbnails at percentage points of video duration
 */
export async function generatePercentageThumbnails(
  filePath: string,
  outputDir: string,
  percentages: number[] = [0, 25, 50, 75, 100]
): Promise<Array<{ time: number; path: string; label: string }>> {
  try {
    // Get video metadata first
    const metadata = await extractVideoMetadata(filePath);
    const duration = metadata.duration;
    
    // Calculate time offsets from percentages
    const timeOffsets = percentages.map(percentage => {
      const time = Math.floor((duration * percentage) / 100);
      // Ensure we don't exceed video duration
      return Math.min(time, Math.max(0, duration - 1));
    });
    
    // Generate thumbnails
    const results = await generateMultipleThumbnails(filePath, outputDir, timeOffsets);
    
    // Update labels to show percentages
    return results.map((result, index) => ({
      ...result,
      label: percentages[index] === 0 ? '0s' : `${percentages[index]}%`,
    }));
  } catch (error) {
    logger.error('Failed to generate percentage thumbnails', {
      filePath,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Generate comprehensive thumbnail set (fixed times + percentages)
 */
export async function generateComprehensiveThumbnails(
  filePath: string,
  outputDir: string
): Promise<Array<{ time: number; path: string; label: string }>> {
  try {
    const metadata = await extractVideoMetadata(filePath);
    const duration = metadata.duration;
    
    const thumbnails: Array<{ time: number; label: string }> = [];
    
    // Add fixed time points (if within duration)
    const fixedTimes = [0, 1, 5, 10];
    for (const time of fixedTimes) {
      if (time < duration) {
        thumbnails.push({ time, label: `${time}s` });
      }
    }
    
    // Add percentage points
    const percentages = [25, 50, 75];
    for (const percentage of percentages) {
      const time = Math.floor((duration * percentage) / 100);
      if (time > 0 && time < duration && !thumbnails.some(t => Math.abs(t.time - time) < 2)) {
        thumbnails.push({ time, label: `${percentage}%` });
      }
    }
    
    // Sort by time
    thumbnails.sort((a, b) => a.time - b.time);
    
    // Generate thumbnails
    const timeOffsets = thumbnails.map(t => t.time);
    const results = await generateMultipleThumbnails(filePath, outputDir, timeOffsets);
    
    // Apply correct labels
    return results.map((result, index) => ({
      ...result,
      label: thumbnails[index]?.label || `${result.time}s`,
    }));
  } catch (error) {
    logger.error('Failed to generate comprehensive thumbnails', {
      filePath,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}