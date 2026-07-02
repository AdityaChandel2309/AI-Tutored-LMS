/**
 * LMS Learning Path Workflow Test
 *
 * Validates the full LMS learning path end-to-end:
 * 1. Course creation by instructor → verify draft status in listing
 * 2. Adding modules and lessons → verify hierarchy retrieval
 * 3. Assessment creation with questions and options → verify linked to lesson
 * 4. Submit-review → publish transitions → verify "published" status
 * 5. Learner enrollment → verify progress at zero
 * 6. Lesson progress updates → verify enrollment progress percentage
 * 7. Assessment submission with correct answers → verify scored and passed
 * 8. Course completion with certificate template → verify certificate issued
 * 9. Enrollment rejection for non-published course → verify error response
 *
 * Requirements: 4.1–4.9
 */

import { WorkflowResult, StepResult, SeedResult } from './types.js';
import { getToken, apiClient } from './helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Infer the API client type from the helper function
type ApiClient = ReturnType<typeof apiClient>;

async function runStep(
  description: string,
  fn: () => Promise<{ passed: boolean; expected?: string; actual?: string }>,
): Promise<StepResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      description,
      passed: result.passed,
      expected: result.expected,
      actual: result.actual,
      duration: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      description,
      passed: false,
      expected: 'No error thrown',
      actual: `Error: ${message}`,
      duration: Date.now() - start,
    };
  }
}

// ─── Shared state across steps ───────────────────────────────────────────────

interface WorkflowState {
  instructorToken: string;
  learnerToken: string;
  adminToken: string;
  instructorClient: ApiClient;
  learnerClient: ApiClient;
  adminClient: ApiClient;
  createdCourseId: string;
  createdModuleIds: string[];
  createdLessonIds: string[];
  quizLessonId: string;
  assessmentId: string;
  questionIds: string[];
  correctOptionIds: string[];
  enrollmentId: string;
  certificateTemplateId: string;
}

// ─── Step 1: Course creation by instructor ───────────────────────────────────

/**
 * Validates: Requirement 4.1
 * WHEN an instructor creates a course, it appears in listing with status "draft"
 */
async function stepCourseCreation(
  seed: SeedResult,
  state: Partial<WorkflowState>,
): Promise<StepResult> {
  return runStep(
    'Course creation by instructor → verify draft status in listing',
    async () => {
      const token = await getToken(seed.users.instructor);
      state.instructorToken = token;
      state.instructorClient = apiClient(token);

      const slug = `workflow-test-${Date.now()}`;
      const createRes = await state.instructorClient!.post('/courses', {
        title: 'LMS Workflow Test Course',
        slug,
        description: 'Course created by LMS workflow validation',
        categoryId: seed.categories[0] || undefined,
      });

      if (createRes.status !== 201 && createRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200/201 on course creation',
          actual: `HTTP ${createRes.status}: ${JSON.stringify(createRes.data)}`,
        };
      }

      state.createdCourseId = createRes.data.id;

      // Verify the course appears in listing with draft status
      const listRes = await state.instructorClient!.get('/courses');
      if (listRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200 on course listing',
          actual: `HTTP ${listRes.status}: ${JSON.stringify(listRes.data)}`,
        };
      }

      const courses = Array.isArray(listRes.data)
        ? listRes.data
        : listRes.data?.data ?? listRes.data?.courses ?? [];
      const created = courses.find((c: any) => c.id === state.createdCourseId);

      if (!created) {
        return {
          passed: false,
          expected: 'Created course appears in listing',
          actual: `Course ${state.createdCourseId} not found in listing of ${courses.length} courses`,
        };
      }

      if (created.status !== 'draft') {
        return {
          passed: false,
          expected: 'Course status is "draft"',
          actual: `Course status is "${created.status}"`,
        };
      }

      return {
        passed: true,
        expected: 'Course created with draft status and visible in listing',
        actual: `Course "${created.title}" created with status "${created.status}"`,
      };
    },
  );
}

// ─── Step 2: Adding modules and lessons ──────────────────────────────────────

/**
 * Validates: Requirement 4.2
 * WHEN an instructor adds modules and lessons, the hierarchy is retrievable
 */
async function stepModulesAndLessons(
  _seed: SeedResult,
  state: Partial<WorkflowState>,
): Promise<StepResult> {
  return runStep(
    'Adding modules and lessons → verify hierarchy retrieval',
    async () => {
      if (!state.createdCourseId || !state.instructorClient) {
        return {
          passed: false,
          expected: 'Course created in previous step',
          actual: 'No course ID available — prior step may have failed',
        };
      }

      const client = state.instructorClient;
      const courseId = state.createdCourseId;

      // Create two modules
      const mod1Res = await client.post(`/courses/${courseId}/modules`, {
        title: 'Module 1: Fundamentals',
        order: 1,
      });
      const mod2Res = await client.post(`/courses/${courseId}/modules`, {
        title: 'Module 2: Advanced Topics',
        order: 2,
      });

      if (mod1Res.status > 201 || mod2Res.status > 201) {
        return {
          passed: false,
          expected: 'HTTP 200/201 on module creation',
          actual: `Module 1: HTTP ${mod1Res.status}, Module 2: HTTP ${mod2Res.status}`,
        };
      }

      const mod1Id = mod1Res.data.id;
      const mod2Id = mod2Res.data.id;
      state.createdModuleIds = [mod1Id, mod2Id];

      // Create lessons in each module
      const lesson1Res = await client.post(`/modules/${mod1Id}/lessons`, {
        title: 'Lesson 1: Introduction',
        type: 'text',
        content: { body: 'Welcome to the course' },
        duration: 300,
      });
      const lesson2Res = await client.post(`/modules/${mod1Id}/lessons`, {
        title: 'Lesson 2: Core Concepts',
        type: 'video',
        duration: 600,
      });
      const lesson3Res = await client.post(`/modules/${mod2Id}/lessons`, {
        title: 'Lesson 3: Deep Dive',
        type: 'text',
        content: { body: 'Advanced material' },
        duration: 450,
      });
      const quizLessonRes = await client.post(`/modules/${mod2Id}/lessons`, {
        title: 'Lesson 4: Quiz',
        type: 'quiz',
        duration: 300,
      });

      const lessonResults = [lesson1Res, lesson2Res, lesson3Res, quizLessonRes];
      const failedLessons = lessonResults.filter((r) => r.status > 201);

      if (failedLessons.length > 0) {
        return {
          passed: false,
          expected: 'All lessons created successfully',
          actual: `${failedLessons.length} lesson(s) failed: ${failedLessons.map((r) => `HTTP ${r.status}`).join(', ')}`,
        };
      }

      state.createdLessonIds = [
        lesson1Res.data.id,
        lesson2Res.data.id,
        lesson3Res.data.id,
        quizLessonRes.data.id,
      ];
      state.quizLessonId = quizLessonRes.data.id;

      // Verify hierarchy by fetching the course detail
      const courseRes = await client.get(`/courses/${courseId}`);
      if (courseRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200 on course detail retrieval',
          actual: `HTTP ${courseRes.status}`,
        };
      }

      const course = courseRes.data;
      const modules = course.modules ?? [];

      if (modules.length < 2) {
        return {
          passed: false,
          expected: 'Course has at least 2 modules',
          actual: `Course has ${modules.length} module(s)`,
        };
      }

      // Check lessons exist in modules
      const totalLessons = modules.reduce(
        (sum: number, m: any) => sum + (m.lessons?.length ?? 0),
        0,
      );

      if (totalLessons < 4) {
        return {
          passed: false,
          expected: 'At least 4 lessons across modules',
          actual: `Found ${totalLessons} lesson(s) across ${modules.length} modules`,
        };
      }

      return {
        passed: true,
        expected: 'Modules and lessons hierarchy retrievable',
        actual: `${modules.length} modules with ${totalLessons} total lessons`,
      };
    },
  );
}

// ─── Step 3: Assessment creation ─────────────────────────────────────────────

/**
 * Validates: Requirement 4.3
 * WHEN an instructor creates an assessment with questions and options on a lesson,
 * the assessment is linked to the lesson
 */
async function stepAssessmentCreation(
  _seed: SeedResult,
  state: Partial<WorkflowState>,
): Promise<StepResult> {
  return runStep(
    'Assessment creation with questions and options → verify linked to lesson',
    async () => {
      if (!state.quizLessonId || !state.instructorClient) {
        return {
          passed: false,
          expected: 'Quiz lesson created in previous step',
          actual: 'No quiz lesson ID available — prior step may have failed',
        };
      }

      const client = state.instructorClient;
      const lessonId = state.quizLessonId;

      // Create assessment on the quiz lesson
      const assessRes = await client.post(`/lessons/${lessonId}/assessment`, {
        title: 'Module 2 Final Quiz',
        description: 'Test your knowledge of advanced topics',
        passingScore: 70,
        maxAttempts: 3,
      });

      if (assessRes.status > 201) {
        return {
          passed: false,
          expected: 'HTTP 200/201 on assessment creation',
          actual: `HTTP ${assessRes.status}: ${JSON.stringify(assessRes.data)}`,
        };
      }

      state.assessmentId = assessRes.data.id;

      // Add questions with options
      state.questionIds = [];
      state.correctOptionIds = [];

      const questions = [
        {
          type: 'multiple_choice',
          text: 'What is the primary benefit of microservices?',
          explanation: 'Microservices enable independent deployment.',
          points: 1,
          order: 1,
          options: [
            { text: 'Independent deployment', isCorrect: true, order: 1 },
            { text: 'Simpler codebase', isCorrect: false, order: 2 },
            { text: 'Less network traffic', isCorrect: false, order: 3 },
          ],
        },
        {
          type: 'multiple_choice',
          text: 'Which pattern helps with service discovery?',
          explanation: 'Service registry is the standard pattern.',
          points: 1,
          order: 2,
          options: [
            { text: 'Service Registry', isCorrect: true, order: 1 },
            { text: 'Singleton', isCorrect: false, order: 2 },
            { text: 'Observer', isCorrect: false, order: 3 },
          ],
        },
        {
          type: 'true_false',
          text: 'Microservices always improve performance.',
          explanation: 'Not necessarily — they add network overhead.',
          points: 1,
          order: 3,
          options: [
            { text: 'True', isCorrect: false, order: 1 },
            { text: 'False', isCorrect: true, order: 2 },
          ],
        },
      ];

      for (const q of questions) {
        const qRes = await client.post(
          `/assessments/${state.assessmentId}/questions`,
          q,
        );
        if (qRes.status > 201) {
          return {
            passed: false,
            expected: 'HTTP 200/201 on question creation',
            actual: `HTTP ${qRes.status}: ${JSON.stringify(qRes.data)}`,
          };
        }
        state.questionIds!.push(qRes.data.id);
        // Find the correct option ID
        const correctOpt = (qRes.data.options ?? []).find(
          (o: any) => o.isCorrect === true,
        );
        if (correctOpt) {
          state.correctOptionIds!.push(correctOpt.id);
        }
      }

      // Verify assessment is linked to the lesson
      const getRes = await client.get(`/lessons/${lessonId}/assessment`);
      if (getRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200 on assessment retrieval by lesson',
          actual: `HTTP ${getRes.status}: ${JSON.stringify(getRes.data)}`,
        };
      }

      const assessment = getRes.data;
      if (assessment.id !== state.assessmentId) {
        return {
          passed: false,
          expected: `Assessment ID ${state.assessmentId} linked to lesson`,
          actual: `Got assessment ID ${assessment.id}`,
        };
      }

      const questionCount = assessment.questions?.length ?? 0;

      return {
        passed: true,
        expected: 'Assessment with questions linked to lesson',
        actual: `Assessment "${assessment.title}" with ${questionCount} questions linked to lesson ${lessonId}`,
      };
    },
  );
}

// ─── Step 4: Submit-review → publish transitions ─────────────────────────────

/**
 * Validates: Requirement 4.4
 * WHEN an instructor submits for review and then publishes,
 * the course status transitions to "published"
 */
async function stepPublishWorkflow(
  seed: SeedResult,
  state: Partial<WorkflowState>,
): Promise<StepResult> {
  return runStep(
    'Submit-review → publish transitions → verify "published" status',
    async () => {
      if (!state.createdCourseId || !state.instructorClient) {
        return {
          passed: false,
          expected: 'Course created in previous step',
          actual: 'No course ID available — prior step may have failed',
        };
      }

      const courseId = state.createdCourseId;

      // Submit for review (instructor can do this)
      const submitRes = await state.instructorClient.post(
        `/courses/${courseId}/submit-review`,
      );
      if (submitRes.status > 201) {
        return {
          passed: false,
          expected: 'HTTP 200/201 on submit-review',
          actual: `HTTP ${submitRes.status}: ${JSON.stringify(submitRes.data)}`,
        };
      }

      // Publish requires admin role
      const adminToken = await getToken(seed.users.admin);
      state.adminToken = adminToken;
      state.adminClient = apiClient(adminToken);

      const publishRes = await state.adminClient.post(
        `/courses/${courseId}/publish`,
      );
      if (publishRes.status > 201) {
        return {
          passed: false,
          expected: 'HTTP 200/201 on publish',
          actual: `HTTP ${publishRes.status}: ${JSON.stringify(publishRes.data)}`,
        };
      }

      // Verify the course is now published
      const courseRes = await state.adminClient.get(`/courses/${courseId}`);
      if (courseRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200 on course retrieval',
          actual: `HTTP ${courseRes.status}`,
        };
      }

      const status = courseRes.data.status;
      if (status !== 'published') {
        return {
          passed: false,
          expected: 'Course status is "published"',
          actual: `Course status is "${status}"`,
        };
      }

      return {
        passed: true,
        expected: 'Course transitions to "published" after submit-review → publish',
        actual: `Course status is "${status}" after workflow transitions`,
      };
    },
  );
}

// ─── Step 5: Learner enrollment ──────────────────────────────────────────────

/**
 * Validates: Requirement 4.5
 * WHEN a learner enrolls in a published course, progress is at zero
 */
async function stepLearnerEnrollment(
  seed: SeedResult,
  state: Partial<WorkflowState>,
): Promise<StepResult> {
  return runStep(
    'Learner enrollment → verify progress at zero',
    async () => {
      if (!state.createdCourseId) {
        return {
          passed: false,
          expected: 'Published course available',
          actual: 'No course ID available — prior step may have failed',
        };
      }

      const learnerToken = await getToken(seed.users.learner);
      state.learnerToken = learnerToken;
      state.learnerClient = apiClient(learnerToken);

      const courseId = state.createdCourseId;

      // Enroll the learner
      const enrollRes = await state.learnerClient.post(
        `/courses/${courseId}/enroll`,
      );
      if (enrollRes.status > 201) {
        return {
          passed: false,
          expected: 'HTTP 200/201 on enrollment',
          actual: `HTTP ${enrollRes.status}: ${JSON.stringify(enrollRes.data)}`,
        };
      }

      state.enrollmentId = enrollRes.data.id;

      // Verify progress is at zero
      const progressRes = await state.learnerClient.get(
        `/courses/${courseId}/progress`,
      );
      if (progressRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200 on progress retrieval',
          actual: `HTTP ${progressRes.status}: ${JSON.stringify(progressRes.data)}`,
        };
      }

      const progress = progressRes.data;
      const overallProgress =
        progress.overallProgress ?? progress.progress ?? progress.percentage ?? 0;

      if (overallProgress !== 0) {
        return {
          passed: false,
          expected: 'Initial progress is 0',
          actual: `Progress is ${overallProgress}`,
        };
      }

      return {
        passed: true,
        expected: 'Enrollment created with progress at zero',
        actual: `Enrollment ${state.enrollmentId} created, progress: ${overallProgress}`,
      };
    },
  );
}

// ─── Step 6: Lesson progress updates ─────────────────────────────────────────

/**
 * Validates: Requirement 4.6
 * WHEN a learner marks lessons as completed, progress percentage updates
 */
async function stepProgressUpdates(
  _seed: SeedResult,
  state: Partial<WorkflowState>,
): Promise<StepResult> {
  return runStep(
    'Lesson progress updates → verify enrollment progress percentage',
    async () => {
      if (!state.createdCourseId || !state.learnerClient || !state.createdLessonIds) {
        return {
          passed: false,
          expected: 'Course, learner client, and lessons available',
          actual: 'Missing prerequisites from prior steps',
        };
      }

      const client = state.learnerClient;
      const courseId = state.createdCourseId;
      const lessonIds = state.createdLessonIds;

      // Mark first two lessons as completed (2 out of 4 = 50%)
      for (const lessonId of lessonIds.slice(0, 2)) {
        const updateRes = await client.post(`/courses/${courseId}/progress`, {
          lessonId,
          state: 'completed',
          progress: 1,
        });
        if (updateRes.status > 201) {
          return {
            passed: false,
            expected: 'HTTP 200/201 on progress update',
            actual: `HTTP ${updateRes.status}: ${JSON.stringify(updateRes.data)}`,
          };
        }
      }

      // Check overall progress
      const progressRes = await client.get(`/courses/${courseId}/progress`);
      if (progressRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200 on progress retrieval',
          actual: `HTTP ${progressRes.status}`,
        };
      }

      const progress = progressRes.data;
      const overallProgress =
        progress.overallProgress ?? progress.progress ?? progress.percentage ?? 0;

      // Progress should be > 0 after completing some lessons
      if (overallProgress <= 0) {
        return {
          passed: false,
          expected: 'Progress > 0 after completing lessons',
          actual: `Progress is ${overallProgress}`,
        };
      }

      return {
        passed: true,
        expected: 'Progress percentage updates after lesson completion',
        actual: `Progress is ${overallProgress} after completing 2 of ${lessonIds.length} lessons`,
      };
    },
  );
}

// ─── Step 7: Assessment submission ───────────────────────────────────────────

/**
 * Validates: Requirement 4.7
 * WHEN a learner submits an assessment with correct answers, it is scored and passed
 */
async function stepAssessmentSubmission(
  _seed: SeedResult,
  state: Partial<WorkflowState>,
): Promise<StepResult> {
  return runStep(
    'Assessment submission with correct answers → verify scored and passed',
    async () => {
      if (
        !state.assessmentId ||
        !state.learnerClient ||
        !state.questionIds ||
        !state.correctOptionIds
      ) {
        return {
          passed: false,
          expected: 'Assessment and questions available from prior steps',
          actual: 'Missing prerequisites from prior steps',
        };
      }

      const client = state.learnerClient;

      // Start an attempt
      const startRes = await client.post(
        `/assessments/${state.assessmentId}/attempts`,
      );
      if (startRes.status > 201) {
        return {
          passed: false,
          expected: 'HTTP 200/201 on starting attempt',
          actual: `HTTP ${startRes.status}: ${JSON.stringify(startRes.data)}`,
        };
      }

      const attemptId = startRes.data.id;

      // Submit all correct answers
      const answers = state.questionIds.map((questionId, idx) => ({
        questionId,
        selectedOptionIds: [state.correctOptionIds![idx]],
      }));

      const submitRes = await client.post(`/attempts/${attemptId}/submit`, {
        answers,
      });
      if (submitRes.status > 201) {
        return {
          passed: false,
          expected: 'HTTP 200/201 on attempt submission',
          actual: `HTTP ${submitRes.status}: ${JSON.stringify(submitRes.data)}`,
        };
      }

      const result = submitRes.data;
      const score = result.score ?? result.scorePercentage ?? result.percentage;
      const passed = result.passed ?? result.isPassed ?? (score >= 70);

      if (!passed) {
        return {
          passed: false,
          expected: 'Assessment marked as passed with all correct answers',
          actual: `Score: ${score}, Passed: ${passed}`,
        };
      }

      return {
        passed: true,
        expected: 'Assessment scored and marked as passed',
        actual: `Score: ${score}%, Passed: ${passed}`,
      };
    },
  );
}

// ─── Step 8: Course completion with certificate ──────────────────────────────

/**
 * Validates: Requirement 4.8
 * WHEN a learner completes all lessons in a course with a certificate template,
 * a certificate is issued
 */
async function stepCertificateIssuance(
  _seed: SeedResult,
  state: Partial<WorkflowState>,
): Promise<StepResult> {
  return runStep(
    'Course completion with certificate template → verify certificate issued',
    async () => {
      if (
        !state.createdCourseId ||
        !state.learnerClient ||
        !state.instructorClient ||
        !state.createdLessonIds ||
        !state.enrollmentId
      ) {
        return {
          passed: false,
          expected: 'Course, learner, instructor, lessons, and enrollment available',
          actual: 'Missing prerequisites from prior steps',
        };
      }

      const courseId = state.createdCourseId;
      const learnerClient = state.learnerClient;

      // First, create a certificate template on this course (instructor)
      const templateRes = await state.instructorClient.post(
        `/courses/${courseId}/certificate-template`,
        {
          title: 'Certificate of Completion',
          description: 'Awarded for completing the LMS Workflow Test Course',
        },
      );
      if (templateRes.status > 201) {
        return {
          passed: false,
          expected: 'HTTP 200/201 on certificate template creation',
          actual: `HTTP ${templateRes.status}: ${JSON.stringify(templateRes.data)}`,
        };
      }

      state.certificateTemplateId = templateRes.data.id;

      // Complete remaining lessons (lessons 3 and 4)
      const remainingLessons = state.createdLessonIds.slice(2);
      for (const lessonId of remainingLessons) {
        await learnerClient.post(`/courses/${courseId}/progress`, {
          lessonId,
          state: 'completed',
          progress: 1,
        });
      }

      // Issue certificate via instructor/admin
      const issueRes = await state.instructorClient.post(
        `/certificate-templates/${state.certificateTemplateId}/issue`,
        { enrollmentId: state.enrollmentId },
      );

      if (issueRes.status > 201) {
        return {
          passed: false,
          expected: 'HTTP 200/201 on certificate issuance',
          actual: `HTTP ${issueRes.status}: ${JSON.stringify(issueRes.data)}`,
        };
      }

      const certificate = issueRes.data;
      const certNumber =
        certificate.certificateNumber ?? certificate.number ?? certificate.id;

      if (!certNumber) {
        return {
          passed: false,
          expected: 'Certificate has a unique number/ID',
          actual: `Certificate data: ${JSON.stringify(certificate)}`,
        };
      }

      // Verify learner can see their certificate
      const myCertsRes = await learnerClient.get('/my/certificates');
      if (myCertsRes.status !== 200) {
        return {
          passed: false,
          expected: 'HTTP 200 on my certificates listing',
          actual: `HTTP ${myCertsRes.status}`,
        };
      }

      const myCerts = Array.isArray(myCertsRes.data)
        ? myCertsRes.data
        : myCertsRes.data?.data ?? [];
      const found = myCerts.find((c: any) => c.id === certificate.id);

      if (!found) {
        return {
          passed: false,
          expected: 'Certificate visible in learner certificates list',
          actual: `Certificate ${certificate.id} not found in ${myCerts.length} certificates`,
        };
      }

      return {
        passed: true,
        expected: 'Certificate issued with unique number after course completion',
        actual: `Certificate issued: ${certNumber}`,
      };
    },
  );
}

// ─── Step 9: Enrollment rejection for non-published course ───────────────────

/**
 * Validates: Requirement 4.9
 * IF a learner attempts to enroll in a non-published course,
 * the API returns an appropriate error response
 */
async function stepEnrollmentRejection(
  seed: SeedResult,
  state: Partial<WorkflowState>,
): Promise<StepResult> {
  return runStep(
    'Enrollment rejection for non-published course → verify error response',
    async () => {
      if (!state.learnerClient) {
        // Get a fresh learner token if not available
        const learnerToken = await getToken(seed.users.learner);
        state.learnerToken = learnerToken;
        state.learnerClient = apiClient(learnerToken);
      }

      const client = state.learnerClient;

      // Use the draft course from seed data
      const draftCourseId = seed.courses.draftId;

      if (!draftCourseId) {
        return {
          passed: false,
          expected: 'Draft course ID available from seed data',
          actual: 'No draft course ID in seed result',
        };
      }

      // Attempt to enroll in the draft course
      const enrollRes = await client.post(
        `/courses/${draftCourseId}/enroll`,
      );

      // Should receive an error (400, 403, or 422)
      if (enrollRes.status >= 200 && enrollRes.status < 300) {
        return {
          passed: false,
          expected: 'Enrollment rejected with error status (4xx)',
          actual: `Enrollment succeeded with HTTP ${enrollRes.status} — non-published course guard not enforced`,
        };
      }

      if (enrollRes.status >= 400 && enrollRes.status < 500) {
        return {
          passed: true,
          expected: 'Enrollment rejected for non-published course',
          actual: `HTTP ${enrollRes.status}: ${JSON.stringify(enrollRes.data?.message || enrollRes.data)}`,
        };
      }

      // 5xx is a server error, not a proper rejection
      return {
        passed: false,
        expected: 'Proper error response (4xx) for non-published course enrollment',
        actual: `HTTP ${enrollRes.status}: ${JSON.stringify(enrollRes.data)}`,
      };
    },
  );
}

// ─── Workflow Entry Point ────────────────────────────────────────────────────

export async function runLmsWorkflow(
  seedResult: SeedResult,
): Promise<WorkflowResult> {
  const start = Date.now();
  const state: Partial<WorkflowState> = {};
  const steps: StepResult[] = [];

  // Execute steps sequentially — each builds on prior state
  steps.push(await stepCourseCreation(seedResult, state));
  steps.push(await stepModulesAndLessons(seedResult, state));
  steps.push(await stepAssessmentCreation(seedResult, state));
  steps.push(await stepPublishWorkflow(seedResult, state));
  steps.push(await stepLearnerEnrollment(seedResult, state));
  steps.push(await stepProgressUpdates(seedResult, state));
  steps.push(await stepAssessmentSubmission(seedResult, state));
  steps.push(await stepCertificateIssuance(seedResult, state));
  steps.push(await stepEnrollmentRejection(seedResult, state));

  const passed = steps.every((s) => s.passed);

  return {
    name: 'LMS Learning Path Workflow',
    steps,
    passed,
    duration: Date.now() - start,
  };
}
