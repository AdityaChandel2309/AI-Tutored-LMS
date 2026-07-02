import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CourseService } from './course.service';

describe('CourseService', () => {
  type PrismaMock = {
    course: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    user: {
      findFirst: jest.Mock;
    };
    category: {
      findFirst: jest.Mock;
    };
    enrollment: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };

  const prisma: PrismaMock = {
    course: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
    },
    enrollment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: CourseService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CourseService(prisma as unknown as PrismaService, { emit: jest.fn() } as any);
  });

  it('lists courses only within the resolved tenant', async () => {
    prisma.course.findMany.mockResolvedValue([{ id: 'course-1' }]);
    prisma.course.count = jest.fn().mockResolvedValue(1);

    const result = await service.getCourses('tenant-1');

    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
        orderBy: { createdAt: 'asc' },
        take: 50,
        skip: 0,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('rejects course creation when tenant is missing', async () => {
    await expect(
      service.createCourse({
        tenantId: null,
        authUserId: 'kc-1',
        body: {
          title: 'Course',
          slug: 'course',
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a tenant-scoped course for an active creator', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      isActive: true,
    });
    prisma.course.findFirst.mockResolvedValueOnce(null);
    prisma.course.create.mockResolvedValue({
      id: 'course-1',
      slug: 'systems',
    });

    const result = await service.createCourse({
      tenantId: 'tenant-1',
      authUserId: 'kc-1',
      body: {
        title: ' Systems ',
        slug: 'systems',
      },
    });

    expect(prisma.course.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        title: 'Systems',
        slug: 'systems',
        description: null,
        status: 'draft',
        visibility: 'private',
        categoryId: null,
        createdById: 'user-1',
      },
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
            modules: true,
          },
        },
      },
    });
    expect(result.id).toBe('course-1');
  });

  it('rejects duplicate slugs within the same tenant', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      isActive: true,
    });
    prisma.course.findFirst.mockResolvedValueOnce({
      id: 'course-existing',
    });

    await expect(
      service.createCourse({
        tenantId: 'tenant-1',
        authUserId: 'kc-1',
        body: {
          title: 'Course',
          slug: 'duplicate',
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('enrolls the current tenant user in a course once', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      isActive: true,
    });
    prisma.course.findFirst.mockResolvedValue({
      id: 'course-1',
      tenantId: 'tenant-1',
      status: 'published',
    });
    prisma.enrollment.findUnique.mockResolvedValue(null);
    prisma.enrollment.create.mockResolvedValue({
      id: 'enrollment-1',
    });

    const result = await service.enrollInCourse({
      tenantId: 'tenant-1',
      authUserId: 'kc-1',
      courseId: 'course-1',
    });

    expect(prisma.enrollment.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        courseId: 'course-1',
      },
      include: {
        course: true,
      },
    });
    expect(result.id).toBe('enrollment-1');
  });

  it('rejects duplicate enrollments', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      isActive: true,
    });
    prisma.course.findFirst.mockResolvedValue({
      id: 'course-1',
      tenantId: 'tenant-1',
      status: 'published',
    });
    prisma.enrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1',
    });

    await expect(
      service.enrollInCourse({
        tenantId: 'tenant-1',
        authUserId: 'kc-1',
        courseId: 'course-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects cross-tenant category usage', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      isActive: true,
    });
    prisma.course.findFirst.mockResolvedValueOnce(null);
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(
      service.createCourse({
        tenantId: 'tenant-1',
        authUserId: 'kc-1',
        body: {
          title: 'Course',
          slug: 'course',
          categoryId: 'category-x',
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
