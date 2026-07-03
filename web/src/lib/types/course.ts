// ─── Shared domain types ───────────────────
// Single source of truth for course-domain types consumed by all frontend components.
// These mirror the backend response shapes after the envelope is unwrapped.

export type Lesson = {
  id: string;
  title: string;
  type: string;
  order: number;
  content: LessonContent;
  // Estimated lesson length in seconds (optional; surfaced in the player UI).
  duration?: number | null;
};

export type VideoLessonContent = {
  videoId?: string;
  // Optional public URL for demo/seed content that isn't backed by an
  // uploaded Video row in MinIO. When set (and videoId is absent), the
  // player renders the URL directly.
  externalUrl?: string | null;
  posterUrl?: string | null;
};

export type ScormLessonContent = {
  scormPackageId: string;
};

export type LessonContent =
  | VideoLessonContent
  | ScormLessonContent
  | Record<string, unknown>
  | null;

export type CourseModule = {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
};

export type CourseCategory = {
  id: string;
  name: string;
};

export type CourseAuthor = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export type CourseStatus =
  | "draft"
  | "review"
  | "published"
  | "archived";

export type Course = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: CourseStatus;
  visibility: string;
  categoryId: string | null;
  createdAt: string;
  category: CourseCategory | null;
  createdBy: CourseAuthor;
  modules: CourseModule[];
  _count: {
    enrollments: number;
    modules: number;
  };
};

export type CourseSummary = Omit<
  Course,
  "modules"
>;

export type Enrollment = {
  id: string;
  userId: string;
  courseId: string;
  progress: number;
  completedAt: string | null;
  createdAt: string;
  course: CourseSummary;
};

export type LessonProgress = {
  id: string;
  lessonId: string;
  state: "not_started" | "in_progress" | "completed" | "locked";
  progress: number;
  completedAt: string | null;
};

export type Video = {
  id: string;
  tenantId: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  status: string;
  objectKey: string;
  sizeBytes: number | null;
  durationSec: number | null;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ScormPackage = {
  id: string;
  tenantId: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  status: string;
  objectKey: string;
  manifestPath: string | null;
  launchPath: string | null;
  manifestIdentifier: string | null;
  scormVersion: string | null;
  sizeBytes: number | null;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type VideoUploadResponse = {
  videoId: string;
  uploadUrl: string;
  objectKey: string;
  maxSizeBytes: number;
  expiresAt: string;
};

export type VideoStreamResponse = {
  url: string;
  mimeType: string;
  durationSec: number | null;
  expiresAt: string;
};

export type ScormUploadResponse = {
  packageId: string;
  uploadUrl: string;
  objectKey: string;
  maxSizeBytes: number;
  expiresAt: string;
};

export type ScormLaunchResponse = {
  packageId: string;
  launchPath: string;
  title: string;
  scormVersion: string | null;
};

export type ProgressSummary = {
  lessons: LessonProgress[];
  summary: {
    total: number;
    completed: number;
    progress: number;
  };
};

// ─── Assessment domain types ────────────────

export type QuestionOption = {
  id: string;
  questionId: string;
  text: string;
  order: number;
  isCorrect?: boolean;
};

export type Question = {
  id: string;
  assessmentId: string;
  type: "multiple_choice" | "multi_select" | "true_false";
  text: string;
  explanation?: string | null;
  points: number;
  order: number;
  options: QuestionOption[];
};

export type Assessment = {
  id: string;
  lessonId: string;
  title: string;
  description: string | null;
  passingScore: number;
  maxAttempts: number | null;
  timeLimitSec: number | null;
  isRandomized: boolean;
  questions: Question[];
};

export type AttemptAnswer = {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOptionIds: string[];
  isCorrect?: boolean | null;
  question?: Question;
};

export type AssessmentAttempt = {
  id: string;
  assessmentId: string;
  enrollmentId: string;
  attemptNumber: number;
  score: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
  answers: AttemptAnswer[];
  assessment?: {
    title: string;
    passingScore: number;
    timeLimitSec: number | null;
    lessonId?: string;
    questions?: Question[];
  };
};

export type AttemptSummary = {
  id: string;
  attemptNumber: number;
  score: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
};

// ─── Certificate domain types ───────────────

export type CertificateTemplate = {
  id: string;
  tenantId: string;
  courseId: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type IssuedCertificate = {
  id: string;
  templateId: string;
  enrollmentId: string;
  userId: string;
  tenantId: string;
  certificateNumber: string;
  learnerName: string;
  courseTitle: string;
  completionDate: string;
  scoreSummary: string | null;
  pdfObjectKey: string | null;
  issuedAt: string;
  template?: {
    courseId: string;
  };
};

export type CertificatePdfResponse = {
  url: string;
  certificateNumber: string;
};

// ─── Notification domain types ──────────────

export type Notification = {
  id: string;
  userId: string;
  tenantId: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type UnreadCountResponse = {
  unreadCount: number;
};
