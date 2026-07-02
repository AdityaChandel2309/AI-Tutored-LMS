import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReportQueryDto {
  @ApiPropertyOptional({ description: 'Filter by course ID' })
  courseId?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  to?: string;
}
