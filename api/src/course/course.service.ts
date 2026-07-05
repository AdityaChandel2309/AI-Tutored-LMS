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

    // Parse comma-separated status list; empty/undefined = all statuses visible to caller.
    const requestedStatuses = (opts?.status ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const visibleClauses = this.buildVisibilityClauses({
      dbUserId,
      roles,
      requestedStatuses,
    });

    // No clause is visible to this caller → return empty page rather than tenant-wide leak.
    if (visibleClauses.length === 0) {
      return { items: [], total: 0, page, limit };
    }

    const where = { tenantId, OR: visibleClauses };

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

  /**
   * Same as getCourse but enforces the caller's visibility matrix.
   * Use for user-facing reads; callers with no visibility get NotFound
   * (avoids information leak vs. Forbidden).
   */
  async getCourseVisible(
    tenantId: string | null,
    courseId: string,
    caller: { authUserId?: string; roles?: string[] },
  ) {
    const course = await this.getCourse(tenantId, courseId);
    let dbUserId: string | undefined;
    if (caller.authUserId) {
      const dbUser = await this.prisma.user.findFirst({
        where: { keycloakId: caller.authUserId, tenantId: tenantId! },
        select: { id: true },
      });
      dbUserId = dbUser?.id;
    }
    if (!this.canSeeCourse(course.status, course.createdById, dbUserId, caller.roles ?? [])) {
      throw new NotFoundException('Course not found in current tenant');
    }
    return course;
  }

  private canSeeCourse(
    status: string,
    createdById: string | null,
    dbUserId: string | undefined,
    roles: string[],
  ) {
    const isSuper = roles.includes('super_admin');
    const isAdmin = roles.includes('admin');
    const isInstructor = roles.includes('instructor');
    const isOwner = !!dbUserId && dbUserId === createdById;
    if (status === 'published') return true;
    if (status === 'draft') return isInstructor && isOwner;
    if (status === 'review') return isSuper || (isInstructor && isOwner);
    if (status === 'archived') return isSuper || isAdmin || (isInstructor && isOwner);
    return false;
  }

  /**
   * Per-status visibility matrix:
   *  - published: everyone
   *  - draft:     instructor & owner only
   *  - review:    super_admin (all) OR instructor+owner
   *  - archived:  super_admin, admin, instructor+owner
   * When requestedStatuses is empty, we build clauses for every status
   * the caller can see (their default catalog view).
   */
  private buildVisibilityClauses(input: {
    dbUserId: string | undefined;
    roles: string[];
    requestedStatuses: string[];
  }): Record<string, unknown>[] {
    const { dbUserId, roles, requestedStatuses } = input;
    const isSuper = roles.includes('super_admin');
    const isAdmin = roles.includes('admin');
    const isInstructor = roles.includes('instructor');
    const statuses = requestedStatuses.length
      ? requestedStatuses
      : ['published', 'draft', 'review', 'archived'];

    const out: Record<string, unknown>[] = [];
    for (const s of statuses) {
      if (s === 'published') {
        out.push({ status: 'published' });
      } else if (s === 'draft') {
        if (isInstructor && dbUserId) {
          out.push({ status: 'draft', createdById: dbUserId });
        }
      } else if (s === 'review') {
        if (isSuper) {
          out.push({ status: 'review' });
        } else if (isInstructor && dbUserId) {
          out.push({ status: 'review', createdById: dbUserId });
        }
      } else if (s === 'archived') {
        if (isSuper || isAdmin) {
          out.push({ status: 'archived' });
        } else if (isInstructor && dbUserId) {
          out.push({ status: 'archived', createdById: dbUserId });
        }
      }
    }
    return out;
  }

  async createCourse(input: {
    tenantId: string | null;
    authUserId: string;
    body: CreateCourseDto;
    roles?: string[];
  }) {
    const { tenantId, authUserId, body, roles = [] } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    // Only instructors may create courses (drafts). Admin / super_admin do
    // NOT get authoring power — they review and publish.
    if (!roles.includes('instructor')) {
      throw new ForbiddenException(
        'Only instructors can create courses',
      );
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
