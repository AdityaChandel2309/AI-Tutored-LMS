import { ApiProperty } from '@nestjs/swagger';

export class UpdateAssessmentDto {
  @ApiProperty({ required: false, example: 'Updated Quiz Title' })
  title?: string;

  @ApiProperty({ required: false, example: 'Updated description' })
  description?: string | null;

  @ApiProperty({ required: false, example: 80 })
  passingScore?: number;

  @ApiProperty({ required: false, example: 5 })
  maxAttempts?: number | null;

  @ApiProperty({ required: false, example: 900 })
  timeLimitSec?: number | null;

  @ApiProperty({ required: false, example: false })
  isRandomized?: boolean;
}
