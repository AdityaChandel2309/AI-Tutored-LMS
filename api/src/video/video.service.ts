import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { VideoStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EventBus } from '../events/event-bus';
import { VideoProcessingService } from './video-processing.service';
import { validateUploadMimeType, VIDEO_MIME_TYPES } from '../common/pipes/file-validation.pipe';
import {
  getVideoBucket,
  getVideoPresignUploadTtlSec,
  getVideoPresignStreamTtlSec,
  getVideoUploadMaxBytes,
  getVideoStorageQuotaBytes,
  getVideoThumbnailBucket,
} from '../config/runtime';

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly eventBus: EventBus,
    private readonly videoProcessing: VideoProcessingService,
  ) {}

  /**
   * Generate a presigned PUT URL for direct browser-to-MinIO upload.
   * Creates a Video record with status PENDING.
   */
  async requestUploadUrl(input: {
    courseId: string;
    tenantId: string;
    userId: string;
    title: string;
    mimeType: string;
    fileName?: string;
  }) {
    // Verify course ownership + tenant scope
    validateUploadMimeType(input.mimeType, VIDEO_MIME_TYPES);
    const course = await this.prisma.course.findFirst({
      where: {
        id: input.courseId,
        tenantId: input.tenantId,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found in this tenant');
    }

    const uploader = await this.getActiveUser({
      tenantId: input.tenantId,
      authUserId: input.userId,
    });

    // Check tenant quota
    await this.enforceQuota(input.tenantId);

    // Determine file extension
    const ext = this.mimeToExt(input.mimeType);
    const timestamp = Date.now();
    const videoId = crypto.randomUUID();
    const objectKey = `videos/${input.tenantId}/${input.courseId}/${videoId}-${timestamp}${ext}`;

    // Create Video record
    const video = await this.prisma.video.create({
      data: {
        id: videoId,
        tenantId: input.tenantId,
        courseId: input.courseId,
        title: input.title,
        status: VideoStatus.PENDING,
        objectKey,
        mimeType: input.mimeType,
        uploadedBy: uploader.id,
      },
    });

    // Generate presigned PUT URL
    const uploadUrl = await this.storage.getPresignedPutUrl({
      objectKey,
      contentType: input.mimeType,
      bucket: getVideoBucket(),
      expiresInSeconds: getVideoPresignUploadTtlSec(),
    });

    return {
      videoId: video.id,
      uploadUrl,
      objectKey,
      maxSizeBytes: getVideoUploadMaxBytes(),
      expiresAt: new Date(
        Date.now() + getVideoPresignUploadTtlSec() * 1000,
      ).toISOString(),
    };
  }

  /**
   * Confirm that the upload completed successfully.
   * Verifies the object exists in storage and updates status to READY.
   */
  async confirmUpload(input: {
    videoId: string;
    tenantId: string;
    lessonId?: string;
  }) {
    const video = await this.prisma.video.findFirst({
      where: {
        id: input.videoId,
        tenantId: input.tenantId,
        status: VideoStatus.PENDING,
      },
    });

    if (!video) {
      throw new NotFoundException('Video not found or already confirmed');
    }

    // Verify object exists in storage
    const headResult = await this.storage.headObject({
      objectKey: video.objectKey,
      bucket: getVideoBucket(),
    });

    if (!headResult.exists) {
      // Mark as failed
      await this.prisma.video.update({
        where: { id: video.id },
        data: { status: VideoStatus.FAILED },
      });
      throw new BadRequestException(
        'Upload not found in storage — upload may have failed',
      );
    }

    // Check file size against limit
    if (
      headResult.contentLength &&
      headResult.contentLength > getVideoUploadMaxBytes()
    ) {
      await this.storage.deleteObject({
        objectKey: video.objectKey,
        bucket: getVideoBucket(),
      });
      await this.prisma.video.update({
        where: { id: video.id },
        data: { status: VideoStatus.FAILED },
      });
      throw new BadRequestException(
        `File exceeds maximum size of ${Math.round(getVideoUploadMaxBytes() / 1024 / 1024)} MB`,
      );
    }

    // Update video record
    const updated = await this.prisma.video.update({
      where: { id: video.id },
      data: {
        status: VideoStatus.READY,
        sizeBytes: headResult.contentLength ?? null,
        lessonId: input.lessonId ?? null,
      },
    });

    this.eventBus.emit({
      type: 'video.uploaded',
      tenantId: updated.tenantId,
      timestamp: new Date(),
      actorId: updated.uploadedBy,
      entityId: updated.id,
      entityType: 'video',
      payload: {
        videoId: updated.id,
        courseId: updated.courseId,
      },
    });

    // Fire-and-forget: extract duration + thumbnail in background
    this.processVideoAsync(updated.id, updated.tenantId, updated.objectKey);

    return updated;
  }

  /**
   * Get video metadata.
   */
  async getVideo(videoId: string, tenantId: string) {
    const video = await this.prisma.video.findFirst({
      where: {
        id: videoId,
        tenantId,
        status: {
          not: VideoStatus.DELETED,
        },
      },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    return video;
  }

  /**
   * Generate a presigned GET URL for video playback.
   * Verifies the user is enrolled in the course.
   */
  async getStreamUrl(input: {
    videoId: string;
    userId: string;
    tenantId: string;
    roles?: string[];
  }) {
    const video = await this.prisma.video.findFirst({
      where: {
        id: input.videoId,
        tenantId: input.tenantId,
        status: VideoStatus.READY,
      },
    });

    if (!video) {
      throw new NotFoundException('Video not found or not ready');
    }

    const user = await this.getActiveUser({
      tenantId: input.tenantId,
      authUserId: input.userId,
    });

    const isStaffViewer =
      input.roles?.includes('admin') ||
      input.roles?.includes('super_admin') ||
      input.roles?.includes('instructor');

    // Verify enrollment (learners must be enrolled)
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId: user.id,
        courseId: video.courseId,
      },
    });

    // Allow if enrolled, uploader, or staff previewing course content.
    if (!enrollment && video.uploadedBy !== user.id && !isStaffViewer) {
      throw new ForbiddenException(
        'You must be enrolled in this course to watch videos',
      );
    }

    const url = await this.storage.getPresignedGetUrl({
      objectKey: video.objectKey,
      bucket: getVideoBucket(),
      expiresInSeconds: getVideoPresignStreamTtlSec(),
    });

    return {
      url,
      mimeType: video.mimeType,
      durationSec: video.durationSec,
      expiresAt: new Date(
        Date.now() + getVideoPresignStreamTtlSec() * 1000,
      ).toISOString(),
    };
  }

  /**
   * Soft-delete a video (mark as DELETED, don't remove from storage yet).
   */
  async deleteVideo(videoId: string, tenantId: string) {
    const video = await this.prisma.video.findFirst({
      where: {
        id: videoId,
        tenantId,
        status: {
          not: VideoStatus.DELETED,
        },
      },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    await this.prisma.video.update({
      where: { id: video.id },
      data: { status: VideoStatus.DELETED },
    });

    this.eventBus.emit({
      type: 'video.deleted',
      tenantId: video.tenantId,
      timestamp: new Date(),
      entityId: video.id,
      entityType: 'video',
      payload: {
        videoId: video.id,
        courseId: video.courseId,
      },
    });

    return { deleted: true };
  }

  /**
   * Get a presigned URL for the video thumbnail image.
   */
  async getThumbnailUrl(videoId: string, tenantId: string) {
    const video = await this.prisma.video.findFirst({
      where: {
        id: videoId,
        tenantId,
        status: {
          not: VideoStatus.DELETED,
        },
      },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    if (!video.thumbnailKey) {
      throw new NotFoundException('Thumbnail not available for this video');
    }

    const url = await this.storage.getPresignedGetUrl({
      objectKey: video.thumbnailKey,
      bucket: getVideoThumbnailBucket(),
      expiresInSeconds: getVideoPresignStreamTtlSec(),
    });

    return {
      url,
      expiresAt: new Date(
        Date.now() + getVideoPresignStreamTtlSec() * 1000,
      ).toISOString(),
    };
  }

  // ── Internal helpers ──────────────────────

  private async processVideoAsync(
    videoId: string,
    tenantId: string,
    objectKey: string,
  ) {
    const bucket = getVideoBucket();

    try {
      const [durationSec, thumbnailKey] = await Promise.all([
        this.videoProcessing.probeDuration({ bucket, objectKey }),
        this.videoProcessing.extractThumbnail({
          bucket,
          objectKey,
          tenantId,
          videoId,
        }),
      ]);

      const updateData: { durationSec?: number; thumbnailKey?: string } = {};
      if (durationSec !== null) updateData.durationSec = durationSec;
      if (thumbnailKey !== null) updateData.thumbnailKey = thumbnailKey;

      if (Object.keys(updateData).length > 0) {
        await this.prisma.video.update({
          where: { id: videoId },
          data: updateData,
        });
        this.logger.log(
          `Video ${videoId} processed — duration: ${durationSec ?? 'N/A'}s, thumbnail: ${thumbnailKey ? 'yes' : 'no'}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Background video processing failed for ${videoId}`,
        error,
      );
    }
  }

  private async enforceQuota(tenantId: string) {
    const result = await this.prisma.video.aggregate({
      where: {
        tenantId,
        status: {
          in: [VideoStatus.PENDING, VideoStatus.READY],
        },
      },
      _sum: { sizeBytes: true },
    });

    const totalBytes = result._sum.sizeBytes ?? 0;
    const quota = getVideoStorageQuotaBytes();

    if (totalBytes >= quota) {
      throw new BadRequestException(
        `Tenant video storage quota exceeded (${Math.round(quota / 1024 / 1024 / 1024)} GB)`,
      );
    }
  }

  private async getActiveUser(input: { tenantId: string; authUserId: string }) {
    const user = await this.prisma.user.findFirst({
      where: {
        keycloakId: input.authUserId,
        tenantId: input.tenantId,
        isActive: true,
      },
    });

    if (!user) {
      throw new ForbiddenException(
        'User does not belong to the resolved tenant',
      );
    }

    return user;
  }

  private mimeToExt(mimeType: string): string {
    switch (mimeType) {
      case 'video/webm':
        return '.webm';
      case 'video/quicktime':
        return '.mov';
      case 'video/mp4':
      default:
        return '.mp4';
    }
  }
}
