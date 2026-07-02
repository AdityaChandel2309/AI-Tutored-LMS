import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'Pipeline Modernization' })
  title!: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  departmentId?: string;

  @ApiProperty({ required: false })
  startDate?: string;

  @ApiProperty({ required: false })
  targetEndDate?: string;
}

export class UpdateProjectDto {
  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  departmentId?: string | null;

  @ApiProperty({ required: false })
  startDate?: string;

  @ApiProperty({ required: false })
  targetEndDate?: string;
}

export class UpdateProjectStatusDto {
  @ApiProperty({ example: 'active', enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'] })
  status!: string;
}

export class CreateMilestoneDto {
  @ApiProperty({ example: 'Phase 1 Complete' })
  title!: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  dueDate?: string;

  @ApiProperty()
  order!: number;
}

export class UpdateMilestoneDto {
  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false, enum: ['pending', 'in_progress', 'completed'] })
  status?: string;

  @ApiProperty({ required: false })
  dueDate?: string;
}

export class AddMemberDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ required: false, enum: ['owner', 'member', 'viewer'], default: 'member' })
  role?: string;
}
