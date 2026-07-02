import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateEmployeeProfileDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  userId!: string;

  @ApiProperty({ example: 'EMP001' })
  @IsString()
  employeeCode!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  designationId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reportingManagerId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dateOfJoining?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateEmployeeProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  designationId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reportingManagerId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dateOfJoining?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class EmployeeFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  designationId?: string;

  @ApiProperty({ required: false, description: 'Search by name or employee code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
