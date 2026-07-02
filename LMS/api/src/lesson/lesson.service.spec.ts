import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LessonService } from './lesson.service';

describe('LessonService', () => {
  type PrismaMock = {
    courseModule: {
      findFirst: jest.Mock;
    };
    lesson: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const prisma: PrismaMock = {
    courseModule: {
      findFirst: jest.fn(),
    },
    lesson: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: LessonService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LessonService(prisma as unknown as PrismaService);
  });

  it('rejects lesson creation when tenant is missing', async () => {
    await expect(
      service.createLesson({
        tenantId: null,
        moduleId: 'mod-1',
        body: {
          title: 'Lesson 1',
          type: 'video',
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects lesson creation when module does not belong to tenant', async () => {
    prisma.courseModule.findFirst.mockResolvedValue(null);

    await expect(
      service.createLesson({
        tenantId: 'tenant-1',
        moduleId: 'mod-x',
        body: {
          title: 'Lesson 1',
          type: 'video',
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a lesson inside a tenant-scoped module', async () => {
    prisma.courseModule.findFirst.mockResolvedValue({
      id: 'mod-1',
      course: { tenantId: 'tenant-1' },
    });
    // No existing lessons → auto-assigned order should be 1.
    prisma.lesson.findFirst.mockResolvedValue(null);
    prisma.lesson.create.mockResolvedValue({
      id: 'lesson-1',
      title: 'Lesson 1',
      type: 'video',
    });

    const result = await service.createLesson({
      tenantId: 'tenant-1',
      moduleId: 'mod-1',
      body: {
        title: ' Lesson 1 ',
        type: ' video ',
        duration: 300,
      },
    });

    expect(prisma.lesson.create).toHaveBeenCalledWith({
      data: {
        moduleId: 'mod-1',
        title: 'Lesson 1',
        type: 'video',
        content: undefined,
        duration: 300,
        order: 1,
      },
    });
    expect(result.id).toBe('lesson-1');
  });

  it('auto-assigns the next order after the last lesson', async () => {
    prisma.courseModule.findFirst.mockResolvedValue({
      id: 'mod-1',
      course: { tenantId: 'tenant-1' },
    });
    prisma.lesson.findFirst.mockResolvedValue({ order: 4 });
    prisma.lesson.create.mockResolvedValue({ id: 'lesson-5' });

    await service.createLesson({
      tenantId: 'tenant-1',
      moduleId: 'mod-1',
      body: { title: 'Lesson 5', type: 'text' },
    });

    expect(prisma.lesson.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ order: 5 }),
    });
  });

  it('rejects cross-tenant module when creating lesson', async () => {
    prisma.courseModule.findFirst.mockResolvedValue({
      id: 'mod-1',
      course: { tenantId: 'tenant-2' },
    });

    await expect(
      service.createLesson({
        tenantId: 'tenant-1',
        moduleId: 'mod-1',
        body: {
          title: 'Lesson 1',
          type: 'text',
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates a lesson within the tenant', async () => {
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      module: {
        course: { tenantId: 'tenant-1' },
      },
    });
    prisma.lesson.update.mockResolvedValue({
      id: 'lesson-1',
      title: 'Updated Lesson',
      type: 'text',
    });

    const result = await service.updateLesson({
      tenantId: 'tenant-1',
      lessonId: 'lesson-1',
      body: { title: ' Updated Lesson ', type: 'text' },
    });

    expect(prisma.lesson.update).toHaveBeenCalledWith({
      where: { id: 'lesson-1' },
      data: {
        title: 'Updated Lesson',
        type: 'text',
        content: undefined,
        duration: undefined,
        order: undefined,
      },
    });
    expect(result.title).toBe('Updated Lesson');
  });

  it('rejects update for cross-tenant lesson', async () => {
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      module: {
        course: { tenantId: 'tenant-2' },
      },
    });

    await expect(
      service.updateLesson({
        tenantId: 'tenant-1',
        lessonId: 'lesson-1',
        body: { title: 'Hacked' },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes a lesson within the tenant', async () => {
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      module: {
        course: { tenantId: 'tenant-1' },
      },
    });
    prisma.lesson.delete.mockResolvedValue({});

    const result = await service.deleteLesson('tenant-1', 'lesson-1');

    expect(result).toEqual({
      id: 'lesson-1',
      deleted: true,
    });
  });

  it('rejects deleting a cross-tenant lesson', async () => {
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      module: {
        course: { tenantId: 'tenant-2' },
      },
    });

    await expect(
      service.deleteLesson('tenant-1', 'lesson-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
