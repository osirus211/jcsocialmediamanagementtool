import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface GifConversionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-51, lower is better quality
  fps?: number;
}

export class GifToVideoService {
  private readonly tempDir: string;

  constructor() {
    this.tempDir = tmpdir();
  }

  /**
   * Convert GIF buffer to MP4 video buffer
   * Used for Instagram which doesn't support animated GIFs
   */
  async convertGifToMp4(
    gifBuffer: Buffer,
    options: GifConversionOptions = {}
  ): Promise<Buffer> {
    const {
      maxWidth = 1080,
      maxHeight = 1080,
      quality = 23,
      fps = 15
    } = options;

    const tempId = randomUUID();
    const inputPath = join(this.tempDir, `${tempId}_input.gif`);
    const outputPath = join(this.tempDir, `${tempId}_output.mp4`);

    try {
      // Write GIF buffer to temporary file
      await writeFile(inputPath, gifBuffer);

      // Build ffmpeg command
      const scaleFilter = `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease`;
      const command = [
        'ffmpeg',
        '-i', inputPath,
        '-vf', `${scaleFilter},fps=${fps}`,
        '-c:v', 'libx264',
        '-crf', quality.toString(),
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-y', // Overwrite output file
        outputPath
      ].join(' ');

      logger.info('Converting GIF to MP4', { command });

      // Execute ffmpeg conversion
      await execAsync(command);

      // Read the converted video
      const { readFile } = await import('fs/promises');
      const videoBuffer = await readFile(outputPath);

      return videoBuffer;
    } catch (error) {
      logger.error('Failed to convert GIF to MP4', { error });
      throw new Error('GIF to video conversion failed');
    } finally {
      // Clean up temporary files
      try {
        await unlink(inputPath);
        await unlink(outputPath);
      } catch (cleanupError) {
        logger.warn('Failed to clean up temporary files', { cleanupError });
      }
    }
  }

  /**
   * Check if ffmpeg is available
   */
  async checkFfmpegAvailability(): Promise<boolean> {
    try {
      await execAsync('ffmpeg -version');
      return true;
    } catch (error) {
      logger.warn('ffmpeg not available for GIF conversion', { error });
      return false;
    }
  }

  /**
   * Get video metadata from converted file
   */
  async getVideoMetadata(videoBuffer: Buffer): Promise<{
    duration: number;
    width: number;
    height: number;
    size: number;
  }> {
    const tempId = randomUUID();
    const videoPath = join(this.tempDir, `${tempId}_metadata.mp4`);

    try {
      await writeFile(videoPath, videoBuffer);

      const command = [
        'ffprobe',
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ].join(' ');

      const { stdout } = await execAsync(command);
      const metadata = JSON.parse(stdout);

      const videoStream = metadata.streams.find((stream: any) => stream.codec_type === 'video');
      
      return {
        duration: parseFloat(metadata.format.duration) || 0,
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        size: videoBuffer.length
      };
    } catch (error) {
      logger.error('Failed to get video metadata', { error });
      throw new Error('Failed to get video metadata');
    } finally {
      try {
        await unlink(videoPath);
      } catch (cleanupError) {
        logger.warn('Failed to clean up metadata temp file', { cleanupError });
      }
    }
  }
}