import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { TenantAwareRequest } from '../tenant/tenant.middleware';
import { EmployeeService } from './employee.service';
import { CreateEmployeeProfileDto, UpdateEmployeeProfileDto, EmployeeFilterDto } from './dto/employee.dto';
import { CsvFileValidation } from '../common/pipes/file-validation.pipe';

@ApiTags('employees')
@ApiBearerAuth()
@Controller()
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @UseGuards(JwtAuthGuard)
  @Get('employees')
  @ApiOperation({ summary: 'List employees with filters' })
  getEmployees(@Request() req: TenantAwareRequest, @Query() filters: EmployeeFilterDto) {
    return this.employeeService.getEmployees(req.tenant?.id ?? null, filters);
  }

  @UseGuards(JwtAuthGuard)
  @Get('employees/:id')
  @ApiOperation({ summary: 'Get employee profile' })
  getEmployee(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.employeeService.getEmployee(req.tenant?.id ?? null, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('employees/:id/reportees')
  @ApiOperation({ summary: 'Get direct reports of an employee' })
  getReportees(@Request() req: TenantAwareRequest, @Param('id') id: string) {
    return this.employeeService.getReportees(req.tenant?.id ?? null, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('employees')
  @ApiOperation({ summary: 'Create employee profile' })
  @ApiBody({ type: CreateEmployeeProfileDto })
  createEmployee(@Request() req: TenantAwareRequest, @Body() dto: CreateEmployeeProfileDto) {
    return this.employeeService.createEmployee(req.tenant?.id ?? null, dto, req.user?.userId ?? '');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('employees/:id')
  @ApiOperation({ summary: 'Update employee profile' })
  @ApiBody({ type: UpdateEmployeeProfileDto })
  updateEmployee(@Request() req: TenantAwareRequest, @Param('id') id: string, @Body() dto: UpdateEmployeeProfileDto) {
    return this.employeeService.updateEmployee(req.tenant?.id ?? null, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('employees/import')
  @ApiOperation({ summary: 'Import employees from CSV' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(@Request() req: TenantAwareRequest, @UploadedFile(CsvFileValidation) file: Express.Multer.File) {
    const csvContent = file.buffer.toString('utf-8');
    return this.employeeService.importCsv(req.tenant?.id ?? null, csvContent, req.user?.userId ?? '');
  }
}
