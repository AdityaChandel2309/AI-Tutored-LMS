import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Injectable()
export class LessonService {
  constructor(private readonly prisma: PrismaService) {}

  async createLesson(input: {
    tenantId: string | null;
    moduleId: string;
    body: CreateLessonDto;
  }) {
    const { tenantId, moduleId, body } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const mod = await this.prisma.courseModule.findFirst({
      where: { id: moduleId },
      include: {
        course: { select: { tenantId: true } },
      },
    });

    if (!mod || mod.course.tenantId !== tenantId) {
      throw new NotFoundException('Module not found in current tenant');
    }

    // Auto-assign the next order when not provided so lesson sequence is
    // deterministic and the (moduleId, order) unique constraint holds.
    let order = body.order;
    if (order === undefined || order === null) {
      const lastLesson = await this.prisma.lesson.findFirst({
        where: { moduleId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      order = (lastLesson?.order ?? 0) + 1;
    } else {
      const existingOrder = await this.prisma.lesson.findFirst({
        where: { moduleId, order },
      });
      if (existingOrder) {
        throw new ConflictException(
          `Lesson order ${order} already exists in this module`,
        );
      }
    }

    return this.prisma.lesson.create({
      data: {
        moduleId,
        title: body.title.trim(),
        type: body.type.trim(),
        content: body.content ?? undefined,
        duration: body.duration ?? null,
        order,
      },
    });
  }

  private resolveJsonContent(
    value: Record<string, any> | null | undefined,
  ): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    if (value === null) return Prisma.JsonNull;
    return value;
  }

  async updateLesson(input: {
    tenantId: string | null;
    lessonId: string;
    body: UpdateLessonDto;
  }) {
    const { tenantId, lessonId, body } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: { select: { tenantId: true } },
          },
        },
      },
    });

    if (!lesson || lesson.module.course.tenantId !== tenantId) {
      throw new NotFoundException('Lesson not found in current tenant');
    }

    if (body.order !== undefined && body.order !== null && body.order !== lesson.order) {
      const existingOrder = await this.prisma.lesson.findFirst({
        where: {
          moduleId: lesson.moduleId,
          order: body.order,
          NOT: { id: lessonId },
        },
      });
      if (existingOrder) {
        throw new ConflictException(
          `Lesson order ${body.order} already exists in this module`,
        );
      }
    }

    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title: body.title?.trim(),
        type: body.type?.trim(),
        content: this.resolveJsonContent(body.content),
        duration: body.duration === undefined ? undefined : body.duration,
        order: body.order === undefined || body.order === null ? undefined : body.order,
      },
    });
  }

  async deleteLesson(tenantId: string | null, lessonId: string) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: { select: { tenantId: true } },
          },
        },
      },
    });

    if (!lesson || lesson.module.course.tenantId !== tenantId) {
      throw new NotFoundException('Lesson not found in current tenant');
    }

    await this.prisma.lesson.delete({
      where: { id: lessonId },
    });

    return {
      id: lessonId,
      deleted: true,
    };
  }

  async reorderLessons(input: {
    tenantId: string | null;
    moduleId: string;
    orderedIds: string[];
  }) {
    const { tenantId, moduleId, orderedIds } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const mod = await this.prisma.courseModule.findFirst({
      where: { id: moduleId },
      include: { course: { select: { tenantId: true } } },
    });

    if (!mod || mod.course.tenantId !== tenantId) {
      throw new NotFoundException('Module not found in current tenant');
    }

    // Two-phase reorder to avoid @@unique([moduleId, order]) violations:
    // Phase 1 — move all lessons to negative temporary orders
    // Phase 2 — assign final 1-based orders
    await this.prisma.$transaction([
      ...orderedIds.map((id, index) =>
        this.prisma.lesson.updateMany({
          where: { id, moduleId },
          data: { order: -(index + 1) },
        }),
      ),
      ...orderedIds.map((id, index) =>
        this.prisma.lesson.updateMany({
          where: { id, moduleId },
          data: { order: index + 1 },
        }),
      ),
    ]);

    return this.prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
    });
  }
}
