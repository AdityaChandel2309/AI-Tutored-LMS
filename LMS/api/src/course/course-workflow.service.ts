import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBus } from '../events/event-bus';
import {
  CourseStatus,
  COURSE_TRANSITIONS,
  VALID_COURSE_STATUSES,
} from './course-status';

@Injectable()
export class CourseWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Submit a draft course for review.
   * draft → review
   */
  async submitForReview(tenantId: string | null, courseId: string) {
    return this.transition(tenantId, courseId, CourseStatus.REVIEW);
  }

  /**
   * Publish a course that is in review.
   * review → published
   */
  async publish(tenantId: string | null, courseId: string) {
    return this.transition(tenantId, courseId, CourseStatus.PUBLISHED);
  }

  /**
   * Archive a published course.
   * published → archived
   */
  async archive(tenantId: string | null, courseId: string) {
    return this.transition(tenantId, courseId, CourseStatus.ARCHIVED);
  }

  /**
   * Unpublish: send a course back to draft.
   * review → draft  (reject)
   * archived → draft (re-activate)
   */
  async unpublish(tenantId: string | null, courseId: string) {
    return this.transition(tenantId, courseId, CourseStatus.DRAFT);
  }

  // ─── private ────────────────────────────────

  private async transition(
    tenantId: string | null,
    courseId: string,
    targetStatus: CourseStatus,
  ) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tenantId },
    });

    if (!course) {
      throw new NotFoundException('Course not found in current tenant');
    }

    const currentStatus = course.status as CourseStatus;

    if (!VALID_COURSE_STATUSES.includes(currentStatus)) {
      throw new BadRequestException(
        `Course has an unrecognised status "${course.status}"`,
      );
    }

    const allowed = COURSE_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition from "${currentStatus}" to "${targetStatus}"`,
      );
    }

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: { status: targetStatus },
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

    this.emitEvent(tenantId, courseId, currentStatus, targetStatus);

    return updated;
  }

  private emitEvent(
    tenantId: string,
    courseId: string,
    previousStatus: string,
    targetStatus: string,
  ) {
    const now = new Date();
    const common = {
      tenantId,
      timestamp: now,
      entityId: courseId,
      entityType: 'course' as const,
    };

    if (targetStatus === CourseStatus.REVIEW) {
      this.eventBus.emit({
        ...common,
        type: 'course.submitted_for_review',
        payload: { courseId, previousStatus },
      });
    } else if (targetStatus === CourseStatus.PUBLISHED) {
      this.eventBus.emit({
        ...common,
        type: 'course.published',
        payload: { courseId, previousStatus },
      });
    } else if (targetStatus === CourseStatus.ARCHIVED) {
      this.eventBus.emit({
        ...common,
        type: 'course.archived',
        payload: { courseId, previousStatus },
      });
    } else if (targetStatus === CourseStatus.DRAFT) {
      this.eventBus.emit({
        ...common,
        type: 'course.unpublished',
        payload: {
          courseId,
          previousStatus,
          targetStatus,
        },
      });
    }
  }
}
