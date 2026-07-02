import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBus } from '../events/event-bus';
import { CourseWorkflowService } from './course-workflow.service';

describe('CourseWorkflowService', () => {
  type PrismaMock = {
    course: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  type EventBusMock = {
    emit: jest.Mock;
  };

  const prisma: PrismaMock = {
    course: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const eventBus: EventBusMock = { emit: jest.fn() };

  let service: CourseWorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CourseWorkflowService(
      prisma as unknown as PrismaService,
      eventBus as unknown as EventBus,
    );
  });

  // ─── tenant guard ─────────────────────────────

  it('rejects when tenant is missing', async () => {
    await expect(
      service.submitForReview(null, 'course-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // ─── not found ────────────────────────────────

  it('rejects when course is not found in tenant', async () => {
    prisma.course.findFirst.mockResolvedValue(null);

    await expect(
      service.submitForReview('tenant-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // ─── valid transitions ────────────────────────

  it('transitions draft → review', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'c1',
      status: 'draft',
    });
    prisma.course.update.mockResolvedValue({
      id: 'c1',
      status: 'review',
    });

    const result = await service.submitForReview('tenant-1', 'c1');

    expect(result.status).toBe('review');
    expect(prisma.course.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'review' },
      }),
    );
    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'course.submitted_for_review',
      }),
    );
  });

  it('transitions review → published', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'c1',
      status: 'review',
    });
    prisma.course.update.mockResolvedValue({
      id: 'c1',
      status: 'published',
    });

    const result = await service.publish('tenant-1', 'c1');

    expect(result.status).toBe('published');
    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'course.published',
      }),
    );
  });

  it('transitions published → archived', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'c1',
      status: 'published',
    });
    prisma.course.update.mockResolvedValue({
      id: 'c1',
      status: 'archived',
    });

    const result = await service.archive('tenant-1', 'c1');

    expect(result.status).toBe('archived');
    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'course.archived',
      }),
    );
  });

  it('transitions archived → draft (unpublish)', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'c1',
      status: 'archived',
    });
    prisma.course.update.mockResolvedValue({
      id: 'c1',
      status: 'draft',
    });

    const result = await service.unpublish('tenant-1', 'c1');

    expect(result.status).toBe('draft');
    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'course.unpublished',
      }),
    );
  });

  it('transitions review → draft (reject/unpublish)', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'c1',
      status: 'review',
    });
    prisma.course.update.mockResolvedValue({
      id: 'c1',
      status: 'draft',
    });

    const result = await service.unpublish('tenant-1', 'c1');

    expect(result.status).toBe('draft');
  });

  // ─── invalid transitions ─────────────────────

  it('rejects draft → published (must go via review)', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'c1',
      status: 'draft',
    });

    await expect(service.publish('tenant-1', 'c1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects published → draft directly (must archive first)', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'c1',
      status: 'published',
    });

    await expect(service.unpublish('tenant-1', 'c1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects draft → archived (must publish first)', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'c1',
      status: 'draft',
    });

    await expect(service.archive('tenant-1', 'c1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
