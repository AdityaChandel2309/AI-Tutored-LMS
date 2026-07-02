/**
 * Lightweight domain event types emitted by the LMS backend.
 *
 * Events are fire-and-forget for now — consumers can later
 * subscribe via NestJS EventEmitter2, BullMQ, or a
 * persistent event bus without changing the emitting code.
 *
 * Normalized fields (Phase 5 analytics):
 * - actorId   — the user who triggered the event
 * - entityId  — the primary entity affected
 * - entityType — the type of the primary entity
 */

export interface DomainEvent {
  readonly type: string;
  readonly tenantId: string;
  readonly timestamp: Date;
  readonly actorId?: string;
  readonly entityId?: string;
  readonly entityType?: string;
  readonly payload: Record<string, unknown>;
}

// ─── Course lifecycle ───────────────────────────

export interface CourseSubmittedForReview extends DomainEvent {
  type: 'course.submitted_for_review';
  payload: {
    courseId: string;
    previousStatus: string;
  };
}

export interface CoursePublished extends DomainEvent {
  type: 'course.published';
  payload: {
    courseId: string;
    previousStatus: string;
  };
}

export interface CourseArchived extends DomainEvent {
  type: 'course.archived';
  payload: {
    courseId: string;
    previousStatus: string;
  };
}

export interface CourseUnpublished extends DomainEvent {
  type: 'course.unpublished';
  payload: {
    courseId: string;
    previousStatus: string;
    targetStatus: string;
  };
}

// ─── Enrollment ────────────────────────────────

export interface EnrollmentCreated extends DomainEvent {
  type: 'enrollment.created';
  payload: {
    enrollmentId: string;
    userId: string;
    courseId: string;
  };
}

// ─── Progress ──────────────────────────────────

export interface LessonCompleted extends DomainEvent {
  type: 'lesson.completed';
  payload: {
    progressId: string;
    enrollmentId: string;
    lessonId: string;
    userId: string;
  };
}

export interface CourseCompleted extends DomainEvent {
  type: 'course.completed';
  payload: {
    enrollmentId: string;
    userId: string;
    courseId: string;
  };
}

// ─── Video ─────────────────────────────────

export interface VideoUploaded extends DomainEvent {
  type: 'video.uploaded';
  payload: {
    videoId: string;
    courseId: string;
  };
}

export interface VideoDeleted extends DomainEvent {
  type: 'video.deleted';
  payload: {
    videoId: string;
    courseId: string;
  };
}

// ─── SCORM ─────────────────────────────────

export interface ScormLaunched extends DomainEvent {
  type: 'scorm.launched';
  payload: {
    scormPackageId: string;
    courseId: string;
    userId: string;
  };
}

// ─── Assessment ────────────────────────────

export interface AssessmentAttempted extends DomainEvent {
  type: 'assessment.attempted';
  payload: {
    attemptId: string;
    assessmentId: string;
    enrollmentId: string;
    userId: string;
    score: number;
    passed: boolean;
  };
}

export interface AssessmentPassed extends DomainEvent {
  type: 'assessment.passed';
  payload: {
    attemptId: string;
    assessmentId: string;
    lessonId: string;
    enrollmentId: string;
    userId: string;
    score: number;
  };
}

export interface AssessmentFailed extends DomainEvent {
  type: 'assessment.failed';
  payload: {
    attemptId: string;
    assessmentId: string;
    enrollmentId: string;
    userId: string;
    score: number;
    attemptsRemaining: number | null;
  };
}

// ─── Certificate ───────────────────────────

export interface CertificateIssued extends DomainEvent {
  type: 'certificate.issued';
  payload: {
    certificateId: string;
    certificateNumber: string;
    userId: string;
    courseId: string;
    enrollmentId: string;
  };
}

// ─── Notification ──────────────────────────

export interface NotificationCreated extends DomainEvent {
  type: 'notification.created';
  payload: {
    notificationId: string;
    userId: string;
    notificationType: string;
  };
}
