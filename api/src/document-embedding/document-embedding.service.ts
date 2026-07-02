import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmClient } from '../common/ai/llm-client';

const CHUNK_MAX_CHARS = 2000;
const CHUNK_OVERLAP_CHARS = 200;

/**
 * Cap on chunks embedded per document. Prevents a runaway 500-page PDF
 * from consuming the entire embedding budget for one upload.
 */
const MAX_CHUNKS_PER_DOCUMENT = 200;

export interface ChunkResult {
  index: number;
  text: string;
  tokenCount: number;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  title: string;
  description: string | null;
  fileName: string;
  chunkText: string;
  chunkIndex: number;
  score: number;
}

@Injectable()
export class DocumentEmbeddingService {
  private readonly logger = new Logger(DocumentEmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmClient,
  ) {}

  /**
   * Split text into overlapping chunks for embedding.
   */
  chunkText(text: string, maxChars = CHUNK_MAX_CHARS, overlap = CHUNK_OVERLAP_CHARS): ChunkResult[] {
    if (!text || text.length === 0) return [];

    const chunks: ChunkResult[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + maxChars, text.length);
      const chunkText = text.slice(start, end);
      const tokenCount = this.llm.estimateTokens(chunkText);

      chunks.push({
        index: chunks.length,
        text: chunkText,
        tokenCount,
      });

      if (end >= text.length) break;
      start = end - overlap;
    }

    return chunks;
  }

  /**
   * Generate embeddings for a list of documents and store them.
   * Skips documents that already have chunks.
   */
  async indexDocuments(
    tenantId: string,
    docs: Array<{
      id: string;
      title: string;
      description?: string | null;
      /**
       * Optional extracted body text (from PDF / text / office parsing).
       * When supplied it is embedded alongside title + description so
       * retrieval can match on real document content, not just metadata.
       */
      bodyText?: string | null;
    }>,
  ): Promise<number> {
    let indexed = 0;

    for (const doc of docs) {
      const existingCount = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count FROM "DocumentChunk" WHERE "documentId" = ${doc.id}
      `;

      if (existingCount[0]?.count > 0) continue;

      // Header carries title + description so metadata is always searchable,
      // even when body extraction fails. Body is concatenated after so it
      // gets its own chunks that can match on real content.
      const header = [doc.title, doc.description].filter(Boolean).join('\n\n');
      const body = (doc.bodyText ?? '').trim();
      const text = [header, body].filter(Boolean).join('\n\n');
      if (!text) continue;

      const chunks = this.chunkText(text).slice(0, MAX_CHUNKS_PER_DOCUMENT);

      for (const chunk of chunks) {
        const { embedding, usedFallback } = await this.llm.embed(chunk.text);

        if (usedFallback || embedding.length === 0) {
          this.logger.warn(`Failed to embed chunk ${chunk.index} for document ${doc.id}`);
          continue;
        }

        const vectorStr = `[${embedding.join(',')}]`;

        try {
          await this.prisma.$executeRaw`
            INSERT INTO "DocumentChunk" ("id", "documentId", "tenantId", "chunkIndex", "chunkText", "tokenCount", "embedding")
            VALUES (gen_random_uuid(), ${doc.id}, ${tenantId}, ${chunk.index}, ${chunk.text}, ${chunk.tokenCount}, ${vectorStr}::vector)
          `;
          indexed++;
        } catch (err) {
          this.logger.warn(`Failed to store embedding for document ${doc.id}: ${(err as Error).message}`);
        }
      }
    }

    return indexed;
  }

  /**
   * Find top-k document chunks similar to the query text.
   * Falls back to keyword search if vector search fails.
   */
  async searchSimilar(
    tenantId: string,
    query: string,
    topK = 5,
    categoryId?: string,
  ): Promise<SearchResult[]> {
    const { embedding, usedFallback } = await this.llm.embed(query);

    if (usedFallback || embedding.length === 0) {
      this.logger.warn('Embedding failed, falling back to keyword search');
      return this.keywordSearch(tenantId, query, topK, categoryId);
    }

    const vectorStr = `[${embedding.join(',')}]`;

    try {
      const rows = await (categoryId
        ? this.prisma.$queryRaw<Array<Record<string, unknown>>>`
            SELECT
              c."id" as "chunkId",
              c."documentId",
              d."title",
              d."description",
              d."fileName",
              c."chunkText",
              c."chunkIndex",
              1 - (c."embedding" <=> ${vectorStr}::vector) as "score"
            FROM "DocumentChunk" c
            JOIN "Document" d ON d."id" = c."documentId"
            WHERE c."tenantId" = ${tenantId}
              AND d."status" = 'published'
              AND d."categoryId" = ${categoryId}
            ORDER BY c."embedding" <=> ${vectorStr}::vector
            LIMIT ${topK}
          `
        : this.prisma.$queryRaw<Array<Record<string, unknown>>>`
            SELECT
              c."id" as "chunkId",
              c."documentId",
              d."title",
              d."description",
              d."fileName",
              c."chunkText",
              c."chunkIndex",
              1 - (c."embedding" <=> ${vectorStr}::vector) as "score"
            FROM "DocumentChunk" c
            JOIN "Document" d ON d."id" = c."documentId"
            WHERE c."tenantId" = ${tenantId}
              AND d."status" = 'published'
            ORDER BY c."embedding" <=> ${vectorStr}::vector
            LIMIT ${topK}
          `
      );

      if (rows.length > 0) return rows as unknown as SearchResult[];
    } catch (err) {
      this.logger.warn(`Vector search failed: ${(err as Error).message}, falling back to keyword search`);
    }

    return this.keywordSearch(tenantId, query, topK, categoryId);
  }

  private async keywordSearch(
    tenantId: string,
    query: string,
    topK: number,
    categoryId?: string,
  ): Promise<SearchResult[]> {
    const words = query.split(/\s+/).filter((w) => w.length > 2).slice(0, 5).join(' & ');
    if (!words) return [];

    const where: Record<string, unknown> = { tenantId, status: 'published' };
    if (categoryId) where.categoryId = categoryId;

    const docs = await this.prisma.document.findMany({
      where: {
        ...where,
        OR: [
          { title: { contains: words.replace(/ & /g, ' '), mode: 'insensitive' } },
          { description: { contains: words.replace(/ & /g, ' '), mode: 'insensitive' } },
        ],
      },
      take: topK,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        fileName: true,
      },
    });

    return docs.map((d) => ({
      chunkId: '',
      documentId: d.id,
      title: d.title,
      description: d.description,
      fileName: d.fileName,
      chunkText: `${d.title}${d.description ? '\n\n' + d.description : ''}`,
      chunkIndex: 0,
      score: 0,
    }));
  }
}
