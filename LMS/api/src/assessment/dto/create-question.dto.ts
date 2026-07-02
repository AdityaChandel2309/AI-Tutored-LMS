import { ApiProperty } from '@nestjs/swagger';

export class CreateQuestionOptionDto {
  @ApiProperty({ example: 'Horizontal scaling' })
  text!: string;

  @ApiProperty({ example: false })
  isCorrect!: boolean;

  @ApiProperty({ example: 1 })
  order!: number;
}

export class CreateQuestionDto {
  @ApiProperty({
    example: 'multiple_choice',
    description: 'multiple_choice | multi_select | true_false',
  })
  type!: string;

  @ApiProperty({ example: 'What is the primary benefit of microservices?' })
  text!: string;

  @ApiProperty({
    required: false,
    example: 'Microservices allow independent deployment.',
  })
  explanation?: string;

  @ApiProperty({
    required: false,
    example: 1,
    description: 'Points for this question',
  })
  points?: number;

  @ApiProperty({
    example: 1,
    description: 'Display order within the assessment',
  })
  order!: number;

  @ApiProperty({
    type: [CreateQuestionOptionDto],
    description: 'Answer options',
  })
  options!: CreateQuestionOptionDto[];
}
