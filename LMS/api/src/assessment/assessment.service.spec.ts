import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentService } from './assessment.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';
import { EventBus } from '../events/event-bus';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('AssessmentService', () => {
  let service: AssessmentService;
  let prisma: Record<string, any>;
  let progressService: Record<string, any>;
  let eventBus: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((cb: any) => cb(prisma)),
      lesson: { findFirst: jest.fn() },
      assessment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      question: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
      },
      questionOption: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      assessmentAttempt: {
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      attemptAnswer: { createMany: jest.fn() },
      user: { findFirst: jest.fn() },
      enrollment: { findUnique: jest.fn() },
    };

    progressService = {
      upsertProgress: jest.fn(),
    };

    eventBus = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProgressService, useValue: progressService },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    service = module.get<AssessmentService>(AssessmentService);
  });

  // ─── createAssessment ─────────────────────

  describe('createAssessment', () => {
    it('should reject if tenant is null', async () => {
      await expect(
        service.createAssessment({
          tenantId: null,
          lessonId: 'l1',
          body: { title: 'Quiz 1' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if lesson type is not quiz', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'l1',
        type: 'video',
        module: { course: { tenantId: 'tenant1', id: 'c1' } },
      });

      await expect(
        service.createAssessment({
          tenantId: 'tenant1',
          lessonId: 'l1',
          body: { title: 'Quiz 1' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if assessment already exists for lesson', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'l1',
        type: 'quiz',
        module: { course: { tenantId: 'tenant1', id: 'c1' } },
      });
      prisma.assessment.findUnique.mockResolvedValue({ id: 'a1' });

      await expect(
        service.createAssessment({
          tenantId: 'tenant1',
          lessonId: 'l1',
          body: { title: 'Quiz 1' },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create assessment with defaults', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'l1',
        type: 'quiz',
        module: { course: { tenantId: 'tenant1', id: 'c1' } },
      });
      prisma.assessment.findUnique.mockResolvedValue(null);
      prisma.assessment.create.mockResolvedValue({
        id: 'a1',
        lessonId: 'l1',
        title: 'Quiz 1',
        passingScore: 70,
        maxAttempts: null,
        questions: [],
      });

      const result = await service.createAssessment({
        tenantId: 'tenant1',
        lessonId: 'l1',
        body: { title: 'Quiz 1' },
      });

      expect(result.title).toBe('Quiz 1');
      expect(prisma.assessment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lessonId: 'l1',
            passingScore: 70,
          }),
        }),
      );
    });
  });

  // ─── createQuestion ───────────────────────

  describe('createQuestion', () => {
    const validAssessment = {
      id: 'a1',
      lesson: {
        module: { course: { tenantId: 'tenant1', id: 'c1' } },
      },
    };

    it('should reject invalid question type', async () => {
      prisma.assessment.findFirst.mockResolvedValue(validAssessment);

      await expect(
        service.createQuestion({
          tenantId: 'tenant1',
          assessmentId: 'a1',
          body: {
            type: 'essay',
            text: 'Q1',
            order: 1,
            options: [
              { text: 'A', isCorrect: true, order: 1 },
              { text: 'B', isCorrect: false, order: 2 },
            ],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject question with no correct options', async () => {
      prisma.assessment.findFirst.mockResolvedValue(validAssessment);

      await expect(
        service.createQuestion({
          tenantId: 'tenant1',
          assessmentId: 'a1',
          body: {
            type: 'multiple_choice',
            text: 'Q1',
            order: 1,
            options: [
              { text: 'A', isCorrect: false, order: 1 },
              { text: 'B', isCorrect: false, order: 2 },
            ],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject multiple_choice with multiple correct options', async () => {
      prisma.assessment.findFirst.mockResolvedValue(validAssessment);

      await expect(
        service.createQuestion({
          tenantId: 'tenant1',
          assessmentId: 'a1',
          body: {
            type: 'multiple_choice',
            text: 'Q1',
            order: 1,
            options: [
              { text: 'A', isCorrect: true, order: 1 },
              { text: 'B', isCorrect: true, order: 2 },
            ],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject true_false with != 2 options', async () => {
      prisma.assessment.findFirst.mockResolvedValue(validAssessment);

      await expect(
        service.createQuestion({
          tenantId: 'tenant1',
          assessmentId: 'a1',
          body: {
            type: 'true_false',
            text: 'Is the sky blue?',
            order: 1,
            options: [
              { text: 'True', isCorrect: true, order: 1 },
              { text: 'False', isCorrect: false, order: 2 },
              { text: 'Maybe', isCorrect: false, order: 3 },
            ],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create valid question with options', async () => {
      prisma.assessment.findFirst.mockResolvedValue(validAssessment);
      prisma.question.create.mockResolvedValue({
        id: 'q1',
        type: 'multiple_choice',
        text: 'What is 2+2?',
        options: [
          { id: 'o1', text: '4', isCorrect: true },
          { id: 'o2', text: '5', isCorrect: false },
        ],
      });

      const result = await service.createQuestion({
        tenantId: 'tenant1',
        assessmentId: 'a1',
        body: {
          type: 'multiple_choice',
          text: 'What is 2+2?',
          order: 1,
          options: [
            { text: '4', isCorrect: true, order: 1 },
            { text: '5', isCorrect: false, order: 2 },
          ],
        },
      });

      expect(result.text).toBe('What is 2+2?');
    });
  });

  // ─── startAttempt ─────────────────────────

  describe('startAttempt', () => {
    it('should reject when max attempts reached', async () => {
      prisma.assessment.findFirst.mockResolvedValue({
        id: 'a1',
        maxAttempts: 2,
        lesson: {
          module: {
            courseId: 'c1',
            course: { tenantId: 'tenant1', id: 'c1' },
          },
        },
      });
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'e1' });
      prisma.assessmentAttempt.count.mockResolvedValue(2);

      await expect(
        service.startAttempt({
          tenantId: 'tenant1',
          authUserId: 'auth-user-1',
          assessmentId: 'a1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create attempt when under max', async () => {
      prisma.assessment.findFirst.mockResolvedValue({
        id: 'a1',
        maxAttempts: 3,
        lesson: {
          module: {
            courseId: 'c1',
            course: { tenantId: 'tenant1', id: 'c1' },
          },
        },
      });
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'e1' });
      prisma.assessmentAttempt.count.mockResolvedValue(1);
      prisma.assessmentAttempt.create.mockResolvedValue({
        id: 'att1',
        attemptNumber: 2,
      });

      const result = await service.startAttempt({
        tenantId: 'tenant1',
        authUserId: 'auth-user-1',
        assessmentId: 'a1',
      });

      expect(result.attemptNumber).toBe(2);
    });

    it('runs count+create inside $transaction (H3)', async () => {
      const txSpy = jest.fn();
      prisma.$transaction = jest.fn((cb: any) => {
        txSpy();
        return cb(prisma);
      });
      prisma.assessment.findFirst.mockResolvedValue({
        id: 'a1',
        maxAttempts: null,
        lesson: {
          module: {
            courseId: 'c1',
            course: { tenantId: 'tenant1', id: 'c1' },
          },
        },
      });
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'e1' });
      prisma.assessmentAttempt.count.mockResolvedValue(0);
      prisma.assessmentAttempt.create.mockResolvedValue({
        id: 'att1',
        attemptNumber: 1,
      });

      await service.startAttempt({
        tenantId: 'tenant1',
        authUserId: 'auth-user-1',
        assessmentId: 'a1',
      });

      expect(txSpy).toHaveBeenCalledTimes(1);
      expect(prisma.assessmentAttempt.create).toHaveBeenCalled();
    });
  });

  // ─── submitAttempt ────────────────────────

  describe('submitAttempt', () => {
    const setupSubmit = (
      options: { score?: number; passed?: boolean } = {},
    ) => {
      prisma.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'att1',
        assessmentId: 'a1',
        enrollmentId: 'e1',
        submittedAt: null,
        startedAt: new Date(Date.now() - 60000),
        assessment: {
          passingScore: 70,
          maxAttempts: null,
          lessonId: 'l1',
          lesson: {
            module: {
              course: { tenantId: 'tenant1', id: 'c1', status: 'published' },
            },
          },
          questions: [
            {
              id: 'q1',
              points: 1,
              options: [
                { id: 'o1', isCorrect: true },
                { id: 'o2', isCorrect: false },
              ],
            },
            {
              id: 'q2',
              points: 1,
              options: [
                { id: 'o3', isCorrect: false },
                { id: 'o4', isCorrect: true },
              ],
            },
          ],
        },
        enrollment: { userId: 'u1' },
      });
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
      prisma.attemptAnswer.createMany.mockResolvedValue({ count: 2 });
      prisma.assessmentAttempt.update.mockResolvedValue({
        id: 'att1',
        score: options.score ?? 100,
        passed: options.passed ?? true,
        answers: [],
        assessment: { title: 'Quiz', passingScore: 70, lessonId: 'l1' },
      });
      prisma.assessmentAttempt.count.mockResolvedValue(1);
    };

    it('should reject questionId not belonging to this assessment', async () => {
      setupSubmit({ score: 100, passed: true });

      await expect(
        service.submitAttempt({
          tenantId: 'tenant1',
          authUserId: 'auth-user-1',
          attemptId: 'att1',
          body: {
            answers: [
              { questionId: 'q3', selectedOptionIds: ['o1'] },
            ],
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject submission for unpublished course', async () => {
      prisma.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'att1',
        assessmentId: 'a1',
        enrollmentId: 'e1',
        submittedAt: null,
        startedAt: new Date(Date.now() - 60000),
        assessment: {
          passingScore: 70,
          maxAttempts: null,
          lessonId: 'l1',
          lesson: {
            module: {
              course: { tenantId: 'tenant1', id: 'c1', status: 'draft' },
            },
          },
          questions: [],
        },
        enrollment: { userId: 'u1' },
      });
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });

      await expect(
        service.submitAttempt({
          tenantId: 'tenant1',
          authUserId: 'auth-user-1',
          attemptId: 'att1',
          body: { answers: [] },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject already submitted attempt', async () => {
      prisma.assessmentAttempt.findFirst.mockResolvedValue({
        id: 'att1',
        submittedAt: new Date(),
        assessment: {
          lesson: {
            module: { course: { tenantId: 'tenant1' } },
          },
        },
      });

      await expect(
        service.submitAttempt({
          tenantId: 'tenant1',
          authUserId: 'auth-user-1',
          attemptId: 'att1',
          body: { answers: [] },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should auto-grade a passing attempt and emit events', async () => {
      setupSubmit({ score: 100, passed: true });

      const result = await service.submitAttempt({
        tenantId: 'tenant1',
        authUserId: 'auth-user-1',
        attemptId: 'att1',
        body: {
          answers: [
            { questionId: 'q1', selectedOptionIds: ['o1'] },
            { questionId: 'q2', selectedOptionIds: ['o4'] },
          ],
        },
      });

      expect(result.passed).toBe(true);
      expect(eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'assessment.attempted' }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'assessment.passed' }),
      );
      expect(progressService.upsertProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ state: 'completed' }),
        }),
      );
    });

    it('should auto-grade a failing attempt and mark progress in_progress', async () => {
      setupSubmit({ score: 50, passed: false });

      // Override update mock for failed case
      prisma.assessmentAttempt.update.mockResolvedValue({
        id: 'att1',
        score: 50,
        passed: false,
        answers: [],
        assessment: { title: 'Quiz', passingScore: 70, lessonId: 'l1' },
      });

      const result = await service.submitAttempt({
        tenantId: 'tenant1',
        authUserId: 'auth-user-1',
        attemptId: 'att1',
        body: {
          answers: [
            { questionId: 'q1', selectedOptionIds: ['o1'] },
            { questionId: 'q2', selectedOptionIds: ['o3'] },
          ],
        },
      });

      expect(result.passed).toBe(false);
      expect(eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'assessment.failed' }),
      );
      expect(progressService.upsertProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ state: 'in_progress' }),
        }),
      );
    });
  });
});
