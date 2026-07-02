import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../storage/storage.service';
import { getVideoBucket, getVideoThumbnailBucket } from '../config/runtime';

const execFileAsync = promisify(execFile);

const TMP_DIR = path.resolve(__dirname, '../../../.tmp-video-processing');

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);

  constructor(private readonly storage: StorageService) {}

  /**
   * Check if ffmpeg/ffprobe is available on the system.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('ffprobe', ['-version']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract video duration in seconds using ffprobe.
   * Returns null if ffprobe is unavailable or processing fails.
   */
  async probeDuration(input: {
    bucket: string;
    objectKey: string;
  }): Promise<number | null> {
    const available = await this.isAvailable();
    if (!available) {
      this.logger.warn(
        'ffprobe is not installed — skipping duration detection',
      );
      return null;
    }

    let tmpFile: string | null = null;

    try {
      tmpFile = await this.downloadToTemp(input.bucket, input.objectKey);

      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        tmpFile,
      ]);

      const duration = parseFloat(stdout.trim());
      if (isNaN(duration)) {
        this.logger.warn('Could not parse duration from ffprobe output');
        return null;
      }

      return Math.round(duration);
    } catch (error) {
      this.logger.error('Failed to probe video duration', error);
      return null;
    } finally {
      await this.cleanupTempFile(tmpFile);
    }
  }

  /**
   * Extract a thumbnail frame at ~1 second and upload to MinIO.
   * Returns the object key of the uploaded thumbnail, or null on failure.
   */
  async extractThumbnail(input: {
    bucket: string;
    objectKey: string;
    tenantId: string;
    videoId: string;
  }): Promise<string | null> {
    const available = await this.isAvailable();
    if (!available) {
      this.logger.warn(
        'ffmpeg is not installed — skipping thumbnail extraction',
      );
      return null;
    }

    let tmpVideoFile: string | null = null;
    let tmpThumbFile: string | null = null;

    try {
      tmpVideoFile = await this.downloadToTemp(input.bucket, input.objectKey);
      tmpThumbFile = path.join(
        TMP_DIR,
        `thumb-${input.videoId}-${Date.now()}.jpg`,
      );

      await execFileAsync('ffmpeg', [
        '-y',
        '-i',
        tmpVideoFile,
        '-ss',
        '1',
        '-vframes',
        '1',
        '-q:v',
        '2',
        tmpThumbFile,
      ]);

      // Verify the thumbnail was actually created
      if (!fs.existsSync(tmpThumbFile)) {
        this.logger.warn('ffmpeg did not produce a thumbnail file');
        return null;
      }

      const thumbnailBuffer = fs.readFileSync(tmpThumbFile);
      const thumbnailBucket = getVideoThumbnailBucket();
      const thumbnailKey = `thumbnails/${input.tenantId}/${input.videoId}.jpg`;

      await this.storage.uploadBuffer({
        bucket: thumbnailBucket,
        objectKey: thumbnailKey,
        body: thumbnailBuffer,
        contentType: 'image/jpeg',
      });

      return thumbnailKey;
    } catch (error) {
      this.logger.error('Failed to extract video thumbnail', error);
      return null;
    } finally {
      await this.cleanupTempFile(tmpVideoFile);
      await this.cleanupTempFile(tmpThumbFile);
    }
  }

  // ── Internal helpers ──────────────────────

  private async downloadToTemp(
    bucket: string,
    objectKey: string,
  ): Promise<string> {
    await fs.promises.mkdir(TMP_DIR, { recursive: true });

    const ext = path.extname(objectKey) || '.mp4';
    const tmpFile = path.join(
      TMP_DIR,
      `video-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`,
    );

    const videoBuffer = await this.storage.getObjectBuffer({
      objectKey,
      bucket,
    });

    fs.writeFileSync(tmpFile, videoBuffer);
    return tmpFile;
  }

  private async cleanupTempFile(filePath: string | null): Promise<void> {
    if (!filePath) return;

    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (error) {
      this.logger.warn(`Failed to clean up temp file: ${filePath}`, error);
    }
  }
}
