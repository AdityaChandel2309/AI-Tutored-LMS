import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';

type PrismaMock = {
  document: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  documentCategory: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  documentVersion: {
    create: jest.Mock;
  };
  user: { findFirst: jest.Mock };
};

const prisma: PrismaMock = {
  document: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  documentCategory: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  documentVersion: { create: jest.fn() },
  user: { findFirst: jest.fn() },
};

const storage = {
  getPresignedGetUrl: jest.fn(),
  uploadBuffer: jest.fn(),
};

const eventBus = { emit: jest.fn() };
const embeddingService = { indexDocuments: jest.fn().mockResolvedValue(0) };
let service: KnowledgeService;

beforeEach(() => {
  jest.clearAllMocks();
  service = new KnowledgeService(
    prisma as any,
    storage as any,
    eventBus as any,
    embeddingService as any,
  );
});

describe('KnowledgeService', () => {
  describe('getDownloadUrl', () => {
    it('throws ForbiddenException when tenant is null', async () => {
      await expect(service.getDownloadUrl(null, 'doc-1'))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when document is missing', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      await expect(service.getDownloadUrl('t1', 'doc-1'))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns presigned URL with correct bucket (H2)', async () => {
      prisma.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        fileObjectKey: 'knowledge/t1/doc.pdf',
        fileName: 'doc.pdf',
      });
      storage.getPresignedGetUrl.mockResolvedValue('https://minio/bucket/doc.pdf');

      const result = await service.getDownloadUrl('t1', 'doc-1');

      expect(storage.getPresignedGetUrl).toHaveBeenCalledWith(
        expect.objectContaining({ bucket: 'knowledge', objectKey: 'knowledge/t1/doc.pdf' }),
      );
      expect(result.url).toBe('https://minio/bucket/doc.pdf');
      expect(result.fileName).toBe('doc.pdf');
    });
  });

  describe('updateDocument', () => {
    it('throws ForbiddenException when tenant is null', async () => {
      await expect(service.updateDocument(null, 'doc-1', { title: 'New' }))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when document is missing', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      await expect(service.updateDocument('t1', 'doc-1', { title: 'New' }))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('only updates allowed fields (H4)', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: 'doc-1', tenantId: 't1' });
      prisma.document.update.mockResolvedValue({ id: 'doc-1', title: 'Updated' });

      await service.updateDocument('t1', 'doc-1', {
        title: 'Updated',
        description: 'New desc',
        type: 'policy',
        tags: ['tag1'],
        status: 'published',
      });

      const updateCall = (prisma.document.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data).toEqual({
        title: 'Updated',
        description: 'New desc',
        type: 'policy',
        tags: ['tag1'],
        status: 'published',
      });
    });

    it('silently ignores non-whitelisted fields on the DTO', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: 'doc-1', tenantId: 't1' });
      prisma.document.update.mockResolvedValue({ id: 'doc-1', title: 'Updated' });

      await service.updateDocument('t1', 'doc-1', {
        title: 'Updated',
      } as any);

      const updateCall = (prisma.document.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.title).toBe('Updated');
      expect(updateCall.data).not.toHaveProperty('fileObjectKey');
    });
  });

  describe('updateCategory', () => {
    it('throws BadRequestException when category is its own parent (M8)', async () => {
      prisma.documentCategory.findFirst.mockResolvedValue({ id: 'cat-1', tenantId: 't1' });

      await expect(service.updateCategory('t1', 'cat-1', { parentId: 'cat-1' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
