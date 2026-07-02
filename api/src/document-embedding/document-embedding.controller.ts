import { Controller, Get, Post, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocumentEmbeddingService } from './document-embedding.service';
import { PrismaService } from '../prisma/prisma.service';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';

@ApiTags('document-embeddings')
@ApiBearerAuth()
@Controller('document-embeddings')
export class DocumentEmbeddingController {
  constructor(
    private readonly embeddingService: DocumentEmbeddingService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('index-all')
  @ApiOperation({ summary: 'Index all published documents for the tenant' })
  async indexAll(@Request() req: TenantAwareRequest) {
    const tenantId = req.tenant?.id;
    if (!tenantId) return { ok: false, error: 'Tenant not resolved' };

    const docs = await this.prisma.document.findMany({
      where: { tenantId, status: 'published' },
      select: { id: true, title: true, description: true },
    });

    const indexed = await this.embeddingService.indexDocuments(tenantId, docs);

    return { ok: true, total: docs.length, indexed };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get embedding stats for tenant' })
  async stats(@Request() req: TenantAwareRequest) {
    const tenantId = req.tenant?.id;
    if (!tenantId) return { ok: false, error: 'Tenant not resolved' };

    const result = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint as count FROM "DocumentChunk" WHERE "tenantId" = ${tenantId}
    `;

    return { ok: true, chunkCount: Number(result[0]?.count ?? 0) };
  }
}
