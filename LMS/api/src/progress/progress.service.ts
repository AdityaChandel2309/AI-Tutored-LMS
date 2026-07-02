import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBus } from '../events/event-bus';
import { UpdateProgressDto } from './dto/update-progress.dto';

const VALID_STATES = ['not_started', 'in_progress', 'completed', 'locked'];

type ProgressRecord = Prisma.ProgressGetPayload<{
  include: {
    lesson: {
      select: {
        id: true;
        title: true;
        type: true;
      };
    };
  };
}>;

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Upsert lesson-level progress for the current user's
   * enrollment in a tenant-scoped course, then recompute
   * the enrollment-level aggregate.
   */
  async upsertProgress(input: {
    tenantId: string | null;
    authUserId: string;
    courseId: string;
    body: UpdateProgressDto;
  }): Promise<ProgressRecord> {
    const { tenantId, authUserId, courseId, body } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    if (!VALID_STATES.includes(body.state)) {
      throw new BadRequestException(
        `Invalid state "${body.state}". Must be one of: ${VALID_STATES.join(', ')}`,
      );
    }

    const enrollment = await this.resolveEnrollment(
      tenantId,
      authUserId,
      courseId,
    );

    await this.assertLessonBelongsToCourse(courseId, body.lessonId);

    const now = new Date();
    const isStarting = body.state === 'in_progress';
    const isCompleting = body.state === 'completed';

    // Use upsert to avoid race condition between read and create/update
    const preState = await this.prisma.progress.findUnique({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: enrollment.id,
          lessonId: body.lessonId,
        },
      },
      select: { state: true, startedAt: true },
    });
    const wasAlreadyCompleted = preState?.state === 'completed';

    const record = await this.prisma.progress.upsert({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: enrollment.id,
          lessonId: body.lessonId,
        },
      },
      update: {
        state: body.state,
        progress: body.progress ?? undefined,
        lastViewedAt: now,
        startedAt: isStarting && !preState?.startedAt ? now : undefined,
        completedAt: isCompleting
          ? now
          : body.state === 'not_started'
            ? null
            : undefined,
      },
      create: {
        enrollmentId: enrollment.id,
        lessonId: body.lessonId,
        state: body.state,
        progress: body.progress ?? 0,
        lastViewedAt: now,
        startedAt: isStarting ? now : null,
        completedAt: isCompleting ? now : null,
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
      },
    });

    // Emit lesson.completed if this is a new completion
    if (isCompleting && !wasAlreadyCompleted) {
      this.eventBus.emit({
        type: 'lesson.completed',
        tenantId,
        timestamp: now,
        actorId: enrollment.userId,
        entityId: body.lessonId,
        entityType: 'lesson',
        payload: {
          progressId: record.id,
          enrollmentId: enrollment.id,
          lessonId: body.lessonId,
          userId: enrollment.userId,
        },
      });
    }

    await this.recomputeEnrollmentProgress(enrollment.id, courseId, tenantId);

    return record;
  }

  /**
   * Mark a lesson complete from an xAPI-style statement emitted by the
   * frontend auto-trackers (video 90%, text scroll-to-end, quiz pass).
   *
   * This is a thin, intention-revealing wrapper over `upsertProgress`: it
   * forces `state: 'completed'` and `progress: 1`, ignoring any client-sent
   * `userId` (the authenticated session is authoritative). The upsert keeps
   * the write idempotent, so repeated/duplicate auto-fire events are safe.
   */
  async completeLesson(input: {
    tenantId: string | null;
    authUserId: string;
    courseId: string;
    lessonId: string;
    status?: string;
  }): Promise<ProgressRecord> {
    const { tenantId, authUserId, courseId, lessonId, status } = input;

    // Only "completed" is actionable today; reject anything else explicitly so
    // callers don't silently assume other xAPI verbs are handled.
    const normalizedStatus = (status ?? 'completed').toLowerCase();
    if (normalizedStatus !== 'completed') {
      throw new BadRequestException(
        `Unsupported status "${status}". Only "completed" is accepted.`,
      );
    }

    return this.upsertProgress({
      tenantId,
      authUserId,
      courseId,
      body: {
        lessonId,
        state: 'completed',
        progress: 1,
      },
    });
  }

  /**
   * Return the full per-lesson progress breakdown plus
   * an aggregate summary for the current user's enrollment.
   */
  async getProgress(input: {
    tenantId: string | null;
    authUserId: string;
    courseId: string;
  }) {
    const { tenantId, authUserId, courseId } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const enrollment = await this.resolveEnrollment(
      tenantId,
      authUserId,
      courseId,
    );

    const lessons = await this.prisma.lesson.findMany({
      where: {
        module: {
          courseId,
        },
      },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
      select: {
        id: true,
        title: true,
        type: true,
        duration: true,
        module: {
          select: {
            id: true,
            title: true,
            order: true,
          },
        },
      },
    });

    const progressRecords = await this.prisma.progress.findMany({
      where: { enrollmentId: enrollment.id },
    });

    const progressMap = new Map(progressRecords.map((p) => [p.lessonId, p]));

    const totalLessons = lessons.length;
    const completedLessons = progressRecords.filter(
      (p) => p.state === 'completed',
    ).length;

    const lessonDetails = lessons.map((lesson) => {
      const prog = progressMap.get(lesson.id);
      return {
        // Flattened identifiers the course player consumes directly.
        lessonId: lesson.id,
        lesson,
        state: prog?.state ?? 'not_started',
        progress: prog?.progress ?? 0,
        startedAt: prog?.startedAt ?? null,
        completedAt: prog?.completedAt ?? null,
        lastViewedAt: prog?.lastViewedAt ?? null,
      };
    });

    const fraction =
      totalLessons > 0 ? completedLessons / totalLessons : 0;

    return {
      enrollmentId: enrollment.id,
      courseId,
      summary: {
        // Frontend-facing aggregate (player reads total/completed/progress).
        total: totalLessons,
        completed: completedLessons,
        progress: fraction,
        // Backward-compatible fields kept for existing consumers/tests.
        totalLessons,
        completedLessons,
        progressPercent: Math.round(fraction * 100),
      },
      lessons: lessonDetails,
    };
  }

  /**
   * Update a single progress record by ID.
   * Validates tenant ownership through enrollment → course.
   */
  async patchProgress(input: {
    tenantId: string | null;
    progressId: string;
    body: Partial<Pick<UpdateProgressDto, 'state' | 'progress'>>;
  }) {
    const { tenantId, progressId, body } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    if (body.state && !VALID_STATES.includes(body.state)) {
      throw new BadRequestException(
        `Invalid state "${body.state}". Must be one of: ${VALID_STATES.join(', ')}`,
      );
    }

    const existing = await this.prisma.progress.findFirst({
      where: { id: progressId },
      include: {
        enrollment: {
          include: {
            course: {
              select: { tenantId: true },
            },
          },
        },
      },
    });

    if (!existing || existing.enrollment.course.tenantId !== tenantId) {
      throw new NotFoundException(
        'Progress record not found in current tenant',
      );
    }

    const now = new Date();
    const isStarting = body.state === 'in_progress';
    const isCompleting = body.state === 'completed';

    const record = await this.prisma.progress.update({
      where: { id: progressId },
      data: {
        state: body.state ?? existing.state,
        progress: body.progress ?? existing.progress,
        lastViewedAt: now,
        startedAt: isStarting && !existing.startedAt ? now : existing.startedAt,
        completedAt: isCompleting
          ? now
          : body.state === 'not_started' || body.state === 'in_progress'
            ? null
            : existing.completedAt,
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
      },
    });

    await this.recomputeEnrollmentProgress(
      existing.enrollmentId,
      existing.enrollment.courseId,
      tenantId,
    );

    return record;
  }

  // ─── private helpers ────────────────────────────

  private async resolveEnrollment(
    tenantId: string,
    authUserId: string,
    courseId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        keycloakId: authUserId,
        tenantId,
        isActive: true,
      },
    });

    if (!user) {
      throw new ForbiddenException(
        'User does not belong to the resolved tenant',
      );
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('User is not enrolled in this course');
    }

    return enrollment;
  }

  private async assertLessonBelongsToCourse(
    courseId: string,
    lessonId: string,
  ) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        module: { courseId },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found in the specified course');
    }
  }

  private async recomputeEnrollmentProgress(
    enrollmentId: string,
    courseId: string,
    tenantId: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findUnique({
        where: { id: enrollmentId },
      });

      if (!enrollment) return;

      const wasAlreadyCompleted = enrollment.completedAt !== null;

      const totalLessons = await tx.lesson.count({
        where: {
          module: { courseId },
        },
      });

      const completedLessons = await tx.progress.count({
        where: {
          enrollmentId,
          state: 'completed',
        },
      });

      // Store the enrollment-level aggregate as a 0–1 fraction so it matches
      // the lesson-level `Progress.progress` convention and the frontend,
      // which renders `enrollment.progress * 100`.
      const progressFraction =
        totalLessons > 0 ? completedLessons / totalLessons : 0;

      const allDone = totalLessons > 0 && completedLessons === totalLessons;

      await tx.enrollment.update({
        where: { id: enrollmentId },
        data: {
          progress: progressFraction,
          completedAt: allDone ? new Date() : null,
        },
      });

      // Emit course.completed if this is a new completion
      if (allDone && !wasAlreadyCompleted) {
        this.eventBus.emit({
          type: 'course.completed',
          tenantId,
          timestamp: new Date(),
          actorId: enrollment.userId,
          entityId: courseId,
          entityType: 'course',
          payload: {
            enrollmentId,
            userId: enrollment.userId,
            courseId,
          },
        });
      }
    });
  }
}
