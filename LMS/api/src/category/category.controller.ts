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
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({
    summary: 'List categories in the resolved tenant',
  })
  getCategories(@Request() req: TenantAwareRequest) {
    return this.categoryService.getCategories(req.tenant?.id ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Post()
  @ApiOperation({
    summary: 'Create a category in the resolved tenant',
  })
  @ApiBody({ type: CreateCategoryDto })
  createCategory(
    @Request() req: TenantAwareRequest,
    @Body() body: CreateCategoryDto,
  ) {
    return this.categoryService.createCategory(req.tenant?.id ?? null, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a tenant-scoped category',
  })
  @ApiBody({ type: UpdateCategoryDto })
  updateCategory(
    @Request() req: TenantAwareRequest,
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.categoryService.updateCategory({
      tenantId: req.tenant?.id ?? null,
      categoryId: id,
      body,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor')
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a tenant-scoped category',
  })
  deleteCategory(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.categoryService.deleteCategory(req.tenant?.id ?? null, id);
  }
}
