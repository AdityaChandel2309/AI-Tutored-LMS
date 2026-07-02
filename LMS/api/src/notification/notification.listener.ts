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
}
