import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { lookup as lookupMimeType } from 'mime-types';
import { Prisma, ScormPackage, ScormStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  getScormBucket,
  getScormPresignUploadTtlSec,
  getScormUploadMaxBytes,
} from '../config/runtime';

const ALLOWED_SCORM_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
];

type ManifestMetadata = {
  manifestPath: string;
  manifestIdentifier: string | null;
  scormVersion: string | null;
  title: string | null;
  launchPath: string;
};

@Injectable()
export class ScormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async requestUploadUrl(input: {
    courseId: string;
    tenantId: string;
    userId: string;
    title?: string;
    fileName?: string;
    mimeType?: string;
  }): Promise<{
    packageId: string;
    uploadUrl: string;
    objectKey: string;
    maxSizeBytes: number;
    expiresAt: string;
  }> {
    if (!input.tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    if (input.fileName && !input.fileName.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('SCORM upload must be a zip package');
    }

    if (input.mimeType && !ALLOWED_SCORM_MIME_TYPES.includes(input.mimeType)) {
      throw new BadRequestException('SCORM upload must be a zip package');
    }

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
    const packageId = crypto.randomUUID();
    const objectKey = `scorm/${input.tenantId}/${input.courseId}/${packageId}/package.zip`;
    const title =
      input.title?.trim() || input.fileName?.trim() || 'SCORM Package';

    const scormPackage = await this.prisma.scormPackage.create({
      data: {
        id: packageId,
        tenantId: input.tenantId,
        courseId: input.courseId,
        title,
        status: ScormStatus.PENDING,
        objectKey,
        uploadedBy: uploader.id,
      },
    });

    const uploadUrl = await this.storage.getPresignedPutUrl({
      objectKey,
      contentType: input.mimeType ?? 'application/zip',
      bucket: getScormBucket(),
      expiresInSeconds: getScormPresignUploadTtlSec(),
    });

    return {
      packageId: scormPackage.id,
      uploadUrl,
      objectKey,
      maxSizeBytes: getScormUploadMaxBytes(),
      expiresAt: new Date(
        Date.now() + getScormPresignUploadTtlSec() * 1000,
      ).toISOString(),
    };
  }

  async confirmUpload(input: {
    packageId: string;
    tenantId: string;
    lessonId?: string;
  }): Promise<ScormPackage> {
    if (!input.tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const scormPackage = await this.prisma.scormPackage.findFirst({
      where: {
        id: input.packageId,
        tenantId: input.tenantId,
        status: ScormStatus.PENDING,
      },
    });

    if (!scormPackage) {
      throw new NotFoundException(
        'SCORM package not found or already confirmed',
      );
    }

    if (input.lessonId) {
      const lesson = await this.prisma.lesson.findFirst({
        where: {
          id: input.lessonId,
          module: { courseId: scormPackage.courseId },
        },
      });

      if (!lesson) {
        throw new NotFoundException('Lesson not found for this course');
      }
    }

    const headResult = await this.storage.headObject({
      objectKey: scormPackage.objectKey,
      bucket: getScormBucket(),
    });

    if (!headResult.exists) {
      await this.prisma.scormPackage.update({
        where: { id: scormPackage.id },
        data: { status: ScormStatus.FAILED },
      });
      throw new BadRequestException(
        'Upload not found in storage — upload may have failed',
      );
    }

    if (
      headResult.contentLength &&
      headResult.contentLength > getScormUploadMaxBytes()
    ) {
      await this.prisma.scormPackage.update({
        where: { id: scormPackage.id },
        data: { status: ScormStatus.FAILED },
      });
      throw new BadRequestException(
        `Package exceeds maximum size of ${Math.round(
          getScormUploadMaxBytes() / 1024 / 1024,
        )} MB`,
      );
    }

    if (
      headResult.contentType &&
      !ALLOWED_SCORM_MIME_TYPES.includes(headResult.contentType)
    ) {
      await this.prisma.scormPackage.update({
        where: { id: scormPackage.id },
        data: { status: ScormStatus.FAILED },
      });
      throw new BadRequestException('SCORM upload must be a zip package');
    }

    const zipBuffer = await this.storage.getObjectBuffer({
      objectKey: scormPackage.objectKey,
      bucket: getScormBucket(),
    });

    let metadata: ManifestMetadata;
    try {
      metadata = this.extractManifest(zipBuffer);
    } catch (error) {
      await this.prisma.scormPackage.update({
        where: { id: scormPackage.id },
        data: { status: ScormStatus.FAILED },
      });
      throw error;
    }

    const updated = await this.prisma.scormPackage.update({
      where: { id: scormPackage.id },
      data: {
        status: ScormStatus.READY,
        sizeBytes: headResult.contentLength ?? null,
        lessonId: input.lessonId ?? null,
        manifestPath: metadata.manifestPath,
        launchPath: metadata.launchPath,
        manifestIdentifier: metadata.manifestIdentifier,
        scormVersion: metadata.scormVersion,
        title: metadata.title ?? scormPackage.title,
      },
    });

    return updated;
  }

  async getPackage(input: {
    packageId: string;
    tenantId: string;
  }): Promise<ScormPackage> {
    if (!input.tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const scormPackage = await this.prisma.scormPackage.findFirst({
      where: {
        id: input.packageId,
        tenantId: input.tenantId,
        status: { not: ScormStatus.DELETED },
      },
    });

    if (!scormPackage) {
      throw new NotFoundException('SCORM package not found');
    }

    return scormPackage;
  }

  async getLaunchInfo(input: {
    packageId: string;
    tenantId: string;
    userId: string;
  }): Promise<{
    packageId: string;
    launchPath: string;
    title: string;
    scormVersion: string | null;
  }> {
    const scormPackage = await this.getPackageWithAccess(input);

    if (!scormPackage.launchPath) {
      throw new BadRequestException('SCORM package has no launch path');
    }

    return {
      packageId: scormPackage.id,
      launchPath: scormPackage.launchPath,
      title: scormPackage.title,
      scormVersion: scormPackage.scormVersion,
    };
  }

  async getFile(input: {
    packageId: string;
    tenantId: string;
    userId: string;
    path: string;
  }): Promise<{ data: Buffer; contentType: string }> {
    const scormPackage = await this.getPackageWithAccess(input);

    const sanitizedPath = input.path.replace(/^\/+/, '');
    if (sanitizedPath.includes('..')) {
      throw new BadRequestException('Invalid package path');
    }

    const zipBuffer = await this.storage.getObjectBuffer({
      objectKey: scormPackage.objectKey,
      bucket: getScormBucket(),
    });

    const zip = new AdmZip(zipBuffer);
    const entry = zip.getEntry(sanitizedPath);

    if (!entry) {
      throw new NotFoundException('File not found in package');
    }

    const rawData = entry.getData() as Buffer | Uint8Array | string;
    const data = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData);
    const contentType =
      lookupMimeTypeSafe(sanitizedPath) || 'application/octet-stream';

    return {
      data,
      contentType,
    };
  }

  private extractManifest(buffer: Buffer): ManifestMetadata {
    const zip = new AdmZip(buffer);
    const entry = zip
      .getEntries()
      .find((item) => item.entryName.toLowerCase().endsWith('imsmanifest.xml'));

    if (!entry) {
      throw new BadRequestException('SCORM package missing imsmanifest.xml');
    }

    const manifestXml = entry.getData().toString('utf8');
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    const parsed = parser.parse(manifestXml) as Record<string, unknown>;
    const manifestNode = getRecord(parsed.manifest);

    const manifestIdentifier = asString(manifestNode?.['@_identifier']) ?? null;
    const scormVersion = asString(manifestNode?.['@_version']) ?? null;

    const organizationsNode = getRecord(manifestNode?.organizations);
    const organizations = toArray(organizationsNode?.organization)
      .map(getRecord)
      .filter(Boolean) as Record<string, unknown>[];
    const defaultOrgId = asString(organizationsNode?.['@_default']);
    const organization =
      organizations.find((org) => org['@_identifier'] === defaultOrgId) ??
      organizations[0];
    const title = asString(organization?.title) ?? null;

    const resourcesNode = getRecord(manifestNode?.resources);
    const resources = toArray(resourcesNode?.resource)
      .map(getRecord)
      .filter(Boolean) as Record<string, unknown>[];
    const resourceWithHref = resources.find(
      (resource) => typeof resource['@_href'] === 'string',
    );
    const launchPath = asString(resourceWithHref?.['@_href']);

    if (!launchPath) {
      throw new BadRequestException('SCORM manifest missing launch resource');
    }

    if (launchPath.startsWith('/') || launchPath.includes('..')) {
      throw new BadRequestException('SCORM launch path is invalid');
    }

    if (!zip.getEntry(launchPath)) {
      throw new BadRequestException(
        'SCORM launch file does not exist in package',
      );
    }

    return {
      manifestPath: entry.entryName,
      manifestIdentifier,
      scormVersion,
      title,
      launchPath,
    };
  }

  private async getPackageWithAccess(input: {
    packageId: string;
    tenantId: string;
    userId: string;
  }): Promise<ScormPackage> {
    if (!input.tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const scormPackage = await this.prisma.scormPackage.findFirst({
      where: {
        id: input.packageId,
        tenantId: input.tenantId,
        status: ScormStatus.READY,
      },
    });

    if (!scormPackage) {
      throw new NotFoundException('SCORM package not found or not ready');
    }

    const user = await this.getActiveUser({
      tenantId: input.tenantId,
      authUserId: input.userId,
    });
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId: user.id,
        courseId: scormPackage.courseId,
      },
    });

    if (!enrollment && scormPackage.uploadedBy !== user.id) {
      throw new ForbiddenException(
        'You must be enrolled in this course to launch SCORM content',
      );
    }

    return scormPackage;
  }

  // ─── SCORM Runtime Data ─────────────────────

  async getRuntimeData(input: {
    packageId: string;
    tenantId: string;
    userId: string;
  }) {
    const scormPackage = await this.getPackageWithAccess(input);

    const user = await this.getActiveUser({
      tenantId: input.tenantId,
      authUserId: input.userId,
    });

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId: user.id,
        courseId: scormPackage.courseId,
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('You must be enrolled in this course');
    }

    // Upsert — create if not exists
    const runtimeData = await this.prisma.scormRuntimeData.upsert({
      where: {
        packageId_enrollmentId: {
          packageId: input.packageId,
          enrollmentId: enrollment.id,
        },
      },
      create: {
        packageId: input.packageId,
        enrollmentId: enrollment.id,
        tenantId: input.tenantId,
        cmiData: {},
        status: 'not attempted',
      },
      update: {},
    });

    return runtimeData;
  }

  async saveRuntimeData(input: {
    packageId: string;
    tenantId: string;
    userId: string;
    data: {
      cmiData?: Record<string, unknown>;
      suspendData?: string;
      location?: string;
      score?: number;
      status?: string;
      totalTime?: string;
    };
  }) {
    const scormPackage = await this.getPackageWithAccess(input);

    const user = await this.getActiveUser({
      tenantId: input.tenantId,
      authUserId: input.userId,
    });

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId: user.id,
        courseId: scormPackage.courseId,
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('You must be enrolled in this course');
    }

    const updateData: Record<string, unknown> = {};
    if (input.data.cmiData !== undefined) updateData.cmiData = input.data.cmiData;
    if (input.data.suspendData !== undefined) updateData.suspendData = input.data.suspendData;
    if (input.data.location !== undefined) updateData.location = input.data.location;
    if (input.data.score !== undefined) updateData.score = input.data.score;
    if (input.data.status !== undefined) updateData.status = input.data.status;
    if (input.data.totalTime !== undefined) updateData.totalTime = input.data.totalTime;

    const runtimeData = await this.prisma.scormRuntimeData.upsert({
      where: {
        packageId_enrollmentId: {
          packageId: input.packageId,
          enrollmentId: enrollment.id,
        },
      },
      create: {
        packageId: input.packageId,
        enrollmentId: enrollment.id,
        tenantId: input.tenantId,
        cmiData: (input.data.cmiData ?? {}) as Prisma.InputJsonObject,
        suspendData: input.data.suspendData,
        location: input.data.location,
        score: input.data.score,
        status: input.data.status ?? 'not attempted',
        totalTime: input.data.totalTime,
      },
      update: updateData,
    });

    // If SCORM reports completion, update lesson progress
    const completedStatuses = ['completed', 'passed'];
    if (input.data.status && completedStatuses.includes(input.data.status) && scormPackage.lessonId) {
      try {
        await this.prisma.progress.upsert({
          where: {
            enrollmentId_lessonId: {
              enrollmentId: enrollment.id,
              lessonId: scormPackage.lessonId,
            },
          },
          create: {
            enrollmentId: enrollment.id,
            lessonId: scormPackage.lessonId,
            state: 'completed',
            progress: 1,
            startedAt: new Date(),
            completedAt: new Date(),
            lastViewedAt: new Date(),
          },
          update: {
            state: 'completed',
            progress: 1,
            completedAt: new Date(),
            lastViewedAt: new Date(),
          },
        });
      } catch {
        // Non-critical — don't fail the runtime save
      }
    }

    return runtimeData;
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
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function lookupMimeTypeSafe(path: string): string | undefined {
  const result = (
    lookupMimeType as (value: string) => string | false | undefined
  )(path);
  return typeof result === 'string' ? result : undefined;
}
