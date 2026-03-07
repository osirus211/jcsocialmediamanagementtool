import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Represents a validation error for a video file
 */
export interface ValidationError {
  field: string;
  message: string;
  requirement: string;
}

/**
 * Result of video validation
 */
export interface VideoValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Video metadata extracted from file
 */
interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  format: string;
}

/**
 * VideoValidator validates video files against TikTok's requirements
 * 
 * Requirements:
 * - Format: MP4 or WebM only
 * - Size: ≤ 287 MB (301,989,888 bytes)
 * - Duration: 3-60 seconds
 * - Resolution: ≥ 720x1280 pixels
 * - Aspect Ratio: 9:16 (±5% tolerance) or 1:1 (±5% tolerance)
 */
export class VideoValidator {
  private static readonly MAX_SIZE_BYTES = 301989888; // 287 MB
  private static readonly MIN_DURATION_SECONDS = 3;
  private static readonly MAX_DURATION_SECONDS = 60;
  private static readonly MIN_WIDTH = 720;
  private static readonly MIN_HEIGHT = 1280;
  private static readonly ASPECT_RATIO_TOLERANCE = 0.05; // 5%

  /**
   * Validates a video file against TikTok's requirements
   * 
   * @param file - Video file buffer
   * @param mimeType - MIME type of the video file
   * @returns Validation result with any errors found
   */
  async validateVideo(file: Buffer, mimeType: string): Promise<VideoValidationResult> {
    const errors: ValidationError[] = [];

    // Validate format
    const formatError = this.validateFormat(mimeType);
    if (formatError) {
      errors.push(formatError);
    }

    // Validate size
    const sizeError = this.validateSize(file.length);
    if (sizeError) {
      errors.push(sizeError);
    }

    // If format or size is invalid, skip metadata extraction
    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Extract metadata and validate duration, resolution, and aspect ratio
    try {
      const metadata = await this.extractVideoMetadata(file);

      const durationError = this.validateDuration(metadata.duration);
      if (durationError) {
        errors.push(durationError);
      }

      const resolutionError = this.validateResolution(metadata.width, metadata.height);
      if (resolutionError) {
        errors.push(resolutionError);
      }

      const aspectRatioError = this.validateAspectRatio(metadata.width, metadata.height);
      if (aspectRatioError) {
        errors.push(aspectRatioError);
      }
    } catch (error) {
      errors.push({
        field: 'video',
        message: 'Failed to extract video metadata. The file may be corrupted or invalid.',
        requirement: 'Valid video file',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates video format (MP4 or WebM only)
   * 
   * @param mimeType - MIME type of the video file
   * @returns Validation error if format is invalid, null otherwise
   */
  validateFormat(mimeType: string): ValidationError | null {
    const validFormats = ['video/mp4', 'video/webm'];
    
    if (!validFormats.includes(mimeType.toLowerCase())) {
      return {
        field: 'format',
        message: `Invalid video format. Received: ${mimeType}. Only MP4 and WebM formats are supported.`,
        requirement: 'Format must be MP4 or WebM',
      };
    }

    return null;
  }

  /**
   * Validates video file size (≤ 287 MB)
   * 
   * @param fileSize - Size of the video file in bytes
   * @returns Validation error if size exceeds limit, null otherwise
   */
  validateSize(fileSize: number): ValidationError | null {
    if (fileSize > VideoValidator.MAX_SIZE_BYTES) {
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
      return {
        field: 'size',
        message: `Video file size (${sizeMB} MB) exceeds the maximum allowed size of 287 MB.`,
        requirement: 'File size must be ≤ 287 MB',
      };
    }

    return null;
  }

  /**
   * Validates video duration (3-60 seconds)
   * 
   * @param duration - Duration of the video in seconds
   * @returns Validation error if duration is out of range, null otherwise
   */
  validateDuration(duration: number): ValidationError | null {
    if (duration < VideoValidator.MIN_DURATION_SECONDS) {
      return {
        field: 'duration',
        message: `Video duration (${duration.toFixed(1)}s) is too short. Minimum duration is 3 seconds.`,
        requirement: 'Duration must be between 3 and 60 seconds',
      };
    }

    if (duration > VideoValidator.MAX_DURATION_SECONDS) {
      return {
        field: 'duration',
        message: `Video duration (${duration.toFixed(1)}s) is too long. Maximum duration is 60 seconds.`,
        requirement: 'Duration must be between 3 and 60 seconds',
      };
    }

    return null;
  }

  /**
   * Validates video resolution (≥ 720x1280 pixels)
   * 
   * @param width - Width of the video in pixels
   * @param height - Height of the video in pixels
   * @returns Validation error if resolution is below minimum, null otherwise
   */
  validateResolution(width: number, height: number): ValidationError | null {
    if (width < VideoValidator.MIN_WIDTH || height < VideoValidator.MIN_HEIGHT) {
      return {
        field: 'resolution',
        message: `Video resolution (${width}x${height}) is below the minimum required resolution of 720x1280 pixels.`,
        requirement: 'Resolution must be at least 720x1280 pixels',
      };
    }

    return null;
  }

  /**
   * Validates video aspect ratio (9:16 or 1:1 with ±5% tolerance)
   * 
   * @param width - Width of the video in pixels
   * @param height - Height of the video in pixels
   * @returns Validation error if aspect ratio is not supported, null otherwise
   */
  validateAspectRatio(width: number, height: number): ValidationError | null {
    const aspectRatio = width / height;
    
    // Target aspect ratios
    const verticalRatio = 9 / 16; // 0.5625
    const squareRatio = 1 / 1; // 1.0
    
    // Calculate tolerance ranges
    const verticalMin = verticalRatio * (1 - VideoValidator.ASPECT_RATIO_TOLERANCE);
    const verticalMax = verticalRatio * (1 + VideoValidator.ASPECT_RATIO_TOLERANCE);
    const squareMin = squareRatio * (1 - VideoValidator.ASPECT_RATIO_TOLERANCE);
    const squareMax = squareRatio * (1 + VideoValidator.ASPECT_RATIO_TOLERANCE);
    
    // Check if aspect ratio falls within acceptable ranges
    const isVertical = aspectRatio >= verticalMin && aspectRatio <= verticalMax;
    const isSquare = aspectRatio >= squareMin && aspectRatio <= squareMax;
    
    if (!isVertical && !isSquare) {
      return {
        field: 'aspectRatio',
        message: `Video aspect ratio (${aspectRatio.toFixed(3)}) is not supported. Supported ratios are 9:16 (vertical) or 1:1 (square) with ±5% tolerance.`,
        requirement: 'Aspect ratio must be 9:16 or 1:1 (±5% tolerance)',
      };
    }

    return null;
  }

  /**
   * Extracts video metadata using ffprobe
   * 
   * @param file - Video file buffer
   * @returns Video metadata including duration, width, height, and format
   * @throws Error if metadata extraction fails
   */
  private async extractVideoMetadata(file: Buffer): Promise<VideoMetadata> {
    let tempFilePath: string | null = null;

    try {
      // Create a temporary file to store the video buffer
      tempFilePath = path.join(os.tmpdir(), `video-${Date.now()}-${Math.random().toString(36).substring(7)}.tmp`);
      await fs.writeFile(tempFilePath, file);

      // Use ffprobe to extract video metadata
      const { stdout } = await execAsync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,codec_name -of json "${tempFilePath}"`
      );

      const probeData = JSON.parse(stdout);
      
      if (!probeData.streams || probeData.streams.length === 0) {
        throw new Error('No video stream found in file');
      }

      const stream = probeData.streams[0];
      
      // If duration is not in stream, try to get it from format
      let duration = parseFloat(stream.duration);
      if (!duration || isNaN(duration)) {
        const { stdout: formatStdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of json "${tempFilePath}"`
        );
        const formatData = JSON.parse(formatStdout);
        duration = parseFloat(formatData.format?.duration);
      }

      return {
        duration: duration || 0,
        width: parseInt(stream.width, 10) || 0,
        height: parseInt(stream.height, 10) || 0,
        format: stream.codec_name || 'unknown',
      };
    } finally {
      // Clean up temporary file
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }
}
