import { ApiProperty } from '@nestjs/swagger';

export class SubmitAnswerDto {
  @ApiProperty({ example: 'question-uuid-1' })
  questionId!: string;

  @ApiProperty({
    type: [String],
    example: ['option-uuid-1'],
    description: 'Selected option IDs',
  })
  selectedOptionIds!: string[];
}

export class SubmitAttemptDto {
  @ApiProperty({
    type: [SubmitAnswerDto],
    description: 'Answers for all questions',
  })
  answers!: SubmitAnswerDto[];
}
