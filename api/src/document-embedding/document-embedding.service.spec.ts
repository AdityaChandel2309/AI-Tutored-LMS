import { DocumentEmbeddingService, SearchResult } from './document-embedding.service';
import { LlmClient } from '../common/ai/llm-client';

describe('DocumentEmbeddingService', () => {
  let prisma: Record<string, any>;
  let llm: Record<string, any>;
  let service: DocumentEmbeddingService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      document: {
        findMany: jest.fn(),
      },
    };
    llm = {
      embed: jest.fn(),
      estimateTokens: jest.fn().mockImplementation((text: string) => Math.ceil(text.length / 4)),
    };
    service = new DocumentEmbeddingService(prisma as any, llm as unknown as LlmClient);
  });

  // ─── chunkText ──────────────────────────────
  describe('chunkText', () => {
    it('returns empty array for empty string', () => {
      expect(service.chunkText('')).toEqual([]);
      expect(service.chunkText('', 100, 10)).toEqual([]);
    });

    it('returns single chunk for short text', () => {
      const result = service.chunkText('Hello world');
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Hello world');
      expect(result[0].index).toBe(0);
    });

    it('splits text into multiple chunks when exceeding maxChars', () => {
      const text = 'A'.repeat(500);
      const result = service.chunkText(text, 200, 20);
      expect(result.length).toBeGreaterThan(1);
      expect(result[0].text.length).toBe(200);
      expect(result[1].text.length).toBe(200);
    });

    it('produces overlapping chunks', () => {
      const text = 'A'.repeat(300);
      const result = service.chunkText(text, 200, 50);
      // chunk 0: chars 0-200
      // chunk 1: chars 150-300
      expect(result).toHaveLength(2);
      expect(result[1].text).toBe(text.slice(150, 300));
    });

    it('calculates tokenCount using llm.estimateTokens', () => {
      const text = 'Hello world';
      llm.estimateTokens.mockReturnValue(3);
      const result = service.chunkText(text);
      expect(result[0].tokenCount).toBe(3);
      expect(llm.estimateTokens).toHaveBeenCalledWith('Hello world');
    });
  });

  // ─── indexDocuments ─────────────────────────
  describe('indexDocuments', () => {
    const docs = [
      { id: 'doc-1', title: 'Safety Guide', description: 'Workplace safety procedures' },
      { id: 'doc-2', title: 'HR Policy', description: 'Employee handbook' },
    ];

    it('skips documents that already have chunks', async () => {
      prisma.$queryRaw.mockResolvedValue([{ count: 5 }]);

      const indexed = await service.indexDocuments('t1', docs);

      expect(indexed).toBe(0);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('skips documents with no text content', async () => {
      prisma.$queryRaw.mockResolvedValue([{ count: 0 }]);
      const emptyDocs = [{ id: 'doc-1', title: '', description: null }];

      const indexed = await service.indexDocuments('t1', emptyDocs);

      expect(indexed).toBe(0);
    });

    it('generates and stores embeddings for new chunks', async () => {
      prisma.$queryRaw.mockResolvedValue([{ count: 0 }]);
      llm.embed.mockResolvedValue({ embedding: [0.1, 0.2, 0.3], usedFallback: false });
      prisma.$executeRaw.mockResolvedValue(undefined);

      const indexed = await service.indexDocuments('t1', [
        { id: 'doc-1', title: 'Safety Guide', description: 'Procedures' },
      ]);

      expect(indexed).toBe(1);
      expect(llm.embed).toHaveBeenCalled();
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('continues when embedding fails for a chunk', async () => {
      prisma.$queryRaw.mockResolvedValue([{ count: 0 }]);
      llm.embed
        .mockResolvedValueOnce({ embedding: [], usedFallback: true })
        .mockResolvedValueOnce({ embedding: [0.1, 0.2], usedFallback: false });

      prisma.$executeRaw.mockResolvedValue(undefined);

      const indexed = await service.indexDocuments('t1', [
        { id: 'doc-1', title: 'Long Title ' + 'A'.repeat(3000), description: null },
      ]);

      // At least one chunk should have succeeded
      expect(indexed).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── searchSimilar ──────────────────────────
  describe('searchSimilar', () => {
    const mockResults: SearchResult[] = [
      {
        chunkId: 'ch-1', documentId: 'doc-1', title: 'Safety Guide',
        description: 'Procedures', fileName: 'safety.pdf',
        chunkText: 'Safety procedures content', chunkIndex: 0, score: 0.95,
      },
    ];

    it('falls back to keyword search when embedding fails', async () => {
      llm.embed.mockResolvedValue({ embedding: [], usedFallback: true });

      prisma.document.findMany.mockResolvedValue([
        { id: 'doc-1', title: 'Safety Guide', description: 'Procedures', fileName: 'safety.pdf' },
      ]);

      const result = await service.searchSimilar('t1', 'safety procedures');

      expect(result).toHaveLength(1);
      expect(result[0].documentId).toBe('doc-1');
    });

    it('performs vector search with category filter', async () => {
      llm.embed.mockResolvedValue({ embedding: [0.1, 0.2, 0.3], usedFallback: false });
      prisma.$queryRaw.mockResolvedValue(mockResults);

      const result = await service.searchSimilar('t1', 'safety', 5, 'cat-1');

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(0.95);
    });

    it('performs vector search without category filter', async () => {
      llm.embed.mockResolvedValue({ embedding: [0.1, 0.2, 0.3], usedFallback: false });
      prisma.$queryRaw.mockResolvedValue(mockResults);

      const result = await service.searchSimilar('t1', 'safety');

      expect(result).toHaveLength(1);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('falls back to keyword search when vector query fails', async () => {
      llm.embed.mockResolvedValue({ embedding: [0.1, 0.2, 0.3], usedFallback: false });
      prisma.$queryRaw.mockRejectedValue(new Error('vector not available'));
      prisma.document.findMany.mockResolvedValue([
        { id: 'doc-1', title: 'Safety', description: 'Guide', fileName: 'safety.pdf' },
      ]);

      const result = await service.searchSimilar('t1', 'safety');

      expect(result).toHaveLength(1);
      expect(result[0].documentId).toBe('doc-1');
    });
  });

  // ─── keywordSearch ──────────────────────────
  describe('keywordSearch (via searchSimilar fallback)', () => {
    it('returns empty when query has no significant words', async () => {
      llm.embed.mockResolvedValue({ embedding: [], usedFallback: true });

      prisma.document.findMany.mockResolvedValue([]);

      const result = await service.searchSimilar('t1', 'a an');

      expect(result).toHaveLength(0);
    });

    it('filters by categoryId in keyword fallback', async () => {
      llm.embed.mockResolvedValue({ embedding: [], usedFallback: true });
      prisma.document.findMany.mockResolvedValue([
        { id: 'doc-1', title: 'HR Policy', description: null, fileName: 'hr.pdf' },
      ]);

      const result = await service.searchSimilar('t1', 'policy', 5, 'cat-1');

      expect(result).toHaveLength(1);
      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 'cat-1' }),
        }),
      );
    });
  });
});
