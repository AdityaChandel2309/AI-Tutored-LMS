import { ApiProperty } from '@nestjs/swagger';

export class UpdateQuestionOptionDto {
  @ApiProperty({
    required: false,
    description: 'Existing option ID (omit for new options)',
  })
  id?: string;

  @ApiProperty({ example: 'Updated option text' })
  text!: string;

  @ApiProperty({ example: false })
  isCorrect!: boolean;

  @ApiProperty({ example: 1 })
  order!: number;
}

export class UpdateQuestionDto {
  @ApiProperty({ required: false, example: 'multiple_choice' })
  type?: string;

  @ApiProperty({ required: false, example: 'Updated question text' })
  text?: string;

  @ApiProperty({ required: false, example: 'Updated explanation' })
  explanation?: string | null;

  @ApiProperty({ required: false, example: 2 })
  points?: number;

  @ApiProperty({ required: false, example: 1 })
  order?: number;

  @ApiProperty({
    required: false,
    type: [UpdateQuestionOptionDto],
    description: 'Full replacement of options',
  })
  options?: UpdateQuestionOptionDto[];
}
