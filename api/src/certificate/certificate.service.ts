import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EventBus } from '../events/event-bus';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import PDFDocument from 'pdfkit';
import { randomBytes } from 'crypto';

function shortId(): string {
  return randomBytes(4).toString('hex');
}

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly eventBus: EventBus,
  ) {}

  // ─── Template CRUD ──────────────────────────

  async createTemplate(input: {
    tenantId: string | null;
    courseId: string;
    body: CreateTemplateDto;
  }) {
    const { tenantId, courseId, body } = input;
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tenantId },
    });
    if (!course) throw new NotFoundException('Course not found in this tenant');

    const existing = await this.prisma.certificateTemplate.findUnique({
      where: { courseId },
    });
    if (existing) {
      throw new ConflictException(
        'Certificate template already exists for this course',
      );
    }

    return this.prisma.certificateTemplate.create({
      data: {
        tenantId,
        courseId,
        title: body.title.trim(),
        description: body.description?.trim(),
      },
    });
  }

  async getTemplate(tenantId: string | null, courseId: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const template = await this.prisma.certificateTemplate.findUnique({
      where: { courseId },
    });

    if (!template || template.tenantId !== tenantId) {
      throw new NotFoundException('Certificate template not found');
    }

    return template;
  }

  async updateTemplate(input: {
    tenantId: string | null;
    templateId: string;
    body: UpdateTemplateDto;
  }) {
    const { tenantId, templateId, body } = input;
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const template = await this.prisma.certificateTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!template) throw new NotFoundException('Template not found');

    return this.prisma.certificateTemplate.update({
      where: { id: templateId },
      data: {
        title: body.title?.trim(),
        description:
          body.description === undefined
            ? undefined
            : body.description === null
              ? null
              : body.description.trim(),
        isActive: body.isActive,
      },
    });
  }

  // ─── Certificate Issuance ───────────────────

  async issueCertificate(input: {
    tenantId: string | null;
    templateId: string;
    enrollmentId: string;
  }) {
    const { tenantId, templateId, enrollmentId } = input;
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const template = await this.prisma.certificateTemplate.findFirst({
      where: { id: templateId, tenantId, isActive: true },
      include: { course: true },
    });
    if (!template) throw new NotFoundException('Active template not found');

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { user: true },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (!enrollment.completedAt) {
      throw new BadRequestException('Course is not completed yet');
    }

    // Check for duplicate
    const existing = await this.prisma.issuedCertificate.findUnique({
      where: {
        templateId_enrollmentId: { templateId, enrollmentId },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Certificate already issued for this enrollment',
      );
    }

    // Check all quiz-type assessments passed
    await this.verifyAssessmentsPassed(template.courseId, enrollmentId);

    // Build score summary
    const scoreSummary = await this.buildScoreSummary(
      template.courseId,
      enrollmentId,
    );

    // Generate cert number
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    const certNumber = `CERT-${(tenant?.subdomain ?? 'lms').toUpperCase()}-${shortId()}`;

    const learnerName =
      [enrollment.user.firstName, enrollment.user.lastName]
        .filter(Boolean)
        .join(' ') || enrollment.user.email;

    // Generate PDF
    const pdfBuffer = await this.generatePdf({
      learnerName,
      courseTitle: template.course.title,
      completionDate: enrollment.completedAt,
      certificateNumber: certNumber,
      scoreSummary,
      tenantName: tenant?.name ?? 'LMS',
    });

    // Upload to MinIO
    const objectKey = `certificates/${tenantId}/${shortId()}.pdf`;
    await this.storage.uploadBuffer({
      bucket: 'lms-certificates',
      objectKey,
      body: pdfBuffer,
      contentType: 'application/pdf',
    });

    // Create record
    const cert = await this.prisma.issuedCertificate.create({
      data: {
        templateId,
        enrollmentId,
        userId: enrollment.userId,
        tenantId,
        certificateNumber: certNumber,
        learnerName,
        courseTitle: template.course.title,
        completionDate: enrollment.completedAt,
        scoreSummary,
        pdfObjectKey: objectKey,
      },
    });

    // Emit event
    this.eventBus.emit({
      type: 'certificate.issued',
      tenantId,
      timestamp: new Date(),
      actorId: enrollment.userId,
      entityId: cert.id,
      entityType: 'certificate',
      payload: {
        certificateId: cert.id,
        certificateNumber: certNumber,
        userId: enrollment.userId,
        courseId: template.courseId,
        enrollmentId,
      },
    });

    return cert;
  }

  // ─── Learner endpoints ──────────────────────

  async listMyCertificates(tenantId: string | null, authUserId: string) {
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const user = await this.prisma.user.findFirst({
      where: { keycloakId: authUserId, tenantId, isActive: true },
    });
    if (!user) throw new ForbiddenException('User not found');

    return this.prisma.issuedCertificate.findMany({
      where: { userId: user.id, tenantId },
      orderBy: { issuedAt: 'desc' },
      include: {
        template: {
          select: { courseId: true },
        },
      },
    });
  }

  async getCertificatePdfUrl(input: {
    tenantId: string | null;
    authUserId: string;
    certificateId: string;
  }) {
    const { tenantId, authUserId, certificateId } = input;
    if (!tenantId) throw new ForbiddenException('Tenant could not be resolved');

    const cert = await this.prisma.issuedCertificate.findFirst({
      where: { id: certificateId, tenantId },
    });
    if (!cert) throw new NotFoundException('Certificate not found');

    // Allow the owner or admins/instructors
    const user = await this.prisma.user.findFirst({
      where: { keycloakId: authUserId, tenantId, isActive: true },
    });
    if (!user) throw new ForbiddenException('User not found');

    const isOwner = cert.userId === user.id;
    const isAdmin = user.roles.some((r: string) =>
      ['admin', 'instructor'].includes(r),
    );
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Access denied');
    }

    if (!cert.pdfObjectKey) {
      throw new NotFoundException('PDF not available');
    }

    const url = await this.storage.getPresignedGetUrl({
      objectKey: cert.pdfObjectKey,
      bucket: 'lms-certificates',
      expiresInSeconds: 300,
    });

    return { url, certificateNumber: cert.certificateNumber };
  }

  // ─── Auto-issuance listener ─────────────────

  @OnEvent('course.completed')
  async handleCourseCompleted(event: {
    type: string;
    tenantId: string;
    payload: {
      enrollmentId: string;
      userId: string;
      courseId: string;
    };
  }) {
    try {
      const template = await this.prisma.certificateTemplate.findUnique({
        where: { courseId: event.payload.courseId },
      });

      if (!template || !template.isActive) return;

      // Check not already issued
      const existing = await this.prisma.issuedCertificate.findUnique({
        where: {
          templateId_enrollmentId: {
            templateId: template.id,
            enrollmentId: event.payload.enrollmentId,
          },
        },
      });
      if (existing) return;

      await this.issueCertificate({
        tenantId: event.tenantId,
        templateId: template.id,
        enrollmentId: event.payload.enrollmentId,
      });

      this.logger.log(
        `Auto-issued certificate for enrollment ${event.payload.enrollmentId}`,
      );
    } catch (err) {
      this.logger.warn(
        `Auto-issuance failed for enrollment ${event.payload.enrollmentId}: ${(err as Error).message}`,
      );
    }
  }

  // ─── Private helpers ────────────────────────

  private async verifyAssessmentsPassed(
    courseId: string,
    enrollmentId: string,
  ) {
    // Find all quiz lessons in this course
    const quizLessons = await this.prisma.lesson.findMany({
      where: {
        type: 'quiz',
        module: { courseId },
      },
      include: {
        assessment: { select: { id: true } },
      },
    });

    for (const lesson of quizLessons) {
      if (!lesson.assessment) continue;

      const passedAttempt = await this.prisma.assessmentAttempt.findFirst({
        where: {
          assessmentId: lesson.assessment.id,
          enrollmentId,
          passed: true,
        },
      });

      if (!passedAttempt) {
        throw new BadRequestException(
          `Assessment "${lesson.title}" has not been passed yet`,
        );
      }
    }
  }

  private async buildScoreSummary(
    courseId: string,
    enrollmentId: string,
  ): Promise<string | null> {
    const quizLessons = await this.prisma.lesson.findMany({
      where: {
        type: 'quiz',
        module: { courseId },
      },
      include: {
        assessment: { select: { id: true, title: true } },
      },
    });

    if (quizLessons.length === 0) return null;

    const parts: string[] = [];
    for (const lesson of quizLessons) {
      if (!lesson.assessment) continue;

      const bestAttempt = await this.prisma.assessmentAttempt.findFirst({
        where: {
          assessmentId: lesson.assessment.id,
          enrollmentId,
          passed: true,
        },
        orderBy: { score: 'desc' },
      });

      if (bestAttempt) {
        parts.push(`${lesson.assessment.title}: ${bestAttempt.score}%`);
      }
    }

    return parts.length > 0 ? parts.join(', ') : null;
  }

  private async generatePdf(input: {
    learnerName: string;
    courseTitle: string;
    completionDate: Date;
    certificateNumber: string;
    scoreSummary: string | null;
    tenantName: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 60,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const pageH = doc.page.height;

      // Border
      doc
        .rect(30, 30, pageW - 60, pageH - 60)
        .lineWidth(2)
        .stroke('#2563eb');

      doc
        .rect(36, 36, pageW - 72, pageH - 72)
        .lineWidth(0.5)
        .stroke('#93c5fd');

      // Header
      doc
        .fontSize(14)
        .fillColor('#64748b')
        .text(input.tenantName.toUpperCase(), 0, 60, {
          align: 'center',
          width: pageW,
        });

      doc
        .fontSize(36)
        .fillColor('#1e293b')
        .text('Certificate of Completion', 0, 90, {
          align: 'center',
          width: pageW,
        });

      // Divider
      const divY = 140;
      doc
        .moveTo(pageW / 2 - 120, divY)
        .lineTo(pageW / 2 + 120, divY)
        .lineWidth(1)
        .stroke('#2563eb');

      // Body
      doc
        .fontSize(14)
        .fillColor('#64748b')
        .text('This is to certify that', 0, 165, {
          align: 'center',
          width: pageW,
        });

      doc.fontSize(28).fillColor('#1e40af').text(input.learnerName, 0, 195, {
        align: 'center',
        width: pageW,
      });

      doc
        .fontSize(14)
        .fillColor('#64748b')
        .text('has successfully completed the course', 0, 240, {
          align: 'center',
          width: pageW,
        });

      doc
        .fontSize(22)
        .fillColor('#1e293b')
        .text(input.courseTitle, 60, 270, {
          align: 'center',
          width: pageW - 120,
        });

      // Score summary
      let yPos = 310;
      if (input.scoreSummary) {
        doc
          .fontSize(11)
          .fillColor('#64748b')
          .text(`Assessment Results: ${input.scoreSummary}`, 0, yPos, {
            align: 'center',
            width: pageW,
          });
        yPos += 30;
      }

      // Date
      const dateStr = input.completionDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      doc
        .fontSize(12)
        .fillColor('#64748b')
        .text(`Completed on ${dateStr}`, 0, yPos, {
          align: 'center',
          width: pageW,
        });

      // Certificate number
      doc
        .fontSize(9)
        .fillColor('#94a3b8')
        .text(`Certificate No: ${input.certificateNumber}`, 0, pageH - 70, {
          align: 'center',
          width: pageW,
        });

      doc.end();
    });
  }
}
