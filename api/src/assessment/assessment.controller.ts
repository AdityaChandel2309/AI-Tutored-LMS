import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { AssessmentService } from './assessment.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';

@ApiTags('assessments')
@ApiBearerAuth()
@Controller()
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  // ─── Assessment CRUD ──────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post('lessons/:id/assessment')
  @ApiOperation({ summary: 'Create an assessment for a quiz lesson' })
  @ApiBody({ type: CreateAssessmentDto })
  createAssessment(
    @Request() req: TenantAwareRequest,
    @Param('id') lessonId: string,
    @Body() body: CreateAssessmentDto,
  ) {
    return this.assessmentService.createAssessment({
      tenantId: req.tenant?.id ?? null,
      lessonId,
      body,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('lessons/:id/assessment')
  @ApiOperation({
    summary: 'Get assessment for a lesson (learner view strips answers)',
  })
  getAssessment(
    @Request() req: TenantAwareRequest,
    @Param('id') lessonId: string,
  ) {
    const roles: string[] = (req.user as any)?.roles ?? [];
    const isInstructor =
      roles.includes('admin') || roles.includes('instructor');
    return this.assessmentService.getAssessment({
      tenantId: req.tenant?.id ?? null,
      lessonId,
      isInstructor,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Patch('assessments/:id')
  @ApiOperation({ summary: 'Update assessment metadata' })
  @ApiBody({ type: UpdateAssessmentDto })
  updateAssessment(
    @Request() req: TenantAwareRequest,
    @Param('id') assessmentId: string,
    @Body() body: UpdateAssessmentDto,
  ) {
    return this.assessmentService.updateAssessment({
      tenantId: req.tenant?.id ?? null,
      assessmentId,
      body,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Delete('assessments/:id')
  @ApiOperation({ summary: 'Delete an assessment and all its questions' })
  deleteAssessment(
    @Request() req: TenantAwareRequest,
    @Param('id') assessmentId: string,
  ) {
    return this.assessmentService.deleteAssessment(
      req.tenant?.id ?? null,
      assessmentId,
    );
  }

  // ─── Question CRUD ────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post('assessments/:id/questions')
  @ApiOperation({ summary: 'Add a question to an assessment' })
  @ApiBody({ type: CreateQuestionDto })
  createQuestion(
    @Request() req: TenantAwareRequest,
    @Param('id') assessmentId: string,
    @Body() body: CreateQuestionDto,
  ) {
    return this.assessmentService.createQuestion({
      tenantId: req.tenant?.id ?? null,
      assessmentId,
      body,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Patch('questions/:id')
  @ApiOperation({ summary: 'Update a question and optionally replace options' })
  @ApiBody({ type: UpdateQuestionDto })
  updateQuestion(
    @Request() req: TenantAwareRequest,
    @Param('id') questionId: string,
    @Body() body: UpdateQuestionDto,
  ) {
    return this.assessmentService.updateQuestion({
      tenantId: req.tenant?.id ?? null,
      questionId,
      body,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Delete('questions/:id')
  @ApiOperation({ summary: 'Delete a question' })
  deleteQuestion(
    @Request() req: TenantAwareRequest,
    @Param('id') questionId: string,
  ) {
    return this.assessmentService.deleteQuestion(
      req.tenant?.id ?? null,
      questionId,
    );
  }

  // ─── Attempts ─────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('assessments/:id/attempts')
  @ApiOperation({ summary: 'Start a new quiz attempt' })
  startAttempt(
    @Request() req: TenantAwareRequest,
    @Param('id') assessmentId: string,
  ) {
    return this.assessmentService.startAttempt({
      tenantId: req.tenant?.id ?? null,
      authUserId: (req.user as any).sub ?? (req.user as any).userId,
      assessmentId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('attempts/:id/submit')
  @ApiOperation({ summary: 'Submit answers and auto-grade the attempt' })
  @ApiBody({ type: SubmitAttemptDto })
  submitAttempt(
    @Request() req: TenantAwareRequest,
    @Param('id') attemptId: string,
    @Body() body: SubmitAttemptDto,
  ) {
    return this.assessmentService.submitAttempt({
      tenantId: req.tenant?.id ?? null,
      authUserId: (req.user as any).sub ?? (req.user as any).userId,
      attemptId,
      body,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('attempts/:id')
  @ApiOperation({ summary: 'Get attempt results and review' })
  getAttempt(
    @Request() req: TenantAwareRequest,
    @Param('id') attemptId: string,
  ) {
    return this.assessmentService.getAttempt({
      tenantId: req.tenant?.id ?? null,
      authUserId: (req.user as any).sub ?? (req.user as any).userId,
      attemptId,
      roles: (req.user as any)?.roles ?? [],
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('assessments/:id/attempts')
  @ApiOperation({ summary: 'List all attempts for the current user' })
  listAttempts(
    @Request() req: TenantAwareRequest,
    @Param('id') assessmentId: string,
  ) {
    return this.assessmentService.listAttempts({
      tenantId: req.tenant?.id ?? null,
      authUserId: (req.user as any).sub ?? (req.user as any).userId,
      assessmentId,
    });
  }
}
