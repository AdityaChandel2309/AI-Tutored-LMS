import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmClient } from '../common/ai/llm-client';
import { sanitizeUserMessage } from '../common/ai/prompt-safety';
import { buildTutorSystemPrompt, TUTOR_FALLBACK } from '../common/ai/prompt-templates';
import { ChatMessageDto } from './dto/chat-message.dto';

@Injectable()
export class AiTutorService {
  private readonly logger = new Logger(AiTutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmClient,
  ) {}

  async chat(tenantId: string | null, authUserId: string, dto: ChatMessageDto) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const user = await this.prisma.user.findFirst({ where: { keycloakId: authUserId, tenantId } });
    if (!user) throw new ForbiddenException('User not found');

    const enrollment = await this.prisma.enrollment.findFirst({ where: { userId: user.id, courseId: dto.courseId } });
    if (!enrollment) throw new ForbiddenException('You must be enrolled in this course to use the AI tutor');

    const course = await this.prisma.course.findFirst({
      where: { id: dto.courseId, tenantId },
      select: { title: true, description: true },
    });

    let lessonContext = '';
    if (dto.lessonId) {
      const lesson = await this.prisma.lesson.findFirst({ where: { id: dto.lessonId }, select: { title: true, content: true } });
      if (lesson) lessonContext = `Current lesson: "${lesson.title}". Content: ${JSON.stringify(lesson.content ?? '').slice(0, 2000)}`;
    }

    const history = await this.prisma.aiTutorMessage.findMany({
      where: { tenantId, userId: user.id, courseId: dto.courseId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const userMessage = sanitizeUserMessage(dto.message);

    const messages = [
      {
        role: 'system' as const,
        content: buildTutorSystemPrompt({
          courseTitle: course?.title ?? 'Unknown',
          courseDescription: course?.description ?? undefined,
          lessonContext: lessonContext || undefined,
        }),
      },
      ...history.reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    // Store user message
    await this.prisma.aiTutorMessage.create({
      data: { tenantId, userId: user.id, courseId: dto.courseId, lessonId: dto.lessonId, role: 'user', content: userMessage },
    });

    // Call LLM with token trimming and fallback
    const result = await this.llm.chat({ messages }, TUTOR_FALLBACK);

    if (result.usedFallback) {
      this.logger.warn('AI tutor used fallback response');
    }

    // Store assistant response
    await this.prisma.aiTutorMessage.create({
      data: { tenantId, userId: user.id, courseId: dto.courseId, lessonId: dto.lessonId, role: 'assistant', content: result.content },
    });

    return { role: 'assistant', content: result.content };
  }

  async getHistory(tenantId: string | null, authUserId: string, courseId: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const user = await this.prisma.user.findFirst({ where: { keycloakId: authUserId, tenantId } });
    if (!user) throw new ForbiddenException('User not found');

    return this.prisma.aiTutorMessage.findMany({
      where: { tenantId, userId: user.id, courseId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  }
}
