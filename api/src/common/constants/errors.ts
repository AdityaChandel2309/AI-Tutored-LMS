/**
 * Standardized error messages used across services.
 * Centralize to ensure consistency and ease of maintenance.
 */
export const ErrorMessages = {
  // Tenant errors
  TENANT_NOT_RESOLVED: 'Tenant could not be resolved',
  TENANT_ACCESS_DENIED: 'Access denied to this tenant',
  TENANT_USER_MISMATCH: 'User does not belong to the resolved tenant',

  // Not found errors
  COURSE_NOT_FOUND: 'Course not found in current tenant',
  MODULE_NOT_FOUND: 'Module not found in current tenant',
  LESSON_NOT_FOUND: 'Lesson not found in current tenant',
  CATEGORY_NOT_FOUND: 'Category not found in current tenant',
  ENROLLMENT_NOT_FOUND: 'User is not enrolled in this course',

  // Conflict errors
  COURSE_SLUG_EXISTS: 'Course slug already exists in current tenant',
  MODULE_ORDER_EXISTS: 'Module order already exists in this course',
  LESSON_ORDER_EXISTS: 'Lesson order already exists in this module',
  ALREADY_ENROLLED: 'User is already enrolled in this course',
  MODULE_HAS_LESSONS: 'Module still has lessons assigned',

  // Validation errors
  INVALID_STATE: (state: string, valid: string[]) =>
    `Invalid state "${state}". Must be one of: ${valid.join(', ')}`,
  INVALID_STATUS: (status: string, valid: string[]) =>
    `Invalid status "${status}". Must be one of: ${valid.join(', ')}`,

  // Enrollment errors
  ENROLLMENT_NOT_PUBLISHED: 'Enrollment is only allowed for published courses',
} as const;