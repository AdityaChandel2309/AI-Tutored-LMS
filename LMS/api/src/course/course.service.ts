import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBus } from '../events/event-bus';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseStatus, VALID_COURSE_STATUSES } from './course-status';

@Injectable()
export class CourseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  async getCourses(
    tenantId: string | null,
    opts?: { page?: number; limit?: number; status?: string; userId?: string; roles?: string[] },
  ) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const page = opts?.page ?? 1;
    const limit = Math.min(opts?.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    // Resolve keycloak userId → DB user id for ownership filtering
    let dbUserId: string | undefined;
    if (opts?.userId) {
      const dbUser = await this.prisma.user.findFirst({
        where: { keycloakId: opts.userId, tenantId },
      });
      dbUserId = dbUser?.id;
    }

    const roles = opts?.roles ?? [];
    const isAdminOrSuperAdmin =
      roles.includes('super_admin') || roles.includes('admin');

    // Build the where clause based on status filter
    let where: any;
    const status = opts?.status;

    if (status === 'published') {
      where = { tenantId, status: 'published' };
    } else if (status === 'draft') {
      // Only show user's own drafts
      where = { tenantId, status: 'draft', ...(dbUserId ? { createdById: dbUserId } : {}) };
    } else if (status === 'review') {
      if (isAdminOrSuperAdmin) {
        // Admins see all review courses
        where = { tenantId, status: 'review' };
      } else {
        // Instructors see only their own review courses
        where = { tenantId, status: 'review', ...(dbUserId ? { createdById: dbUserId } : {}) };
      }
    } else {
      // No status filter — combined visibility (legacy / default)
      const orClauses: Record<string, unknown>[] = [
        { status: 'published' },
      ];
      if (dbUserId) {
        orClauses.push({ status: 'draft', createdById: dbUserId });
      }
      if (isAdminOrSuperAdmin) {
        orClauses.push({ status: 'review' });
      } else if (dbUserId) {
        orClauses.push({ status: 'review', createdById: dbUserId });
      }
      where = { tenantId, OR: orClauses };
    }

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip,
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
      }),
      this.prisma.course.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getCourse(tenantId: string | null, courseId: string) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        tenantId,
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
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
            },
          },
        },
        enrollments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found in current tenant');
    }

    return course;
  }

  async createCourse(input: {
    tenantId: string | null;
    authUserId: string;
    body: CreateCourseDto;
  }) {
    const { tenantId, authUserId, body } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const owner = await this.prisma.user.findFirst({
      where: {
        keycloakId: authUserId,
        tenantId,
        isActive: true,
      },
    });

    if (!owner) {
      throw new ForbiddenException(
        'Course creator does not belong to the resolved tenant',
      );
    }

    const existingCourse = await this.prisma.course.findFirst({
      where: {
        tenantId,
        slug: body.slug.trim(),
      },
    });

    if (existingCourse) {
      throw new ConflictException(
        'Course slug already exists in current tenant',
      );
    }

    await this.assertCategory(tenantId, body.categoryId);

    const requestedStatus = body.status?.trim() || 'draft';
    if (!VALID_COURSE_STATUSES.includes(requestedStatus as CourseStatus)) {
      throw new BadRequestException(
        `Invalid status "${requestedStatus}". Must be one of: ${VALID_COURSE_STATUSES.join(', ')}`,
      );
    }

    return this.prisma.course.create({
      data: {
        tenantId,
        title: body.title.trim(),
        slug: body.slug.trim(),
        description: body.description?.trim() || null,
        status: requestedStatus,
        visibility: body.visibility?.trim() || 'private',
        categoryId: body.categoryId ?? null,
        createdById: owner.id,
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
  }

  async updateCourse(input: {
    tenantId: string | null;
    courseId: string;
    body: UpdateCourseDto;
  }) {
    const { tenantId, courseId, body } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        tenantId,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found in current tenant');
    }

    const nextSlug = body.slug?.trim();
    if (nextSlug && nextSlug !== course.slug) {
      const existingCourse = await this.prisma.course.findFirst({
        where: {
          tenantId,
          slug: nextSlug,
          NOT: { id: courseId },
        },
      });

      if (existingCourse) {
        throw new ConflictException(
          'Course slug already exists in current tenant',
        );
      }
    }

    await this.assertCategory(tenantId, body.categoryId);

    return this.prisma.course.update({
      where: { id: courseId },
      data: {
        title: body.title?.trim(),
        slug: nextSlug,
        description:
          body.description === undefined
            ? undefined
            : body.description?.trim() || null,
        status: body.status?.trim(),
        visibility: body.visibility?.trim(),
        categoryId: body.categoryId === undefined ? undefined : body.categoryId,
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
  }

  async deleteCourse(tenantId: string | null, courseId: string) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        tenantId,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found in current tenant');
    }

    await this.prisma.course.delete({
      where: { id: courseId },
    });

    return {
      id: courseId,
      deleted: true,
    };
  }

  async enrollInCourse(input: {
    tenantId: string | null;
    authUserId: string;
    courseId: string;
  }) {
    const { tenantId, authUserId, courseId } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

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

    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        tenantId,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found in current tenant');
    }

    if (course.status !== CourseStatus.PUBLISHED) {
      throw new BadRequestException(
        'Enrollment is only allowed for published courses',
      );
    }

    const existingEnrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId,
        },
      },
    });

    if (existingEnrollment) {
      throw new ConflictException('User is already enrolled in this course');
    }

    const enrollment = await this.prisma.enrollment.create({
      data: {
        userId: user.id,
        courseId,
      },
      include: {
        course: true,
      },
    });

    this.eventBus.emit({
      type: 'enrollment.created',
      tenantId,
      timestamp: new Date(),
      actorId: user.id,
      entityId: enrollment.id,
      entityType: 'enrollment',
      payload: {
        enrollmentId: enrollment.id,
        userId: user.id,
        courseId,
      },
    });

    return enrollment;
  }

  async getMyCourses(input: { tenantId: string | null; authUserId: string }) {
    const { tenantId, authUserId } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

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

    return this.prisma.enrollment.findMany({
      where: {
        userId: user.id,
        course: {
          tenantId,
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        course: {
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
                modules: true,
              },
            },
          },
        },
      },
    });
  }

  private async assertCategory(tenantId: string, categoryId?: string | null) {
    if (!categoryId) {
      return;
    }

    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found in current tenant');
    }
  }
}
