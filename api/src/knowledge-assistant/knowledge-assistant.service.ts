import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmClient } from '../common/ai/llm-client';
import { DocumentEmbeddingService } from '../document-embedding/document-embedding.service';
import { PlatformContextService } from './platform-context.service';
import { sanitizeUserMessage } from '../common/ai/prompt-safety';
import { buildKnowledgeAssistantSystemPrompt, KNOWLEDGE_FALLBACK } from '../common/ai/prompt-templates';
import { KnowledgeService } from '../knowledge/knowledge.service';

const SPARSE_CHUNK_CHAR_THRESHOLD = 350;
const MAX_CONTEXT_DOCS = 3;
const MAX_CHUNKS_PER_CONTEXT_DOC = 6;
const MAX_CONTEXT_CHARS_PER_DOC = 9000;
const FALLBACK_EXCERPT_CHARS = 4500;
const DIRECT_DOC_SUMMARY_CHARS = 6000;

@Injectable()
export class KnowledgeAssistantService {
  private readonly logger = new Logger(KnowledgeAssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmClient,
    private readonly embeddingService: DocumentEmbeddingService,
    private readonly platformContext: PlatformContextService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  async ask(
    tenantId: string | null,
    authUserId: string,
    question: string,
    categoryId?: string,
    roles: string[] = [],
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const user = await this.prisma.user.findFirst({ where: { keycloakId: authUserId, tenantId } });
    if (!user) throw new ForbiddenException('User not found');

    const userMessage = sanitizeUserMessage(question);

    const history = await this.prisma.knowledgeAssistantMessage.findMany({
      where: { tenantId, userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    const chronologicalHistory = history.reverse();
    const recentUserQuestions = chronologicalHistory
      .filter((m) => m.role === 'user')
      .slice(-2)
      .map((m) => m.content);
    const retrievalQuery = [...recentUserQuestions, userMessage].join('\n');

    // Role-scoped semantic search. Admins see any non-archived document
    // (drafts + in-review + published). Everyone else is limited to
    // published documents so unfinished internal content doesn't leak.
    const isAdmin = roles.includes('admin') || roles.includes('super_admin');
    let results = await this.embeddingService.searchSimilar(
      tenantId,
      retrievalQuery,
      5,
      categoryId,
      isAdmin,
    );

    // Self-heal old metadata-only chunks: if retrieval found the document by
    // title/description but not body content, force a fresh extraction and
    // repeat search before building the prompt.
    if (this.hasSparseDocumentContent(results)) {
      for (const documentId of Array.from(new Set(results.map((r) => r.documentId))).slice(0, MAX_CONTEXT_DOCS)) {
        try {
          await this.knowledgeService.reindexDocument(tenantId, documentId);
        } catch (err) {
          this.logger.warn(`On-demand document reindex failed for ${documentId}: ${(err as Error).message}`);
        }
      }

      results = await this.embeddingService.searchSimilar(
        tenantId,
        retrievalQuery,
        5,
        categoryId,
        isAdmin,
      );
    }

    const relevantDocs = results.map((r) => ({
      id: r.documentId,
      title: r.title,
      description: r.description,
      type: '',
      fileName: r.fileName,
    }));

    const docContext = relevantDocs.length > 0
      ? await this.buildExpandedDocumentContext(tenantId, results, isAdmin)
      : 'No documents in the tenant knowledge base matched this query. Tell the user no matching document was found rather than speculating.';

    const directDocumentAnswer = this.shouldAnswerDirectlyFromDocument(userMessage)
      ? this.buildDirectDocumentAnswer(docContext, relevantDocs)
      : null;

    if (directDocumentAnswer) {
      const sourceDocIds = Array.from(new Set(results.map((r) => r.documentId)));

      await this.prisma.knowledgeAssistantMessage.create({
        data: { tenantId, userId: user.id, role: 'user', content: userMessage, sourceDocIds: [] },
      });

      await this.prisma.knowledgeAssistantMessage.create({
        data: { tenantId, userId: user.id, role: 'assistant', content: directDocumentAnswer, sourceDocIds },
      });

      return { role: 'assistant', content: directDocumentAnswer, sources: relevantDocs };
    }

    // Live platform data — ADMIN ONLY. Non-admins never receive this context,
    // so the assistant cannot answer org-wide operational questions for them.
    const platformContext = isAdmin
      ? await this.platformContext.buildAdminContext(tenantId)
      : '';

    // Non-admins get a strictly self-scoped context (their profile, learning,
    // and projects) so the assistant can answer personal questions like
    // "which courses am I enrolled in?" without leaking other users' data.
    const userContext = isAdmin
      ? ''
      : await this.platformContext.buildUserContext(tenantId, user.id);

    const messages = [
      {
        role: 'system' as const,
        content: buildKnowledgeAssistantSystemPrompt({
          documentContext: docContext,
          platformContext,
          userContext,
        }),
      },
      ...chronologicalHistory.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    // Store user message
    await this.prisma.knowledgeAssistantMessage.create({
      data: { tenantId, userId: user.id, role: 'user', content: userMessage, sourceDocIds: [] },
    });

    const contextualFallback = this.buildContextualFallbackAnswer(docContext, relevantDocs);

    // Call LLM with token trimming and fallback. If the model provider is down
    // or misconfigured, still answer from the retrieved document excerpts so
    // users can read what is inside the knowledge-base file.
    const result = await this.llm.chat({ messages }, contextualFallback);

    if (result.usedFallback) {
      this.logger.warn('Knowledge assistant used fallback response');
    }

    const sourceDocIds = Array.from(new Set(results.map((r) => r.documentId)));

    // Store assistant response
    await this.prisma.knowledgeAssistantMessage.create({
      data: { tenantId, userId: user.id, role: 'assistant', content: result.content, sourceDocIds },
    });

    return { role: 'assistant', content: result.content, sources: relevantDocs };
  }

  private hasSparseDocumentContent(
    results: Array<{ title: string; description: string | null; chunkText: string }>,
  ): boolean {
    return results.some((r) => {
      const chunk = r.chunkText.trim();
      const metadataOnly = [r.title, r.description].filter(Boolean).join('\n\n').trim();
      return (
        chunk.length < SPARSE_CHUNK_CHAR_THRESHOLD ||
        (metadataOnly.length > 0 && chunk === metadataOnly)
      );
    });
  }

  private async buildExpandedDocumentContext(
    tenantId: string,
    results: Array<{ documentId: string; title: string; description: string | null; fileName: string; chunkText: string }>,
    isAdmin: boolean,
  ): Promise<string> {
    const documentIds = Array.from(new Set(results.map((r) => r.documentId))).slice(0, MAX_CONTEXT_DOCS);
    if (documentIds.length === 0) return '';

    const documents = await this.prisma.document.findMany({
      where: {
        tenantId,
        id: { in: documentIds },
        ...(isAdmin ? { status: { not: 'archived' } } : { status: 'published' }),
      },
      select: {
        id: true,
        title: true,
        description: true,
        fileName: true,
        chunks: {
          orderBy: { chunkIndex: 'asc' },
          take: MAX_CHUNKS_PER_CONTEXT_DOC,
          select: { chunkText: true },
        },
      },
    });

    const byId = new Map(documents.map((doc) => [doc.id, doc]));

    return documentIds
      .map((id) => {
        const doc = byId.get(id);
        const fallback = results.find((r) => r.documentId === id);
        if (!doc && !fallback) return '';

        const title = doc?.title ?? fallback?.title ?? 'Untitled document';
        const fileName = doc?.fileName ?? fallback?.fileName ?? 'unknown file';
        const description = doc?.description ?? fallback?.description ?? null;
        const chunkText = (doc?.chunks.length
          ? doc.chunks.map((c) => c.chunkText).join('\n\n')
          : fallback?.chunkText ?? '').trim();
        const excerpt = chunkText.slice(0, MAX_CONTEXT_CHARS_PER_DOC);

        return [
          `### Document: ${title}`,
          `File: ${fileName}`,
          description ? `Description: ${description}` : '',
          'Extracted content:',
          excerpt || 'No extractable body text is available for this document.',
        ].filter(Boolean).join('\n');
      })
      .filter(Boolean)
      .join('\n\n');
  }

  private buildContextualFallbackAnswer(
    documentContext: string,
    docs: Array<{ title: string; fileName: string; description: string | null }>,
  ): string {
    const normalizedContext = documentContext.trim();
    if (!docs.length || !normalizedContext || normalizedContext.startsWith('No documents in the tenant')) {
      return KNOWLEDGE_FALLBACK;
    }

    if (normalizedContext.includes('No extractable body text is available for this document.')) {
      const docList = docs.map((doc) => `- ${doc.title} (${doc.fileName})`).join('\n');
      return [
        'I found the matching document, but its body text has not been extracted yet, so I cannot accurately summarize what is inside it.',
        '',
        'Matching document:',
        docList,
        '',
        'Please reindex or re-upload the document so its contents can be read by the assistant.',
      ].join('\n');
    }

    const excerpt = normalizedContext.slice(0, FALLBACK_EXCERPT_CHARS).trim();
    const sourceList = docs.map((doc) => `- ${doc.title} (${doc.fileName})`).join('\n');

    return [
      'I found the matching knowledge-base document. The AI answer generator is unavailable right now, so here is the retrieved content from the document instead:',
      '',
      excerpt,
      normalizedContext.length > FALLBACK_EXCERPT_CHARS ? '\n[Excerpt truncated]' : '',
      '',
      'Sources:',
      sourceList,
    ].filter(Boolean).join('\n');
  }

  private shouldAnswerDirectlyFromDocument(question: string): boolean {
    const normalized = question.toLowerCase();
    return (
      /\b(what|tell|summari[sz]e|summary|inside|contain|contains|content|about)\b/.test(normalized) &&
      /\b(doc|docs|document|documents|pdf|file|knowledge\s*base)\b/.test(normalized)
    );
  }

  private buildDirectDocumentAnswer(
    documentContext: string,
    docs: Array<{ title: string; fileName: string; description: string | null }>,
  ): string | null {
    const normalizedContext = documentContext.trim();
    if (!docs.length || !normalizedContext || normalizedContext.startsWith('No documents in the tenant')) {
      return null;
    }

    if (normalizedContext.includes('No extractable body text is available for this document.')) {
      const docList = docs.map((doc) => `- ${doc.title} (${doc.fileName})`).join('\n');
      return [
        'I found the matching document, but its body text has not been extracted yet, so I cannot accurately tell what is inside it.',
        '',
        'Matching document:',
        docList,
        '',
        'Please reindex or re-upload the document so the assistant can read its contents.',
      ].join('\n');
    }

    const excerpt = normalizedContext.slice(0, DIRECT_DOC_SUMMARY_CHARS).trim();
    const sourceList = docs.map((doc) => `- ${doc.title} (${doc.fileName})`).join('\n');

    return [
      'Here is what I found inside the matching knowledge-base document:',
      '',
      excerpt,
      normalizedContext.length > DIRECT_DOC_SUMMARY_CHARS ? '\n[Excerpt truncated]' : '',
      '',
      'Sources:',
      sourceList,
    ].filter(Boolean).join('\n');
  }

  async getHistory(tenantId: string | null, authUserId: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const user = await this.prisma.user.findFirst({ where: { keycloakId: authUserId, tenantId } });
    if (!user) throw new ForbiddenException('User not found');

    return this.prisma.knowledgeAssistantMessage.findMany({
      where: { tenantId, userId: user.id },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  }
}
