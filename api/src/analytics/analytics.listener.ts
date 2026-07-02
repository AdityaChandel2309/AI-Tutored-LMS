import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AnalyticsService } from './analytics.service';
import type { DomainEvent } from '../events/domain-events';

/**
 * Subscribes to all analytics-relevant domain events
 * and persists them synchronously via the AnalyticsService.
 *
 * No queues, no workers — direct in-process persistence.
 */
@Injectable()
export class AnalyticsListener {
  private readonly logger = new Logger(AnalyticsListener.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @OnEvent('enrollment.created')
  async onEnrollmentCreated(event: DomainEvent) {
    await this.analyticsService.persistEvent(event);
  }

  @OnEvent('lesson.completed')
  async onLessonCompleted(event: DomainEvent) {
    await this.analyticsService.persistEvent(event);
  }

  @OnEvent('course.completed')
  async onCourseCompleted(event: DomainEvent) {
    await this.analyticsService.persistEvent(event);
  }

  @OnEvent('course.published')
  async onCoursePublished(event: DomainEvent) {
    await this.analyticsService.persistEvent(event);
  }

  @OnEvent('assessment.attempted')
  async onAssessmentAttempted(event: DomainEvent) {
    await this.analyticsService.persistEvent(event);
  }

  @OnEvent('assessment.passed')
  async onAssessmentPassed(event: DomainEvent) {
    await this.analyticsService.persistEvent(event);
  }

  @OnEvent('assessment.failed')
  async onAssessmentFailed(event: DomainEvent) {
    await this.analyticsService.persistEvent(event);
  }

  @OnEvent('certificate.issued')
  async onCertificateIssued(event: DomainEvent) {
    await this.analyticsService.persistEvent(event);
  }

  @OnEvent('video.uploaded')
  async onVideoUploaded(event: DomainEvent) {
    await this.analyticsService.persistEvent(event);
  }

  @OnEvent('scorm.launched')
  async onScormLaunched(event: DomainEvent) {
    await this.analyticsService.persistEvent(event);
  }
}
