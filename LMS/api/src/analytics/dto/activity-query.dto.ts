import { ApiPropertyOptional } from '@nestjs/swagger';

export class ActivityQueryDto {
  @ApiPropertyOptional({
    description: 'Number of items to return',
    default: 20,
  })
  take?: string;

  @ApiPropertyOptional({ description: 'Number of items to skip', default: 0 })
  skip?: string;

  @ApiPropertyOptional({ description: 'Filter by event type' })
  type?: string;
}
