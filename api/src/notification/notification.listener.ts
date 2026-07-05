import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';

/**
 * Listens for domain events and creates notifications
 * for the relevant users.
 */
@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent('enrollment.created')
  async onEnrollmentCreated(event: {
    type: string;
    tenantId: string;
    payload: { enrollmentId: string; userId: string; courseId: string };
  }) {
    try {
      const course = await this.prisma.course.findUnique({
        where: { id: event.payload.courseId },
        select: { title: true },
      });
      if (!course) return;

      await this.notificationService.createNotification({
        userId: event.payload.userId,
        tenantId: event.tenantId,
        type: 'enrollment.created',
        title: `Enrolled in "${course.title}"`,
        body: `You've been enrolled in "${course.title}". Start learning now!`,
        metadata: {
          courseId: event.payload.courseId,
          enrollmentId: event.payload.enrollmentId,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to create enrollment notification: ${(err as Error).message}`,
      );
    }
  }

  @OnEvent('assessment.passed')
  async onAssessmentPassed(event: {
    type: string;
    tenantId: string;
    payload: {
      attemptId: string;
      assessmentId: string;
      lessonId: string;
      enrollmentId: string;
      userId: string;
      score: number;
    };
  }) {
    try {
      const assessment = await this.prisma.assessment.findUnique({
        where: { id: event.payload.assessmentId },
        select: { title: true },
      });
      if (!assessment) return;

      await this.notificationService.createNotification({
        userId: event.payload.userId,
        tenantId: event.tenantId,
        type: 'assessment.passed',
        title: `Quiz passed: "${assessment.title}"`,
        body: `You passed "${assessment.title}" with ${event.payload.score}%!`,
        metadata: {
          assessmentId: event.payload.assessmentId,
          attemptId: event.payload.attemptId,
          score: event.payload.score,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to create assessment notification: ${(err as Error).message}`,
      );
    }
  }

  @OnEvent('certificate.issued')
  async onCertificateIssued(event: {
    type: string;
    tenantId: string;
    payload: {
      certificateId: string;
      certificateNumber: string;
      userId: string;
      courseId: string;
      enrollmentId: string;
    };
  }) {
    try {
      const course = await this.prisma.course.findUnique({
        where: { id: event.payload.courseId },
        select: { title: true },
      });
      if (!course) return;

      await this.notificationService.createNotification({
        userId: event.payload.userId,
        tenantId: event.tenantId,
        type: 'certificate.issued',
        title: `Certificate earned for "${course.title}"`,
        body: `Congratulations! You've earned certificate ${event.payload.certificateNumber}.`,
        metadata: {
          certificateId: event.payload.certificateId,
          certificateNumber: event.payload.certificateNumber,
          courseId: event.payload.courseId,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to create certificate notification: ${(err as Error).message}`,
      );
    }
  }

  @OnEvent('course.completed')
  async onCourseCompleted(event: {
    type: string;
    tenantId: string;
    payload: {
      enrollmentId: string;
      userId: string;
      courseId: string;
    };
  }) {
    try {
      const course = await this.prisma.course.findUnique({
        where: { id: event.payload.courseId },
        select: { title: true },
      });
      if (!course) return;

      await this.notificationService.createNotification({
        userId: event.payload.userId,
        tenantId: event.tenantId,
        type: 'course.completed',
        title: `Course completed: "${course.title}"`,
        body: `Congratulations! You've completed "${course.title}".`,
        metadata: {
          courseId: event.payload.courseId,
          enrollmentId: event.payload.enrollmentId,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to create course completion notification: ${(err as Error).message}`,
      );
    }
  }

  @OnEvent('course.submitted_for_review')
  async onCourseSubmittedForReview(event: {
    type: string;
    tenantId: string;
    payload: { courseId: string; previousStatus?: string };
  }) {
    try {
      const course = await this.prisma.course.findUnique({
        where: { id: event.payload.courseId },
        select: { title: true, createdBy: { select: { firstName: true, lastName: true, email: true } } },
      });
      if (!course) return;

      // Notify every super_admin in the tenant so they can review + publish.
      const superAdmins = await this.prisma.user.findMany({
        where: {
          tenantId: event.tenantId,
          isActive: true,
          roles: { has: 'super_admin' },
        },
        select: { id: true },
      });

      const author =
        [course.createdBy?.firstName, course.createdBy?.lastName].filter(Boolean).join(' ') ||
        course.createdBy?.email ||
        'An instructor';

      await Promise.all(
        superAdmins.map((sa) =>
          this.notificationService.createNotification({
            userId: sa.id,
            tenantId: event.tenantId,
            type: 'course.submitted_for_review',
            title: `Course pending review: "${course.title}"`,
            body: `${author} submitted "${course.title}" for your review.`,
            metadata: {
              courseId: event.payload.courseId,
              action: 'review',
            },
          }),
        ),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to create submit-for-review notification: ${(err as Error).message}`,
      );
    }
  }

  @OnEvent('course.published')
  async onCoursePublished(event: {
    type: string;
    tenantId: string;
    payload: { courseId: string };
  }) {
    try {
      const course = await this.prisma.course.findUnique({
        where: { id: event.payload.courseId },
        select: { title: true, createdById: true },
      });
      if (!course?.createdById) return;
      await this.notificationService.createNotification({
        userId: course.createdById,
        tenantId: event.tenantId,
        type: 'course.published',
        title: `Course published: "${course.title}"`,
        body: `Your course "${course.title}" is now live.`,
        metadata: { courseId: event.payload.courseId, action: 'view' },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to create course-published notification: ${(err as Error).message}`,
      );
    }
  }

  @OnEvent('course.unpublished')
  async onCourseUnpublished(event: {
    type: string;
    tenantId: string;
    payload: { courseId: string };
  }) {
    try {
      const course = await this.prisma.course.findUnique({
        where: { id: event.payload.courseId },
        select: { title: true, createdById: true },
      });
      if (!course?.createdById) return;
      await this.notificationService.createNotification({
        userId: course.createdById,
        tenantId: event.tenantId,
        type: 'course.unpublished',
        title: `Course sent back to draft: "${course.title}"`,
        body: `"${course.title}" was moved back to draft. Please update and resubmit.`,
        metadata: { courseId: event.payload.courseId, action: 'edit' },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to create course-unpublished notification: ${(err as Error).message}`,
      );
    }
  }
}
