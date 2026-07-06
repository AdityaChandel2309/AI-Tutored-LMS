import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, Response, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { KnowledgeService } from './knowledge.service';
import { CreateDocumentDto, UpdateDocumentDto, CreateDocCategoryDto, UploadVersionDto } from './dto/knowledge.dto';
import { DocumentFileValidation } from '../common/pipes/file-validation.pipe';

@ApiTags('knowledge')
@ApiBearerAuth()
@Controller()
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @UseGuards(JwtAuthGuard)
  @Get('documents')
  @ApiOperation({ summary: 'List documents' })
  getDocuments(@Request() req: TenantAwareRequest, @Query('categoryId') categoryId?: string, @Query('type') type?: string, @Query('status') status?: string, @Query('search') search?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.knowledgeService.getDocuments(req.tenant?.id ?? null, { categoryId, type, status, search, page: page ? +page : undefined, limit: limit ? +limit : undefined });
  }

  @UseGuards(JwtAuthGuard)
  @Get('documents/:id')
  @ApiOperation({ summary: 'Get document detail' })
  getDocument(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.knowledgeService.getDocument(req.tenant?.id ?? null, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('documents/:id/download')
  @ApiOperation({ summary: 'Get document download URL' })
  getDownloadUrl(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.knowledgeService.getDownloadUrl(req.tenant?.id ?? null, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('documents/:id/file')
  @ApiOperation({ summary: 'Download document through the API' })
  async downloadFile(
    @Request() req: TenantAwareRequest,
    @Param('id') id: string,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const file = await this.knowledgeService.getDownloadFile(req.tenant?.id ?? null, id);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', file.data.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName.replace(/"/g, '')}"`,
    );
    return new StreamableFile(file.data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post('documents')
  @ApiOperation({ summary: 'Upload document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  createDocument(@Request() req: TenantAwareRequest, @UploadedFile(DocumentFileValidation) file: Express.Multer.File, @Body() dto: CreateDocumentDto) {
    return this.knowledgeService.createDocument(req.tenant?.id ?? null, dto, file, req.user?.userId ?? '');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Patch('documents/:id')
  @ApiOperation({ summary: 'Update document metadata' })
  @ApiBody({ type: UpdateDocumentDto })
  updateDocument(@Request() req: TenantAwareRequest, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.knowledgeService.updateDocument(req.tenant?.id ?? null, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post('documents/:id/versions')
  @ApiOperation({ summary: 'Upload new version' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadVersion(@Request() req: TenantAwareRequest, @Param('id') id: string, @UploadedFile(DocumentFileValidation) file: Express.Multer.File, @Body() dto: UploadVersionDto) {
    return this.knowledgeService.uploadVersion(req.tenant?.id ?? null, id, file, dto, req.user?.userId ?? '');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('documents/:id')
  @ApiOperation({ summary: 'Archive document' })
  deleteDocument(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.knowledgeService.deleteDocument(req.tenant?.id ?? null, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('documents/:id/reindex')
  @ApiOperation({ summary: 'Force re-extract text and rebuild embeddings for a document' })
  reindexDocument(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.knowledgeService.reindexDocument(req.tenant?.id ?? null, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('documents/reindex-all')
  @ApiOperation({ summary: 'Force re-extract text and rebuild embeddings for every document' })
  reindexAll(@Request() req: TenantAwareRequest) {
    const tenantId = req.tenant?.id;
    if (!tenantId) return { ok: false, error: 'Tenant not resolved' };
    return this.knowledgeService.backfillEmbeddings(tenantId, { force: true });
  }

  // ─── Categories ────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('document-categories')
  @ApiOperation({ summary: 'List document categories' })
  getCategories(@Request() req: TenantAwareRequest) {
    return this.knowledgeService.getCategories(req.tenant?.id ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('document-categories')
  @ApiOperation({ summary: 'Create document category' })
  @ApiBody({ type: CreateDocCategoryDto })
  createCategory(@Request() req: TenantAwareRequest, @Body() dto: CreateDocCategoryDto) {
    return this.knowledgeService.createCategory(req.tenant?.id ?? null, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('document-categories/:id')
  @ApiOperation({ summary: 'Update document category' })
  updateCategory(@Request() req: TenantAwareRequest, @Param('id') id: string, @Body() dto: Partial<CreateDocCategoryDto>) {
    return this.knowledgeService.updateCategory(req.tenant?.id ?? null, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('document-categories/:id')
  @ApiOperation({ summary: 'Delete document category' })
  deleteCategory(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.knowledgeService.deleteCategory(req.tenant?.id ?? null, id);
  }
}
