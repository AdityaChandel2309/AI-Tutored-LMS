import { BadRequestException, NotFoundException } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { ScormService } from './scorm.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ScormStatus } from '@prisma/client';

describe('ScormService', () => {
  type PrismaMock = {
    course: { findFirst: jest.Mock };
    lesson: { findFirst: jest.Mock };
    scormPackage: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    enrollment: { findFirst: jest.Mock };
  };

  type StorageMock = {
    getPresignedPutUrl: jest.Mock;
    headObject: jest.Mock;
    getObjectBuffer: jest.Mock;
  };

  const prisma: PrismaMock = {
    course: { findFirst: jest.fn() },
    lesson: { findFirst: jest.fn() },
    scormPackage: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    enrollment: { findFirst: jest.fn() },
  };

  const storage: StorageMock = {
    getPresignedPutUrl: jest.fn(),
    headObject: jest.fn(),
    getObjectBuffer: jest.fn(),
  };

  let service: ScormService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ScormService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
    );
  });

  it('fails confirmation when manifest is missing', async () => {
    prisma.scormPackage.findFirst.mockResolvedValue({
      id: 'pkg-1',
      tenantId: 'tenant-1',
      courseId: 'course-1',
      status: ScormStatus.PENDING,
      objectKey: 'scorm/tenant-1/course-1/pkg-1/package.zip',
      title: 'Package',
    });
    storage.headObject.mockResolvedValue({
      exists: true,
      contentLength: 100,
      contentType: 'application/zip',
    });
    const zip = new AdmZip();
    zip.addFile('index.html', Buffer.from('<html></html>'));
    storage.getObjectBuffer.mockResolvedValue(zip.toBuffer());

    await expect(
      service.confirmUpload({
        packageId: 'pkg-1',
        tenantId: 'tenant-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('parses manifest and stores launch metadata', async () => {
    prisma.scormPackage.findFirst.mockResolvedValue({
      id: 'pkg-2',
      tenantId: 'tenant-1',
      courseId: 'course-1',
      status: ScormStatus.PENDING,
      objectKey: 'scorm/tenant-1/course-1/pkg-2/package.zip',
      title: 'Package',
    });
    storage.headObject.mockResolvedValue({
      exists: true,
      contentLength: 120,
      contentType: 'application/zip',
    });

    const zip = new AdmZip();
    zip.addFile(
      'imsmanifest.xml',
      Buffer.from(
        `<?xml version="1.0"?>
        <manifest identifier="pkg-2" version="1.2">
          <organizations default="org-1">
            <organization identifier="org-1">
              <title>Sample Package</title>
            </organization>
          </organizations>
          <resources>
            <resource identifier="res-1" href="index.html" />
          </resources>
        </manifest>`,
      ),
    );
    zip.addFile('index.html', Buffer.from('<html></html>'));
    storage.getObjectBuffer.mockResolvedValue(zip.toBuffer());

    prisma.scormPackage.update.mockResolvedValue({
      id: 'pkg-2',
      launchPath: 'index.html',
      manifestPath: 'imsmanifest.xml',
      title: 'Sample Package',
    });

    const result = await service.confirmUpload({
      packageId: 'pkg-2',
      tenantId: 'tenant-1',
    });

    const updateCalls = prisma.scormPackage.update.mock.calls as Array<
      [{ data: Record<string, unknown> }]
    >;
    const updateArgs = updateCalls[0]?.[0];

    expect(updateArgs.data).toEqual(
      expect.objectContaining({
        launchPath: 'index.html',
        manifestPath: 'imsmanifest.xml',
        scormVersion: '1.2',
        manifestIdentifier: 'pkg-2',
        title: 'Sample Package',
        status: ScormStatus.READY,
      }),
    );
    expect(result.launchPath).toBe('index.html');
  });

  it('rejects missing package on confirm', async () => {
    prisma.scormPackage.findFirst.mockResolvedValue(null);

    await expect(
      service.confirmUpload({
        packageId: 'missing',
        tenantId: 'tenant-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
