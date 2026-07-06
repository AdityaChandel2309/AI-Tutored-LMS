import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmClient } from '../common/ai/llm-client';
import { DocumentEmbeddingService } from '../document-embedding/document-embedding.service';
import { PlatformContextService } from './platform-context.service';
import { sanitizeUserMessage } from '../common/ai/prompt-safety';
import { buildKnowledgeAssistantSystemPrompt, KNOWLEDGE_FALLBACK } from '../common/ai/prompt-templates';

@Injectable()
export class KnowledgeAssistantService {
  private readonly logger = new Logger(KnowledgeAssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmClient,
    private readonly embeddingService: DocumentEmbeddingService,
    private readonly platformContext: PlatformContextService,
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

    // Semantic search for relevant documents via vector embeddings
    const results = await this.embeddingService.searchSimilar(tenantId, question, 5, categoryId);

    const relevantDocs = results.map((r) => ({
      id: r.documentId,
      title: r.title,
      description: r.description,
      type: '',
      fileName: r.fileName,
    }));

    const docContext = relevantDocs.length > 0
      ? results.map((r) => `- "${r.title}": ${r.chunkText}`).join('\n')
      : 'No documents in the tenant knowledge base matched this query. Tell the user no matching document was found rather than speculating.';

    // Live platform data — ADMIN ONLY. Non-admins never receive this context,
    // so the assistant cannot answer org-wide operational questions for them.
    const isAdmin = roles.includes('admin') || roles.includes('super_admin');
    const platformContext = isAdmin
      ? await this.platformContext.buildAdminContext(tenantId)
      : '';

    // Non-admins get a strictly self-scoped context (their profile, learning,
    // and projects) so the assistant can answer personal questions like
    // "which courses am I enrolled in?" without leaking other users' data.
    const userContext = isAdmin
      ? ''
      : await this.platformContext.buildUserContext(tenantId, user.id);

    const history = await this.prisma.knowledgeAssistantMessage.findMany({
      where: { tenantId, userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const userMessage = sanitizeUserMessage(question);

    const messages = [
      {
        role: 'system' as const,
        content: buildKnowledgeAssistantSystemPrompt({
          documentContext: docContext,
          platformContext,
          userContext,
        }),
      },
      ...history.reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    // Store user message
    await this.prisma.knowledgeAssistantMessage.create({
      data: { tenantId, userId: user.id, role: 'user', content: userMessage, sourceDocIds: [] },
    });

    // Call LLM with token trimming and fallback
    const result = await this.llm.chat({ messages }, KNOWLEDGE_FALLBACK);

    if (result.usedFallback) {
      this.logger.warn('Knowledge assistant used fallback response');
    }

    const sourceDocIds = results.map((r) => r.documentId);

    // Store assistant response
    await this.prisma.knowledgeAssistantMessage.create({
      data: { tenantId, userId: user.id, role: 'assistant', content: result.content, sourceDocIds },
    });

    return { role: 'assistant', content: result.content, sources: relevantDocs };
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
