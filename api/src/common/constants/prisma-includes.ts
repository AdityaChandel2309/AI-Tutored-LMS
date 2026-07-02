/**
 * Shared Prisma include/select patterns to avoid repetition across services.
 */

/** Standard user fields for relations */
export const INCLUDE_USER_FIELDS = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
};

/** Include for createdBy with standard fields */
export const INCLUDE_CREATED_BY = {
  createdBy: {
    select: INCLUDE_USER_FIELDS,
  },
};

/** Include for category */
export const INCLUDE_CATEGORY = {
  category: true,
};

/** Count of enrollments */
export const COUNT_ENROLLMENTS = {
  enrollments: true,
};

/** Count of modules */
export const COUNT_MODULES = {
  modules: true,
};

/** Standard _count include for courses */
export const INCLUDE_COURSE_COUNT = {
  select: {
    enrollments: true,
    modules: true,
  },
} as const;

/** Standard _count include for modules */
export const INCLUDE_MODULE_COUNT = {
  select: {
    lessons: true,
  },
} as const;

/** Lesson select for progress queries */
export const SELECT_LESSON_FIELDS = {
  id: true,
  title: true,
  type: true,
  duration: true,
  module: {
    select: {
      id: true,
      title: true,
      order: true,
    },
  },
} as const;

/**
 * Helper to build full course include for getCourse-type queries.
 * Returns both createdBy and _count in a single object.
 */
export function includeCourseFull() {
  return {
    ...INCLUDE_CATEGORY,
    ...INCLUDE_CREATED_BY,
    _count: INCLUDE_COURSE_COUNT,
  };
}

/**
 * Helper to build module include for getModule-type queries.
 */
export function includeModuleWithLessons() {
  return {
    lessons: {
      orderBy: { order: 'asc' },
    },
  };
}

/**
 * Helper to build enrollment include with user details.
 */
export function includeEnrollmentWithUser() {
  return {
    include: {
      user: {
        select: INCLUDE_USER_FIELDS,
      },
    },
  };
}