import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBus } from '../events/event-bus';
import { ProgressService } from './progress.service';

describe('ProgressService', () => {
  type PrismaMock = {
    $transaction: jest.Mock;
    user: { findFirst: jest.Mock };
    enrollment: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    lesson: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    progress: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };

  const prisma: PrismaMock = {
    $transaction: jest.fn((cb: (tx: PrismaMock) => unknown) => cb(prisma)),
    user: { findFirst: jest.fn() },
    enrollment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    lesson: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    progress: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const eventBus = { emit: jest.fn() };

  let service: ProgressService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProgressService(
      prisma as unknown as PrismaService,
      eventBus as unknown as EventBus,
    );
  });

  // ─── upsertProgress ────────────────────────────

  it('rejects when tenant is missing', async () => {
    await expect(
      service.upsertProgress({
        tenantId: null,
        authUserId: 'kc-1',
        courseId: 'course-1',
        body: {
          lessonId: 'lesson-1',
          state: 'in_progress',
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an invalid state value', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
    });
    prisma.enrollment.findUnique.mockResolvedValue({
      id: 'enr-1',
    });
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
    });

    await expect(
      service.upsertProgress({
        tenantId: 'tenant-1',
        authUserId: 'kc-1',
        courseId: 'course-1',
        body: {
          lessonId: 'lesson-1',
          state: 'invalid_state',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when user is not enrolled', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
    });
    prisma.enrollment.findUnique.mockResolvedValue(null);

    await expect(
      service.upsertProgress({
        tenantId: 'tenant-1',
        authUserId: 'kc-1',
        courseId: 'course-1',
        body: {
          lessonId: 'lesson-1',
          state: 'in_progress',
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when lesson does not belong to the course', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
    });
    prisma.enrollment.findUnique.mockResolvedValue({
      id: 'enr-1',
    });
    prisma.lesson.findFirst.mockResolvedValue(null);

    await expect(
      service.upsertProgress({
        tenantId: 'tenant-1',
        authUserId: 'kc-1',
        courseId: 'course-1',
        body: {
          lessonId: 'lesson-wrong',
          state: 'in_progress',
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a new progress record when none exists', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
    });
    prisma.enrollment.findUnique
      .mockResolvedValueOnce({ id: 'enr-1', courseId: 'course-1' })
      .mockResolvedValueOnce({ id: 'enr-1', courseId: 'course-1' });
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
    });
    prisma.progress.findUnique.mockResolvedValue(null);
    prisma.progress.upsert.mockResolvedValue({
      id: 'prog-1',
      enrollmentId: 'enr-1',
      lessonId: 'lesson-1',
      state: 'in_progress',
      progress: 0,
      lesson: { id: 'lesson-1', title: 'L1', type: 'video' },
    });
    prisma.lesson.count.mockResolvedValue(5);
    prisma.progress.count.mockResolvedValue(0);
    prisma.enrollment.update.mockResolvedValue({});

    const result = await service.upsertProgress({
      tenantId: 'tenant-1',
      authUserId: 'kc-1',
      courseId: 'course-1',
      body: {
        lessonId: 'lesson-1',
        state: 'in_progress',
      },
    });

    expect(prisma.progress.upsert).toHaveBeenCalled();
    expect(result.state).toBe('in_progress');
  });

  it('updates an existing progress record', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
    });
    prisma.enrollment.findUnique
      .mockResolvedValueOnce({ id: 'enr-1', courseId: 'course-1' })
      .mockResolvedValueOnce({ id: 'enr-1', courseId: 'course-1' });
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
    });
    prisma.progress.findUnique.mockResolvedValue({
      id: 'prog-1',
      enrollmentId: 'enr-1',
      lessonId: 'lesson-1',
      state: 'in_progress',
      progress: 0.5,
      startedAt: new Date(),
      completedAt: null,
    });
    prisma.progress.upsert.mockResolvedValue({
      id: 'prog-1',
      state: 'completed',
      progress: 1,
      lesson: { id: 'lesson-1', title: 'L1', type: 'video' },
    });
    prisma.lesson.count.mockResolvedValue(5);
    prisma.progress.count.mockResolvedValue(1);
    prisma.enrollment.update.mockResolvedValue({});

    const result = await service.upsertProgress({
      tenantId: 'tenant-1',
      authUserId: 'kc-1',
      courseId: 'course-1',
      body: {
        lessonId: 'lesson-1',
        state: 'completed',
        progress: 1,
      },
    });

    expect(prisma.progress.upsert).toHaveBeenCalled();
    expect(result.state).toBe('completed');
  });

  it('emits lesson.completed when lesson transitions to completed', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    prisma.enrollment.findUnique
      .mockResolvedValueOnce({ id: 'enr-1', courseId: 'course-1' })
      .mockResolvedValueOnce({ id: 'enr-1', courseId: 'course-1' });
    prisma.lesson.findFirst.mockResolvedValue({ id: 'lesson-1' });
    prisma.progress.findUnique.mockResolvedValue(null);
    prisma.progress.upsert.mockResolvedValue({
      id: 'prog-1',
      enrollmentId: 'enr-1',
      lessonId: 'lesson-1',
      state: 'completed',
      progress: 1,
      lesson: { id: 'lesson-1', title: 'L1', type: 'video' },
    });
    prisma.lesson.count.mockResolvedValue(2);
    prisma.progress.count.mockResolvedValue(1);
    prisma.enrollment.update.mockResolvedValue({});

    await service.upsertProgress({
      tenantId: 'tenant-1',
      authUserId: 'kc-1',
      courseId: 'course-1',
      body: { lessonId: 'lesson-1', state: 'completed', progress: 1 },
    });

    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'lesson.completed' }),
    );
  });

  it('does NOT emit lesson.completed when already completed before', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    prisma.enrollment.findUnique
      .mockResolvedValueOnce({ id: 'enr-1', courseId: 'course-1' })
      .mockResolvedValueOnce({ id: 'enr-1', courseId: 'course-1' });
    prisma.lesson.findFirst.mockResolvedValue({ id: 'lesson-1' });
    // Pre-state says already completed
    prisma.progress.findUnique.mockResolvedValue({ state: 'completed', startedAt: new Date() });
    prisma.progress.upsert.mockResolvedValue({
      id: 'prog-1',
      enrollmentId: 'enr-1',
      lessonId: 'lesson-1',
      state: 'completed',
      progress: 1,
      lesson: { id: 'lesson-1', title: 'L1', type: 'video' },
    });
    prisma.lesson.count.mockResolvedValue(2);
    prisma.progress.count.mockResolvedValue(1);
    prisma.enrollment.update.mockResolvedValue({});

    await service.upsertProgress({
      tenantId: 'tenant-1',
      authUserId: 'kc-1',
      courseId: 'course-1',
      body: { lessonId: 'lesson-1', state: 'completed', progress: 1 },
    });

    expect(eventBus.emit).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'lesson.completed' }),
    );
  });

  // ─── completeLesson (xAPI-style) ───────────────

  it('completeLesson rejects a non-"completed" status', async () => {
    await expect(
      service.completeLesson({
        tenantId: 'tenant-1',
        authUserId: 'kc-1',
        courseId: 'course-1',
        lessonId: 'lesson-1',
        status: 'attempted',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('completeLesson upserts the lesson as completed with progress 1', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    prisma.enrollment.findUnique
      .mockResolvedValueOnce({ id: 'enr-1', courseId: 'course-1' })
      .mockResolvedValueOnce({ id: 'enr-1', courseId: 'course-1' });
    prisma.lesson.findFirst.mockResolvedValue({ id: 'lesson-1' });
    prisma.progress.findUnique.mockResolvedValue(null);
    prisma.progress.upsert.mockResolvedValue({
      id: 'prog-1',
      enrollmentId: 'enr-1',
      lessonId: 'lesson-1',
      state: 'completed',
      progress: 1,
      lesson: { id: 'lesson-1', title: 'L1', type: 'text' },
    });
    prisma.lesson.count.mockResolvedValue(3);
    prisma.progress.count.mockResolvedValue(1);
    prisma.enrollment.update.mockResolvedValue({});

    const result = await service.completeLesson({
      tenantId: 'tenant-1',
      authUserId: 'kc-1',
      courseId: 'course-1',
      lessonId: 'lesson-1',
      // status omitted → defaults to "completed"
    });

    expect(prisma.progress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          lessonId: 'lesson-1',
          state: 'completed',
          progress: 1,
        }),
        update: expect.objectContaining({
          state: 'completed',
          progress: 1,
        }),
      }),
    );
    expect(result.state).toBe('completed');
  });

  it('completeLesson is enrollment-guarded (rejects when not enrolled)', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    prisma.enrollment.findUnique.mockResolvedValue(null);

    await expect(
      service.completeLesson({
        tenantId: 'tenant-1',
        authUserId: 'kc-1',
        courseId: 'course-1',
        lessonId: 'lesson-1',
        status: 'completed',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recomputeEnrollmentProgress runs inside $transaction (M4)', async () => {
    // patchProgress calls recomputeEnrollmentProgress; verify $transaction wrapper
    prisma.progress.findFirst.mockResolvedValue({
      id: 'prog-1',
      enrollmentId: 'enr-1',
      state: 'in_progress',
      progress: 0.5,
      startedAt: new Date(),
      completedAt: null,
      enrollment: {
        courseId: 'course-1',
        course: { tenantId: 'tenant-1' },
      },
    });
    prisma.progress.update.mockResolvedValue({
      id: 'prog-1',
      state: 'completed',
      progress: 1,
      lesson: { id: 'lesson-1', title: 'L1', type: 'video' },
    });
    prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1', courseId: 'course-1' });
    prisma.lesson.count.mockResolvedValue(3);
    prisma.progress.count.mockResolvedValue(3);
    prisma.enrollment.update.mockResolvedValue({});

    await service.patchProgress({
      tenantId: 'tenant-1',
      progressId: 'prog-1',
      body: { state: 'completed', progress: 1 },
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          progress: expect.any(Number),
        }),
      }),
    );
  });

  // ─── getProgress ───────────────────────────────

  it('returns lesson-level breakdown with summary', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
    });
    prisma.enrollment.findUnique.mockResolvedValue({
      id: 'enr-1',
      courseId: 'course-1',
    });
    prisma.lesson.findMany.mockResolvedValue([
      {
        id: 'lesson-1',
        title: 'L1',
        type: 'video',
        duration: 300,
        module: { id: 'mod-1', title: 'M1', order: 1 },
      },
      {
        id: 'lesson-2',
        title: 'L2',
        type: 'text',
        duration: null,
        module: { id: 'mod-1', title: 'M1', order: 1 },
      },
    ]);
    prisma.progress.findMany.mockResolvedValue([
      {
        lessonId: 'lesson-1',
        state: 'completed',
        progress: 1,
        startedAt: new Date(),
        completedAt: new Date(),
        lastViewedAt: new Date(),
      },
    ]);

    const result = await service.getProgress({
      tenantId: 'tenant-1',
      authUserId: 'kc-1',
      courseId: 'course-1',
    });

    expect(result.summary.totalLessons).toBe(2);
    expect(result.summary.completedLessons).toBe(1);
    expect(result.summary.progressPercent).toBe(50);
    expect(result.lessons).toHaveLength(2);
    expect(result.lessons[0].state).toBe('completed');
    expect(result.lessons[1].state).toBe('not_started');
  });

  // ─── patchProgress ────────────────────────────

  it('rejects patch for cross-tenant progress', async () => {
    prisma.progress.findFirst.mockResolvedValue({
      id: 'prog-1',
      enrollmentId: 'enr-1',
      enrollment: {
        course: { tenantId: 'tenant-2' },
      },
    });

    await expect(
      service.patchProgress({
        tenantId: 'tenant-1',
        progressId: 'prog-1',
        body: { state: 'completed' },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('patches a progress record and recomputes enrollment', async () => {
    prisma.progress.findFirst.mockResolvedValue({
      id: 'prog-1',
      enrollmentId: 'enr-1',
      state: 'in_progress',
      progress: 0.5,
      startedAt: new Date(),
      completedAt: null,
      enrollment: {
        courseId: 'course-1',
        course: { tenantId: 'tenant-1' },
      },
    });
    prisma.progress.update.mockResolvedValue({
      id: 'prog-1',
      state: 'completed',
      progress: 1,
    });
    prisma.enrollment.findUnique.mockResolvedValue({
      id: 'enr-1',
      courseId: 'course-1',
    });
    prisma.lesson.count.mockResolvedValue(3);
    prisma.progress.count.mockResolvedValue(2);
    prisma.enrollment.update.mockResolvedValue({});

    const result = await service.patchProgress({
      tenantId: 'tenant-1',
      progressId: 'prog-1',
      body: { state: 'completed', progress: 1 },
    });

    expect(prisma.progress.update).toHaveBeenCalled();
    expect(prisma.enrollment.update).toHaveBeenCalled();
    expect(result.state).toBe('completed');
  });
});
