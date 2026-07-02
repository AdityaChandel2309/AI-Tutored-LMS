import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EventBus } from '../events/event-bus';
import { DocumentEmbeddingService } from '../document-embedding/document-embedding.service';
import { extractDocumentText } from '../document-embedding/text-extractor';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  CreateDocCategoryDto,
  UploadVersionDto,
} from './dto/knowledge.dto';

const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly eventBus: EventBus,
    private readonly embeddingService: DocumentEmbeddingService,
  ) {}

  // ─── Documents ─────────────────────────────

  async getDocuments(
    tenantId: string | null,
    filters: {
      categoryId?: string;
      type?: string;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { tags: { has: filters.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.document.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getDocument(tenantId: string | null, id: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId },
      include: {
        category: { select: { id: true, name: true } },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            uploadedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async createDocument(
    tenantId: string | null,
    dto: CreateDocumentDto,
    file: Express.Multer.File,
    actorId: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    if (!ALLOWED_MIMES.includes(file.mimetype))
      throw new ForbiddenException(`Unsupported file type: ${file.mimetype}`);

    const user = await this.prisma.user.findFirst({
      where: { keycloakId: actorId, tenantId },
    });
    if (!user) throw new ForbiddenException('User not found');

    const objectKey = `knowledge/${tenantId}/${Date.now()}-${file.originalname}`;
    await this.storage.uploadBuffer({
      bucket: 'knowledge',
      objectKey,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const doc = await this.prisma.document.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description,
        type: dto.type ?? 'policy',
        categoryId: dto.categoryId,
        fileObjectKey: objectKey,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById: user.id,
        status: dto.status ?? 'draft',
        tags: dto.tags ?? [],
      },
    });

    // Create initial version
    await this.prisma.documentVersion.create({
      data: {
        documentId: doc.id,
        versionNumber: 1,
        fileObjectKey: objectKey,
        fileName: file.originalname,
        fileSize: file.size,
        uploadedById: user.id,
        changeNote: 'Initial upload',
      },
    });

    this.eventBus.emit({
      type: 'document.uploaded',
      tenantId,
      timestamp: new Date(),
      actorId: user.id,
      entityId: doc.id,
      entityType: 'document',
      payload: { documentId: doc.id, title: doc.title },
    });

    // Index document for semantic search (non-blocking)
    // Extract body text (PDF / text formats) so retrieval can match on
    // real content, not just title + description. Metadata-only fallback
    // when extraction is unsupported (Office docs) or fails.
    void this.indexWithExtractedText(tenantId, {
      id: doc.id,
      title: doc.title,
      description: doc.description ?? null,
      fileObjectKey: objectKey,
      mimeType: file.mimetype,
    });

    return doc;
  }

  async updateDocument(
    tenantId: string | null,
    id: string,
    dto: UpdateDocumentDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    return this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async uploadVersion(
    tenantId: string | null,
    id: string,
    file: Express.Multer.File,
    dto: UploadVersionDto,
    actorId: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const user = await this.prisma.user.findFirst({
      where: { keycloakId: actorId, tenantId },
    });
    if (!user) throw new ForbiddenException('User not found');

    const objectKey = `knowledge/${tenantId}/${Date.now()}-${file.originalname}`;
    await this.storage.uploadBuffer({
      bucket: 'knowledge',
      objectKey,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const newVersion = doc.version + 1;
    await this.prisma.documentVersion.create({
      data: {
        documentId: id,
        versionNumber: newVersion,
        fileObjectKey: objectKey,
        fileName: file.originalname,
        fileSize: file.size,
        uploadedById: user.id,
        changeNote: dto.changeNote,
      },
    });

    return this.prisma.document.update({
      where: { id },
      data: {
        version: newVersion,
        fileObjectKey: objectKey,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });
  }

  async getDownloadUrl(tenantId: string | null, id: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const url = await this.storage.getPresignedGetUrl({
      bucket: 'knowledge',
      objectKey: doc.fileObjectKey,
      expiresInSeconds: 3600,
    });
    return { url, fileName: doc.fileName };
  }

  async deleteDocument(tenantId: string | null, id: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    return this.prisma.document.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  // ─── Categories ────────────────────────────

  async getCategories(tenantId: string | null) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    return this.prisma.documentCategory.findMany({
      where: { tenantId },
      include: { _count: { select: { documents: true, children: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(tenantId: string | null, dto: CreateDocCategoryDto) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    return this.prisma.documentCategory.create({
      data: {
        tenantId,
        name: dto.name,
        slug: dto.slug,
        parentId: dto.parentId,
        description: dto.description,
      },
    });
  }

  async updateCategory(
    tenantId: string | null,
    id: string,
    dto: Partial<CreateDocCategoryDto>,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const cat = await this.prisma.documentCategory.findFirst({
      where: { id, tenantId },
    });
    if (!cat) throw new NotFoundException('Category not found');
    if (dto.parentId === id)
      throw new BadRequestException('A category cannot be its own parent');
    return this.prisma.documentCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async deleteCategory(tenantId: string | null, id: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');
    const cat = await this.prisma.documentCategory.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { documents: true } } },
    });
    if (!cat) throw new NotFoundException('Category not found');
    if (cat._count.documents > 0)
      throw new ForbiddenException('Cannot delete category with documents');
    return this.prisma.documentCategory.delete({ where: { id } });
  }
}
