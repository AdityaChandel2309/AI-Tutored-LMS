import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';
import { EventBus } from '../events/event-bus';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';

const VALID_QUESTION_TYPES = ['multiple_choice', 'multi_select', 'true_false'];

@Injectable()
export class AssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: ProgressService,
    private readonly eventBus: EventBus,
  ) {}

  // ─── Assessment CRUD ──────────────────────────

  async createAssessment(input: {
    tenantId: string | null;
    lessonId: string;
    body: CreateAssessmentDto;
  }) {
    const { tenantId, lessonId, body } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const lesson = await this.resolveLesson(tenantId, lessonId);

    if (lesson.type !== 'quiz') {
      throw new BadRequestException(
        'Assessments can only be created for lessons with type "quiz"',
      );
    }

    const existing = await this.prisma.assessment.findUnique({
      where: { lessonId },
    });

    if (existing) {
      throw new ConflictException(
        'An assessment already exists for this lesson',
      );
    }

    return this.prisma.assessment.create({
      data: {
        lessonId,
        title: body.title.trim(),
        description: body.description?.trim() ?? null,
        passingScore: body.passingScore ?? 70,
        maxAttempts: body.maxAttempts ?? null,
        timeLimitSec: body.timeLimitSec ?? null,
        isRandomized: body.isRandomized ?? false,
      },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    });
  }

  async getAssessment(input: {
    tenantId: string | null;
    lessonId: string;
    isInstructor: boolean;
  }) {
    const { tenantId, lessonId, isInstructor } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    await this.resolveLesson(tenantId, lessonId);

    const assessment = await this.prisma.assessment.findUnique({
      where: { lessonId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    });

    if (!assessment) {
      throw new NotFoundException('No assessment found for this lesson');
    }

    if (!isInstructor) {
      return {
        ...assessment,
        questions: assessment.questions.map((q) => ({
          ...q,
          explanation: null,
          options: q.options.map((o) => ({
            id: o.id,
            questionId: o.questionId,
            text: o.text,
            order: o.order,
          })),
        })),
      };
    }

    return assessment;
  }

  async updateAssessment(input: {
    tenantId: string | null;
    assessmentId: string;
    body: UpdateAssessmentDto;
  }) {
    const { tenantId, assessmentId, body } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const assessment = await this.resolveAssessment(tenantId, assessmentId);

    return this.prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        title: body.title?.trim(),
        description:
          body.description === undefined
            ? undefined
            : body.description === null
              ? null
              : body.description.trim(),
        passingScore: body.passingScore,
        maxAttempts: body.maxAttempts,
        timeLimitSec: body.timeLimitSec,
        isRandomized: body.isRandomized,
      },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    });
  }

  async deleteAssessment(tenantId: string | null, assessmentId: string) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const assessment = await this.resolveAssessment(tenantId, assessmentId);

    await this.prisma.assessment.delete({ where: { id: assessment.id } });

    return { id: assessmentId, deleted: true };
  }

  // ─── Question CRUD ────────────────────────────

  async createQuestion(input: {
    tenantId: string | null;
    assessmentId: string;
    body: CreateQuestionDto;
  }) {
    const { tenantId, assessmentId, body } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    await this.resolveAssessment(tenantId, assessmentId);

    if (!VALID_QUESTION_TYPES.includes(body.type)) {
      throw new BadRequestException(
        `Invalid question type "${body.type}". Must be one of: ${VALID_QUESTION_TYPES.join(', ')}`,
      );
    }

    if (!body.options || body.options.length < 2) {
      throw new BadRequestException('A question must have at least 2 options');
    }

    const hasCorrect = body.options.some((o) => o.isCorrect);
    if (!hasCorrect) {
      throw new BadRequestException(
        'At least one option must be marked as correct',
      );
    }

    if (body.type === 'true_false' && body.options.length !== 2) {
      throw new BadRequestException(
        'True/false questions must have exactly 2 options',
      );
    }

    if (body.type === 'multiple_choice') {
      const correctCount = body.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new BadRequestException(
          'Multiple choice questions must have exactly 1 correct option',
        );
      }
    }

    return this.prisma.question.create({
      data: {
        assessmentId,
        type: body.type,
        text: body.text.trim(),
        explanation: body.explanation?.trim() ?? null,
        points: body.points ?? 1,
        order: body.order,
        options: {
          create: body.options.map((o) => ({
            text: o.text.trim(),
            isCorrect: o.isCorrect,
            order: o.order,
          })),
        },
      },
      include: {
        options: { orderBy: { order: 'asc' } },
      },
    });
  }

  async updateQuestion(input: {
    tenantId: string | null;
    questionId: string;
    body: UpdateQuestionDto;
  }) {
    const { tenantId, questionId, body } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const question = await this.resolveQuestion(tenantId, questionId);

    if (body.type && !VALID_QUESTION_TYPES.includes(body.type)) {
      throw new BadRequestException(
        `Invalid question type "${body.type}". Must be one of: ${VALID_QUESTION_TYPES.join(', ')}`,
      );
    }

    // If options are provided, replace them all (delete + create)
    if (body.options) {
      if (body.options.length < 2) {
        throw new BadRequestException(
          'A question must have at least 2 options',
        );
      }

      const hasCorrect = body.options.some((o) => o.isCorrect);
      if (!hasCorrect) {
        throw new BadRequestException(
          'At least one option must be marked as correct',
        );
      }

      await this.prisma.questionOption.deleteMany({
        where: { questionId },
      });

      await this.prisma.questionOption.createMany({
        data: body.options.map((o) => ({
          questionId,
          text: o.text.trim(),
          isCorrect: o.isCorrect,
          order: o.order,
        })),
      });
    }

    return this.prisma.question.update({
      where: { id: question.id },
      data: {
        type: body.type?.trim(),
        text: body.text?.trim(),
        explanation:
          body.explanation === undefined
            ? undefined
            : body.explanation === null
              ? null
              : body.explanation.trim(),
        points: body.points,
        order: body.order,
        version: { increment: 1 },
      },
      include: {
        options: { orderBy: { order: 'asc' } },
      },
    });
  }

  async deleteQuestion(tenantId: string | null, questionId: string) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const question = await this.resolveQuestion(tenantId, questionId);

    await this.prisma.question.delete({ where: { id: question.id } });

    return { id: questionId, deleted: true };
  }

  // ─── Attempts ─────────────────────────────────

  async startAttempt(input: {
    tenantId: string | null;
    authUserId: string;
    assessmentId: string;
  }) {
    const { tenantId, authUserId, assessmentId } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const assessment = await this.resolveAssessment(tenantId, assessmentId);
    const enrollment = await this.resolveEnrollmentForAssessment(
      tenantId,
      authUserId,
      assessment.lesson.module.courseId,
    );

    return this.prisma.$transaction(async (tx) => {
      const existingAttempts = await tx.assessmentAttempt.count({
        where: {
          assessmentId,
          enrollmentId: enrollment.id,
        },
      });

      if (
        assessment.maxAttempts !== null &&
        existingAttempts >= assessment.maxAttempts
      ) {
        throw new BadRequestException(
          `Maximum attempts (${assessment.maxAttempts}) reached for this assessment`,
        );
      }

      return tx.assessmentAttempt.create({
        data: {
          assessmentId,
          enrollmentId: enrollment.id,
          attemptNumber: existingAttempts + 1,
        },
        include: {
          assessment: {
            select: {
              title: true,
              passingScore: true,
              timeLimitSec: true,
              questions: {
                orderBy: { order: 'asc' },
                include: {
                  options: {
                    orderBy: { order: 'asc' },
                    select: {
                      id: true,
                      text: true,
                      order: true,
                      questionId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    });
  }

  async submitAttempt(input: {
    tenantId: string | null;
    authUserId: string;
    attemptId: string;
    body: SubmitAttemptDto;
  }) {
    const { tenantId, authUserId, attemptId, body } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: { id: attemptId },
      include: {
        assessment: {
          include: {
            lesson: {
              include: {
                module: {
                  include: {
                    course: {
                      select: { tenantId: true, id: true, status: true },
                    },
                  },
                },
              },
            },
            questions: {
              include: {
                options: true,
              },
            },
          },
        },
        enrollment: true,
      },
    });

    if (
      !attempt ||
      attempt.assessment.lesson.module.course.tenantId !== tenantId
    ) {
      throw new NotFoundException('Attempt not found in current tenant');
    }

    if (attempt.submittedAt) {
      throw new BadRequestException('This attempt has already been submitted');
    }

    // Reject submission against unpublished course
    if (attempt.assessment.lesson.module.course.status !== 'published') {
      throw new BadRequestException(
        'Cannot submit assessment for an unpublished course',
      );
    }

    // Verify this is the user's own attempt
    const user = await this.prisma.user.findFirst({
      where: { keycloakId: authUserId, tenantId, isActive: true },
    });

    if (!user || attempt.enrollment.userId !== user.id) {
      throw new ForbiddenException('This is not your attempt');
    }

    // Grade each answer
    const questions = attempt.assessment.questions;
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    let totalPoints = 0;
    let earnedPoints = 0;

    // Validate all questionIds belong to this assessment
    for (const answer of body.answers) {
      if (!questionMap.has(answer.questionId)) {
        throw new BadRequestException(
          `Question ${answer.questionId} does not belong to this assessment`,
        );
      }
    }

    const answerData = body.answers.map((answer) => {
      const question = questionMap.get(answer.questionId)!;

      const correctOptionIds = question.options
        .filter((o) => o.isCorrect)
        .map((o) => o.id)
        .sort();

      const selectedSorted = [...answer.selectedOptionIds].sort();

      const isCorrect =
        correctOptionIds.length === selectedSorted.length &&
        correctOptionIds.every((id, i) => id === selectedSorted[i]);

      totalPoints += question.points;
      if (isCorrect) {
        earnedPoints += question.points;
      }

      return {
        attemptId,
        questionId: answer.questionId,
        selectedOptionIds: answer.selectedOptionIds,
        isCorrect,
      };
    });

    // Calculate score + timing
    const score =
      totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = score >= attempt.assessment.passingScore;
    const submittedAt = new Date();
    const durationSec = Math.round(
      (submittedAt.getTime() - attempt.startedAt.getTime()) / 1000,
    );

    // ─── Atomic transaction: answers + attempt update + progress ───
    const updatedAttempt = await this.prisma.$transaction(async (tx) => {
      // 1. Create answers
      await tx.attemptAnswer.createMany({ data: answerData });

      // 2. Update attempt with score, timing
      const result = await tx.assessmentAttempt.update({
        where: { id: attemptId },
        data: {
          score,
          passed,
          submittedAt,
          durationSec,
        },
        include: {
          answers: {
            include: {
              question: {
                include: {
                  options: { orderBy: { order: 'asc' } },
                },
              },
            },
          },
          assessment: {
            select: { title: true, passingScore: true, lessonId: true },
          },
        },
      });

      return result;
    });

    // ─── Post-transaction: events + progress (idempotent) ───
    const courseId = attempt.assessment.lesson.module.course.id;

    this.eventBus.emit({
      type: 'assessment.attempted',
      tenantId,
      timestamp: new Date(),
      actorId: user.id,
      entityId: attempt.assessmentId,
      entityType: 'assessment',
      payload: {
        attemptId,
        assessmentId: attempt.assessmentId,
        enrollmentId: attempt.enrollmentId,
        userId: user.id,
        score,
        passed,
      },
    });

    if (passed) {
      this.eventBus.emit({
        type: 'assessment.passed',
        tenantId,
        timestamp: new Date(),
        actorId: user.id,
        entityId: attempt.assessmentId,
        entityType: 'assessment',
        payload: {
          attemptId,
          assessmentId: attempt.assessmentId,
          lessonId: attempt.assessment.lessonId,
          enrollmentId: attempt.enrollmentId,
          userId: user.id,
          score,
        },
      });

      // Auto-complete lesson progress
      await this.progressService.upsertProgress({
        tenantId,
        authUserId,
        courseId,
        body: {
          lessonId: attempt.assessment.lessonId,
          state: 'completed',
          progress: 1,
        },
      });
    } else {
      const totalAttempts = await this.prisma.assessmentAttempt.count({
        where: {
          assessmentId: attempt.assessmentId,
          enrollmentId: attempt.enrollmentId,
        },
      });

      const attemptsRemaining =
        attempt.assessment.maxAttempts !== null
          ? Math.max(0, attempt.assessment.maxAttempts - totalAttempts)
          : null;

      this.eventBus.emit({
        type: 'assessment.failed',
        tenantId,
        timestamp: new Date(),
        actorId: user.id,
        entityId: attempt.assessmentId,
        entityType: 'assessment',
        payload: {
          attemptId,
          assessmentId: attempt.assessmentId,
          enrollmentId: attempt.enrollmentId,
          userId: user.id,
          score,
          attemptsRemaining,
        },
      });

      // Mark lesson as in_progress (not completed)
      await this.progressService.upsertProgress({
        tenantId,
        authUserId,
        courseId,
        body: {
          lessonId: attempt.assessment.lessonId,
          state: 'in_progress',
          progress: score / 100,
        },
      });
    }

    return updatedAttempt;
  }

  async getAttempt(input: {
    tenantId: string | null;
    authUserId: string;
    attemptId: string;
    roles: string[];
  }) {
    const { tenantId, attemptId, authUserId, roles } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: { id: attemptId },
      include: {
        answers: {
          include: {
            question: {
              include: {
                options: { orderBy: { order: 'asc' } },
              },
            },
          },
        },
        assessment: {
          select: {
            title: true,
            passingScore: true,
            lessonId: true,
            lesson: {
              include: {
                module: {
                  include: {
                    course: { select: { tenantId: true } },
                  },
                },
              },
            },
          },
        },
        enrollment: true,
      },
    });

    if (
      !attempt ||
      attempt.assessment.lesson.module.course.tenantId !== tenantId
    ) {
      throw new NotFoundException('Attempt not found in current tenant');
    }

    const isInstructor =
      roles.includes('admin') || roles.includes('instructor');

    if (!isInstructor) {
      // Verify ownership
      const user = await this.prisma.user.findFirst({
        where: { keycloakId: authUserId, tenantId, isActive: true },
      });
      if (!user || attempt.enrollment.userId !== user.id) {
        throw new ForbiddenException('You can only view your own attempts');
      }
    }

    return attempt;
  }

  async listAttempts(input: {
    tenantId: string | null;
    authUserId: string;
    assessmentId: string;
  }) {
    const { tenantId, authUserId, assessmentId } = input;

    if (!tenantId) {
      throw new ForbiddenException('Tenant could not be resolved');
    }

    await this.resolveAssessment(tenantId, assessmentId);

    const user = await this.prisma.user.findFirst({
      where: { keycloakId: authUserId, tenantId, isActive: true },
    });

    if (!user) {
      throw new ForbiddenException(
        'User does not belong to the resolved tenant',
      );
    }

    return this.prisma.assessmentAttempt.findMany({
      where: {
        assessmentId,
        enrollment: { userId: user.id },
      },
      orderBy: { attemptNumber: 'asc' },
      select: {
        id: true,
        attemptNumber: true,
        score: true,
        passed: true,
        startedAt: true,
        submittedAt: true,
      },
    });
  }

  // ─── Private Helpers ──────────────────────────

  private async resolveLesson(tenantId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: { select: { tenantId: true, id: true } },
          },
        },
      },
    });

    if (!lesson || lesson.module.course.tenantId !== tenantId) {
      throw new NotFoundException('Lesson not found in current tenant');
    }

    return lesson;
  }

  private async resolveAssessment(tenantId: string, assessmentId: string) {
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: { select: { tenantId: true, id: true } },
              },
            },
          },
        },
      },
    });

    if (!assessment || assessment.lesson.module.course.tenantId !== tenantId) {
      throw new NotFoundException('Assessment not found in current tenant');
    }

    return assessment;
  }

  private async resolveQuestion(tenantId: string, questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId },
      include: {
        assessment: {
          include: {
            lesson: {
              include: {
                module: {
                  include: {
                    course: { select: { tenantId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (
      !question ||
      question.assessment.lesson.module.course.tenantId !== tenantId
    ) {
      throw new NotFoundException('Question not found in current tenant');
    }

    return question;
  }

  private async resolveEnrollmentForAssessment(
    tenantId: string,
    authUserId: string,
    courseId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { keycloakId: authUserId, tenantId, isActive: true },
    });

    if (!user) {
      throw new ForbiddenException(
        'User does not belong to the resolved tenant',
      );
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('User is not enrolled in this course');
    }

    return enrollment;
  }
}
