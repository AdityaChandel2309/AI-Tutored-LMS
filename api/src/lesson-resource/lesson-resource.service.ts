import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  getResourceBucket,
  getResourcePresignDownloadTtlSec,
  getResourcePresignUploadTtlSec,
  getResourceUploadMaxBytes,
} from '../config/runtime';

@Injectable()
export class LessonResourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async getActiveUser(tenantId: string, authUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { keycloakId: authUserId, tenantId, isActive: true },
    });
    if (!user) throw new ForbiddenException('User not in tenant');
    return user;
  }

  private async getEditableLesson(tenantId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId },
      include: { module: { include: { course: { select: { tenantId: true, id: true, status: true } } } } },
    });
    if (!lesson || lesson.module.course.tenantId !== tenantId) {
      throw new NotFoundException('Lesson not found in current tenant');
    }
    return lesson;
  }

  async requestUploadUrl(input: {
    tenantId: string;
    userId: string;
    lessonId: string;
    label: string;
    fileName: string;
    mimeType: string;
  }) {
    const lesson = await this.getEditableLesson(input.tenantId, input.lessonId);
    const uploader = await this.getActiveUser(input.tenantId, input.userId);

    const resourceId = crypto.randomUUID();
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
    const objectKey = `resources/${input.tenantId}/${lesson.module.course.id}/${lesson.id}/${resourceId}-${safeName}`;

    const uploadUrl = await this.storage.getPresignedPutUrl({
      objectKey,
      contentType: input.mimeType || 'application/octet-stream',
      bucket: getResourceBucket(),
      expiresInSeconds: getResourcePresignUploadTtlSec(),
    });

    return {
      resourceId,
      uploadUrl,
      objectKey,
      uploaderId: uploader.id,
      maxSizeBytes: getResourceUploadMaxBytes(),
      expiresAt: new Date(
        Date.now() + getResourcePresignUploadTtlSec() * 1000,
      ).toISOString(),
    };
  }

  async confirmUpload(input: {
    tenantId: string;
    userId: string;
    lessonId: string;
    resourceId: string;
    objectKey: string;
    label: string;
    fileName: string;
    mimeType: string;
  }) {
    await this.getEditableLesson(input.tenantId, input.lessonId);
    const uploader = await this.getActiveUser(input.tenantId, input.userId);

    const head = await this.storage.headObject({
      objectKey: input.objectKey,
      bucket: getResourceBucket(),
    });
    if (!head.exists) {
      throw new BadRequestException('Uploaded file not found in storage');
    }
    const max = getResourceUploadMaxBytes();
    if (head.contentLength && head.contentLength > max) {
      await this.storage.deleteObject({
        objectKey: input.objectKey,
        bucket: getResourceBucket(),
      });
      throw new BadRequestException(
        `File exceeds maximum size of ${Math.round(max / 1024 / 1024)} MB`,
      );
    }

    return this.prisma.lessonResource.create({
      data: {
        id: input.resourceId,
        tenantId: input.tenantId,
        lessonId: input.lessonId,
        label: input.label?.trim() || input.fileName,
        fileName: input.fileName,
        mimeType: input.mimeType || head.contentType || 'application/octet-stream',
        sizeBytes: head.contentLength ?? null,
        objectKey: input.objectKey,
        uploadedBy: uploader.id,
      },
    });
  }

  async listForLesson(input: {
    tenantId: string;
    userId: string;
    lessonId: string;
  }) {
    const lesson = await this.getEditableLesson(input.tenantId, input.lessonId);
    // Learner access: must be enrolled OR uploader/admin/instructor.
    // getEditableLesson already tenant-scoped; enforce enrollment for non-editors is done in controller via roles.
    void lesson;
    return this.prisma.lessonResource.findMany({
      where: { tenantId: input.tenantId, lessonId: input.lessonId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getDownloadUrl(input: {
    tenantId: string;
    userId: string;
    resourceId: string;
  }) {
    const resource = await this.resolveDownloadableResource(input);

    const url = await this.storage.getPresignedGetUrl({
      objectKey: resource.objectKey,
      bucket: getResourceBucket(),
      expiresInSeconds: getResourcePresignDownloadTtlSec(),
    });

    return {
      url,
      fileName: resource.fileName,
      mimeType: resource.mimeType,
      sizeBytes: resource.sizeBytes,
      expiresAt: new Date(
        Date.now() + getResourcePresignDownloadTtlSec() * 1000,
      ).toISOString(),
    };
  }

  async getDownloadFile(input: {
    tenantId: string;
    userId: string;
    resourceId: string;
  }) {
    const resource = await this.resolveDownloadableResource(input);
    const data = await this.storage.getObjectBuffer({
      objectKey: resource.objectKey,
      bucket: getResourceBucket(),
    });

    return {
      data,
      fileName: resource.fileName,
      mimeType: resource.mimeType || 'application/octet-stream',
    };
  }

  async deleteResource(tenantId: string, resourceId: string) {
    const resource = await this.prisma.lessonResource.findFirst({
      where: { id: resourceId, tenantId },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    await this.storage
      .deleteObject({ objectKey: resource.objectKey, bucket: getResourceBucket() })
      .catch(() => undefined);
    await this.prisma.lessonResource.delete({ where: { id: resourceId } });
    return { deleted: true };
  }

  private async resolveDownloadableResource(input: {
    tenantId: string;
    userId: string;
    resourceId: string;
  }) {
    const resource = await this.prisma.lessonResource.findFirst({
      where: { id: input.resourceId, tenantId: input.tenantId },
      include: {
        lesson: {
          include: { module: { include: { course: true } } },
        },
      },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    const user = await this.getActiveUser(input.tenantId, input.userId);
    const isEditor =
      user.roles.includes('admin') || user.roles.includes('instructor');

    if (!isEditor) {
      const enrolled = await this.prisma.enrollment.findFirst({
        where: { userId: user.id, courseId: resource.lesson.module.courseId },
      });
      if (!enrolled) {
        throw new ForbiddenException('Enroll in the course to download resources');
      }
    }

    return resource;
  }
}