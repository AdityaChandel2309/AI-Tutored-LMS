import { ApiProperty } from '@nestjs/swagger';

export class CreateQuestionOptionDto {
  @ApiProperty({ example: 'Horizontal scaling' })
  text!: string;

  @ApiProperty({ example: false })
  isCorrect!: boolean;

  @ApiProperty({ example: 1 })
  order!: number;
}

export class CreateAssessmentDto {
  @ApiProperty({ example: 'Module 1 Quiz' })
  title!: string;

  @ApiProperty({
    required: false,
    example: 'Test your knowledge of microservices',
  })
  description?: string;

  @ApiProperty({
    required: false,
    example: 70,
    description: 'Passing score percentage (0-100)',
  })
  passingScore?: number;

  @ApiProperty({
    required: false,
    example: 3,
    description: 'Max attempts (null = unlimited)',
  })
  maxAttempts?: number | null;

  @ApiProperty({
    required: false,
    example: 600,
    description: 'Time limit in seconds (null = no limit)',
  })
  timeLimitSec?: number | null;

  @ApiProperty({ required: false, example: false })
  isRandomized?: boolean;
}
