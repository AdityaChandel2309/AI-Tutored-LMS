import {
  Body,
  Controller,
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
import { CertificateService } from './certificate.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { IssueCertificateDto } from './dto/issue-certificate.dto';

@ApiTags('certificates')
@ApiBearerAuth()
@Controller()
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  // ─── Template CRUD ──────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post('courses/:id/certificate-template')
  @ApiOperation({ summary: 'Create a certificate template for a course' })
  @ApiBody({ type: CreateTemplateDto })
  createTemplate(
    @Request() req: TenantAwareRequest,
    @Param('id') courseId: string,
    @Body() body: CreateTemplateDto,
  ) {
    return this.certificateService.createTemplate({
      tenantId: req.tenant?.id ?? null,
      courseId,
      body,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Get('courses/:id/certificate-template')
  @ApiOperation({ summary: 'Get certificate template for a course' })
  getTemplate(
    @Request() req: TenantAwareRequest,
    @Param('id') courseId: string,
  ) {
    return this.certificateService.getTemplate(
      req.tenant?.id ?? null,
      courseId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Patch('certificate-templates/:id')
  @ApiOperation({ summary: 'Update a certificate template' })
  @ApiBody({ type: UpdateTemplateDto })
  updateTemplate(
    @Request() req: TenantAwareRequest,
    @Param('id') templateId: string,
    @Body() body: UpdateTemplateDto,
  ) {
    return this.certificateService.updateTemplate({
      tenantId: req.tenant?.id ?? null,
      templateId,
      body,
    });
  }

  // ─── Certificate Issuance ───────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post('certificate-templates/:id/issue')
  @ApiOperation({ summary: 'Manually issue a certificate for an enrollment' })
  @ApiBody({ type: IssueCertificateDto })
  issueCertificate(
    @Request() req: TenantAwareRequest,
    @Param('id') templateId: string,
    @Body() body: IssueCertificateDto,
  ) {
    return this.certificateService.issueCertificate({
      tenantId: req.tenant?.id ?? null,
      templateId,
      enrollmentId: body.enrollmentId,
    });
  }

  // ─── Learner endpoints ──────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('my/certificates')
  @ApiOperation({ summary: 'List my earned certificates' })
  listMyCertificates(@Request() req: TenantAwareRequest) {
    return this.certificateService.listMyCertificates(
      req.tenant?.id ?? null,
      (req.user as any).sub ?? (req.user as any).userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('certificates/:id/pdf')
  @ApiOperation({ summary: 'Get presigned URL for certificate PDF download' })
  getCertificatePdf(
    @Request() req: TenantAwareRequest,
    @Param('id') certificateId: string,
  ) {
    return this.certificateService.getCertificatePdfUrl({
      tenantId: req.tenant?.id ?? null,
      authUserId: (req.user as any).sub ?? (req.user as any).userId,
      certificateId,
    });
  }
}
