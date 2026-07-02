/**
 * Course lifecycle status values.
 *
 * This enum is enforced at the service layer rather than
 * the Prisma schema so that the database column remains a
 * plain string and no migration is needed to add values.
 */
export const CourseStatus = {
  DRAFT: 'draft',
  REVIEW: 'review',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus];

export const VALID_COURSE_STATUSES = Object.values(CourseStatus);

/**
 * Valid transitions from each status.
 *
 * draft      → review
 * review     → published | draft  (reject back to draft)
 * published  → archived
 * archived   → draft              (re-activate)
 */
export const COURSE_TRANSITIONS: Record<CourseStatus, CourseStatus[]> = {
  [CourseStatus.DRAFT]: [CourseStatus.REVIEW],
  [CourseStatus.REVIEW]: [CourseStatus.PUBLISHED, CourseStatus.DRAFT],
  [CourseStatus.PUBLISHED]: [CourseStatus.ARCHIVED],
  [CourseStatus.ARCHIVED]: [CourseStatus.DRAFT],
};
