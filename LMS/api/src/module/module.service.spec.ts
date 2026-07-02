import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleService } from './module.service';

describe('ModuleService', () => {
  type PrismaMock = {
    course: {
      findFirst: jest.Mock;
    };
    courseModule: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const prisma: PrismaMock = {
    course: {
      findFirst: jest.fn(),
    },
    courseModule: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: ModuleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ModuleService(prisma as unknown as PrismaService);
  });

  it('rejects module creation when tenant is missing', async () => {
    await expect(
      service.createModule({
        tenantId: null,
        courseId: 'course-1',
        body: { title: 'Module 1' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects module creation when course does not belong to tenant', async () => {
    prisma.course.findFirst.mockResolvedValue(null);

    await expect(
      service.createModule({
        tenantId: 'tenant-1',
        courseId: 'course-x',
        body: { title: 'Module 1' },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('auto-assigns order when not provided', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'course-1',
      tenantId: 'tenant-1',
    });
    prisma.courseModule.findFirst
      .mockResolvedValueOnce({ order: 3 }) // last module lookup
      .mockResolvedValueOnce(null); // duplicate order check
    prisma.courseModule.create.mockResolvedValue({
      id: 'mod-1',
      title: 'Module 1',
      order: 4,
    });

    const result = await service.createModule({
      tenantId: 'tenant-1',
      courseId: 'course-1',
      body: { title: ' Module 1 ' },
    });

    expect(prisma.courseModule.create).toHaveBeenCalledWith({
      data: {
        courseId: 'course-1',
        title: 'Module 1',
        order: 4,
      },
      include: {
        _count: {
          select: { lessons: true },
        },
      },
    });
    expect(result.order).toBe(4);
  });

  it('uses explicit order when provided', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'course-1',
      tenantId: 'tenant-1',
    });
    prisma.courseModule.findFirst.mockResolvedValue(null);
    prisma.courseModule.create.mockResolvedValue({
      id: 'mod-1',
      title: 'Module 1',
      order: 2,
    });

    const result = await service.createModule({
      tenantId: 'tenant-1',
      courseId: 'course-1',
      body: { title: 'Module 1', order: 2 },
    });

    expect(result.order).toBe(2);
  });

  it('rejects duplicate order within the same course', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'course-1',
      tenantId: 'tenant-1',
    });
    prisma.courseModule.findFirst.mockResolvedValue({
      id: 'mod-existing',
      order: 1,
    });

    await expect(
      service.createModule({
        tenantId: 'tenant-1',
        courseId: 'course-1',
        body: { title: 'Module 1', order: 1 },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates a module within the tenant', async () => {
    prisma.courseModule.findFirst.mockResolvedValue({
      id: 'mod-1',
      courseId: 'course-1',
      order: 1,
      course: { tenantId: 'tenant-1' },
    });
    prisma.courseModule.update.mockResolvedValue({
      id: 'mod-1',
      title: 'Updated',
      order: 1,
    });

    const result = await service.updateModule({
      tenantId: 'tenant-1',
      moduleId: 'mod-1',
      body: { title: ' Updated ' },
    });

    expect(prisma.courseModule.update).toHaveBeenCalledWith({
      where: { id: 'mod-1' },
      data: {
        title: 'Updated',
        order: undefined,
      },
      include: {
        _count: {
          select: { lessons: true },
        },
      },
    });
    expect(result.title).toBe('Updated');
  });

  it('rejects update for cross-tenant module', async () => {
    prisma.courseModule.findFirst.mockResolvedValue({
      id: 'mod-1',
      courseId: 'course-1',
      course: { tenantId: 'tenant-2' },
    });

    await expect(
      service.updateModule({
        tenantId: 'tenant-1',
        moduleId: 'mod-1',
        body: { title: 'Hacked' },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes a module with no lessons', async () => {
    prisma.courseModule.findFirst.mockResolvedValue({
      id: 'mod-1',
      courseId: 'course-1',
      course: { tenantId: 'tenant-1' },
      _count: { lessons: 0 },
    });
    prisma.courseModule.delete.mockResolvedValue({});

    const result = await service.deleteModule('tenant-1', 'mod-1');

    expect(result).toEqual({
      id: 'mod-1',
      deleted: true,
    });
  });

  it('rejects deleting a module that still has lessons', async () => {
    prisma.courseModule.findFirst.mockResolvedValue({
      id: 'mod-1',
      courseId: 'course-1',
      course: { tenantId: 'tenant-1' },
      _count: { lessons: 3 },
    });

    await expect(
      service.deleteModule('tenant-1', 'mod-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
